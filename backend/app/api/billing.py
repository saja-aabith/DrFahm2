import json
import stripe

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.user import User
from ..models.entitlement import Entitlement, PlanId
from ..models.billing import StripeEvent
from ..api.errors import bad_request, unauthorized, forbidden, error_response
from ..api.auth import require_auth, _get_current_user
from ..utils.stripe_helpers import get_plan_config, compute_expiry, validate_exam

billing_bp = Blueprint("billing", __name__, url_prefix="/api/billing")


# ── POST /api/billing/create-checkout-session ─────────────────────────────────

@billing_bp.route("/create-checkout-session", methods=["POST"])
@require_auth
def create_checkout_session():
    """
    Creates a Stripe Checkout session for basic or premium plan.

    Body: { "plan_id": "basic" | "premium", "exam": "qudurat" | "tahsili" }

    Rules:
    - Free plan → 400 (no Stripe checkout for free).
    - plan_id and exam are required.
    - price_id, duration, world limit all derived server-side from plan_id.
    - mode = "payment" (one-time, no subscriptions in MVP).
    - Metadata stored on session for webhook entitlement grant.
    """
    user = _get_current_user()
    data = request.get_json(silent=True) or {}

    plan_id = (data.get("plan_id") or "").strip().lower()
    exam    = (data.get("exam") or "").strip().lower()

    # ── Validate inputs ──
    if not plan_id:
        return bad_request("validation_error", "plan_id is required.")
    if not exam:
        return bad_request("validation_error", "exam is required.")

    if plan_id == PlanId.FREE:
        return bad_request(
            "free_plan_no_checkout",
            "Free plan does not require checkout. "
            "Access your exam dashboard to start the free trial."
        )

    try:
        validate_exam(exam)
    except ValueError as e:
        return bad_request("invalid_exam", str(e))

    try:
        plan_config = get_plan_config(plan_id)
    except ValueError as e:
        return bad_request("invalid_plan_id", str(e))

    # ── Build Stripe session ──
    stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]
    frontend_base  = current_app.config["FRONTEND_BASE_URL"]

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price":    plan_config["stripe_price_id"],
                    "quantity": 1,
                }
            ],
            metadata={
                "user_id":   str(user.id),
                "plan_id":   plan_config["plan_id"].value,
                "plan_type": plan_config["plan_type"].value,
                "exam":      exam,
            },
            success_url=frontend_base + "/billing/success",
            cancel_url=frontend_base  + "/pricing",
            # Pre-fill email if available
            customer_email=user.email or None,
        )
    except stripe.error.StripeError as e:
        current_app.logger.error(f"Stripe session creation failed: {e}")
        return error_response(
            "stripe_error",
            "Could not create checkout session. Please try again.",
            502,
        )

    return jsonify({"checkout_url": session.url}), 200


# ── POST /api/billing/webhook ─────────────────────────────────────────────────

@billing_bp.route("/webhook", methods=["POST"])
def webhook():
    """
    Stripe webhook endpoint.

    Security:
    - Verifies Stripe-Signature header using STRIPE_WEBHOOK_SECRET.
    - Rejects invalid signatures with 400.

    Idempotency:
    - Inserts stripe_event_id into stripe_events with UNIQUE constraint.
    - If already exists → already processed → return 200 immediately.
    - Processing the same event twice never creates duplicate entitlements.

    Events handled:
    - checkout.session.completed → grant entitlement (REQUIRED).

    All other events → logged as "skipped", return 200.
    """
    payload   = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")
    webhook_secret = current_app.config["STRIPE_WEBHOOK_SECRET"]
    stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]

    # ── Verify signature ──
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        current_app.logger.warning("Stripe webhook signature verification failed.")
        return bad_request("invalid_signature", "Stripe signature verification failed.")
    except Exception as e:
        current_app.logger.error(f"Webhook parse error: {e}")
        return bad_request("webhook_parse_error", "Could not parse webhook payload.")

    stripe_event_id = event["id"]
    event_type      = event["type"]

    # ── Idempotency: attempt to insert event record ──
    event_record = StripeEvent(
        stripe_event_id=stripe_event_id,
        event_type=event_type,
        status="pending",
        payload=json.dumps(event, default=str),
    )
    db.session.add(event_record)
    try:
        db.session.flush()   # will raise IntegrityError if duplicate
    except IntegrityError:
        db.session.rollback()
        current_app.logger.info(
            f"Duplicate Stripe event ignored: {stripe_event_id}"
        )
        return jsonify({"received": True, "status": "already_processed"}), 200

    # ── Route by event type ──
    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(event["data"]["object"], event_record)
        else:
            # All other events: log as skipped, no action in MVP
            event_record.status = "skipped"
            current_app.logger.info(f"Stripe event skipped (not handled): {event_type}")

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        # Mark event as failed so it can be retried/investigated
        try:
            event_record.status = "failed"
            event_record.error_message = str(e)
            db.session.commit()
        except Exception:
            db.session.rollback()

        current_app.logger.error(
            f"Webhook processing error for {stripe_event_id}: {e}",
            exc_info=True,
        )
        # Return 200 to prevent Stripe from retrying events that have
        # already been recorded but failed in processing.
        # The failed record is available for manual inspection.
        return jsonify({"received": True, "status": "processing_error"}), 200

    return jsonify({"received": True, "status": event_record.status}), 200


def _handle_checkout_completed(session_obj: dict, event_record: StripeEvent):
    """
    Grants entitlement after a verified successful checkout.

    Reads plan_id, plan_type, exam, user_id from Stripe session metadata.
    Computes entitlement_expires_at from plan duration (never from frontend).
    Raises on any validation failure — caller rolls back and marks event failed.
    """
    metadata = session_obj.get("metadata") or {}

    # ── Extract and validate metadata ──
    user_id_str  = metadata.get("user_id")
    plan_id_str  = metadata.get("plan_id")
    plan_type_str = metadata.get("plan_type")
    exam         = metadata.get("exam")

    missing = [k for k, v in {
        "user_id":   user_id_str,
        "plan_id":   plan_id_str,
        "plan_type": plan_type_str,
        "exam":      exam,
    }.items() if not v]

    if missing:
        raise ValueError(
            f"Stripe session {session_obj.get('id')} missing metadata: {missing}"
        )

    # ── Resolve user ──
    user = db.session.get(User, int(user_id_str))
    if not user:
        raise ValueError(f"User {user_id_str} not found during webhook processing.")

    # ── Resolve plan config ──
    try:
        plan_config = get_plan_config(plan_id_str)
    except ValueError as e:
        raise ValueError(f"Invalid plan_id in metadata: {e}")

    # ── Compute expiry server-side ──
    now    = datetime.now(timezone.utc)
    expiry = compute_expiry(plan_config["duration_days"])

    # ── Prevent duplicate entitlement for this Stripe session ──
    stripe_session_id = session_obj.get("id")
    existing = Entitlement.query.filter_by(
        stripe_session_id=stripe_session_id
    ).first()
    if existing:
        # Belt-and-suspenders: idempotency table should catch this first
        event_record.status = "skipped"
        current_app.logger.info(
            f"Entitlement already exists for session {stripe_session_id}, skipping."
        )
        return

    # ── Create entitlement ──
    entitlement = Entitlement(
        user_id=user.id,
        org_id=None,                              # individual purchase
        exam=exam,
        plan_id=plan_config["plan_id"],
        plan_type=plan_config["plan_type"],
        max_world_index=plan_config["max_world_index"],
        entitlement_starts_at=now,
        entitlement_expires_at=expiry,
        stripe_session_id=stripe_session_id,
    )
    db.session.add(entitlement)

    event_record.status       = "processed"
    event_record.processed_at = now

    current_app.logger.info(
        f"Entitlement granted: user={user.id} exam={exam} "
        f"plan={plan_id_str} expires={expiry.isoformat()}"
    )


# ── GET /api/billing/entitlements ─────────────────────────────────────────────

@billing_bp.route("/entitlements", methods=["GET"])
@require_auth
def get_entitlements():
    """
    Returns all active entitlements for the current user.
    Includes both individual and org entitlements (if user belongs to an org).
    """
    user = _get_current_user()
    now  = datetime.now(timezone.utc)

    # Individual entitlements
    individual = (
        Entitlement.query
        .filter(
            Entitlement.user_id == user.id,
            Entitlement.entitlement_expires_at > now,
        )
        .all()
    )

    # Org entitlements (if applicable)
    org_entitlements = []
    if user.org_id:
        org_entitlements = (
            Entitlement.query
            .filter(
                Entitlement.org_id == user.org_id,
                Entitlement.entitlement_expires_at > now,
            )
            .all()
        )

    # Trials
    from ..models.entitlement import ExamTrial
    trials = ExamTrial.query.filter_by(user_id=user.id).all()

    return jsonify({
        "individual_entitlements": [e.to_dict() for e in individual],
        "org_entitlements":        [e.to_dict() for e in org_entitlements],
        "trials":                  [t.to_dict() for t in trials],
    }), 200