"""
Billing API.

Endpoints:
  POST /api/billing/create-checkout-session      ← individual students
  POST /api/billing/admin/create-school-checkout ← admin/closer tool (drfahm_admin only)
  POST /api/billing/webhook                      ← Stripe webhook (no auth)
  GET  /api/billing/entitlements                 ← current user's entitlements
  GET  /api/billing/admin/invoice/<invoice_number> ← bilingual PDF invoice download
"""

import json
import stripe

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app, Response as FlaskResponse

from ..extensions import db
from ..models.user import User, UserRole
from ..models.org import Org
from ..models.entitlement import Entitlement, PlanId, PlanType
from ..models.billing import StripeEvent
from ..api.errors import bad_request, error_response
from ..api.auth import require_auth, roles_required, _get_current_user
from ..utils.stripe_helpers import (
    get_individual_plan_config,
    get_school_plan_config,
    compute_expiry,
    validate_exam,
    SCHOOL_DURATION_DAYS,
)
from sqlalchemy.exc import IntegrityError

billing_bp = Blueprint("billing", __name__, url_prefix="/api/billing")

_ADMIN_ROLE = (UserRole.DRFAHM_ADMIN,)


# ═════════════════════════════════════════════════════════════════════════════
# POST /api/billing/create-checkout-session  (individual students)
# ═════════════════════════════════════════════════════════════════════════════

@billing_bp.route("/create-checkout-session", methods=["POST"])
@require_auth
def create_checkout_session():
    """
    Creates a Stripe Checkout session for an individual student.

    Body: { "plan_id": "basic" | "premium", "exam": "qudurat" | "tahsili" }

    Rules:
    - Free plan → 400 (no checkout needed).
    - Blocks if student already has an active entitlement for this exam.
    - Price ID resolved server-side from plan_id + exam — never from frontend.
    - mode = "payment" (one-time, no subscriptions).
    """
    user = _get_current_user()
    data = request.get_json(silent=True) or {}

    plan_id = (data.get("plan_id") or "").strip().lower()
    exam    = (data.get("exam")    or "").strip().lower()

    if not plan_id:
        return bad_request("validation_error", "plan_id is required.")
    if not exam:
        return bad_request("validation_error", "exam is required.")

    if plan_id == "free":
        return bad_request(
            "free_plan_no_checkout",
            "Free plan does not require checkout. "
            "Go to your exam dashboard to start the free trial.",
        )

    try:
        validate_exam(exam)
    except ValueError as e:
        return bad_request("invalid_exam", str(e))

    # Block duplicate purchase — student already has active entitlement
    now = datetime.now(timezone.utc)
    active = Entitlement.query.filter(
        Entitlement.user_id == user.id,
        Entitlement.exam    == exam,
        Entitlement.entitlement_expires_at > now,
    ).first()
    if active:
        return bad_request(
            "already_entitled",
            f"You already have an active {active.plan_id.value} plan for {exam} "
            f"(expires {active.entitlement_expires_at.strftime('%d %b %Y')}). "
            "No need to purchase again.",
        )

    try:
        plan_config = get_individual_plan_config(plan_id, exam)
    except ValueError as e:
        return bad_request("invalid_plan", str(e))

    stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]
    frontend_base  = current_app.config["FRONTEND_BASE_URL"]

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{"price": plan_config["stripe_price_id"], "quantity": 1}],
            metadata={
                "user_id":   str(user.id),
                "plan_id":   plan_config["plan_id"].value,
                "plan_type": plan_config["plan_type"].value,
                "exam":      exam,
                # org_id intentionally absent — webhook branches on its presence
            },
            success_url=frontend_base + "/billing/success",
            cancel_url=frontend_base  + "/pricing",
            customer_email=getattr(user, "email", None) or None,
        )
    except stripe.error.StripeError as e:
        current_app.logger.error(f"Stripe session creation failed: {e}")
        return error_response(
            "stripe_error",
            "Could not create checkout session. Please try again.",
            502,
        )

    return jsonify({"checkout_url": session.url}), 200


# ═════════════════════════════════════════════════════════════════════════════
# POST /api/billing/admin/create-school-checkout  (closer tool)
# ═════════════════════════════════════════════════════════════════════════════

@billing_bp.route("/admin/create-school-checkout", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_school_checkout():
    """
    Generates a Stripe Checkout URL for a school payment.
    Used by the sales closer during a phone call — URL is sent to the school
    leader on WhatsApp for immediate payment.

    Body:
      org_id        int     required — must be an existing org
      exam          string  required — qudurat | tahsili
      student_count int     required — number of students
      plan_tier     string  required — standard | volume

    Returns:
      checkout_url         string  — send this to the school leader
      total_sar            float   — for confirmation display
      price_per_student    float
      student_count        int
      plan_tier            string
      invoice_number       string  — for bilingual PDF invoice

    Pricing (from config, defaults):
      standard: SAR 99/student, min 30 students
      volume:   SAR 75/student, min 100 students
    """
    data = request.get_json(silent=True) or {}

    org_id_raw    = data.get("org_id")
    exam          = (data.get("exam")          or "").strip().lower()
    student_count = data.get("student_count")
    plan_tier     = (data.get("plan_tier")     or "").strip().lower()

    if not org_id_raw:
        return bad_request("validation_error", "org_id is required.")
    if not exam:
        return bad_request("validation_error", "exam is required.")
    if student_count is None:
        return bad_request("validation_error", "student_count is required.")
    if not plan_tier:
        return bad_request("validation_error", "plan_tier is required (standard or volume).")

    try:
        org_id        = int(org_id_raw)
        student_count = int(student_count)
        if student_count < 1:
            raise ValueError
    except (ValueError, TypeError):
        return bad_request("validation_error",
                           "org_id and student_count must be positive integers.")

    try:
        validate_exam(exam)
    except ValueError as e:
        return bad_request("invalid_exam", str(e))

    org = Org.query.get(org_id)
    if not org:
        return error_response("not_found", f"Org {org_id} not found.", 404)

    try:
        school_config = get_school_plan_config(plan_tier, student_count)
    except ValueError as e:
        return bad_request("invalid_plan", str(e))

    ts             = datetime.now(timezone.utc)
    invoice_number = f"DF-{org_id}-{ts.strftime('%Y%m%d%H%M%S')}"

    stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]
    frontend_base  = current_app.config["FRONTEND_BASE_URL"]

    exam_display = "Qudurat — قدرات" if exam == "qudurat" else "Tahsili — تحصيلي"

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[{
                "price_data": {
                    "currency":     "sar",
                    "unit_amount":  school_config["price_per_student_halalas"],
                    "product_data": {
                        "name": (
                            f"DrFahm School Licence — {exam_display} "
                            f"({student_count} students, {plan_tier.title()} tier)"
                        ),
                        "description": (
                            f"365-day access · All 5 worlds per track · "
                            f"Invoice: {invoice_number}"
                        ),
                    },
                },
                "quantity": student_count,
            }],
            metadata={
                "org_id":         str(org_id),
                "exam":           exam,
                "plan_tier":      plan_tier,
                "plan_type":      school_config["plan_type"].value,
                "student_count":  str(student_count),
                "duration_days":  str(SCHOOL_DURATION_DAYS),
                "invoice_number": invoice_number,
                "org_name":       org.name,
            },
            success_url=frontend_base + "/billing/success",
            cancel_url=frontend_base  + "/schools",
        )
    except stripe.error.StripeError as e:
        current_app.logger.error(f"School Stripe session creation failed: {e}")
        return error_response(
            "stripe_error",
            "Could not create checkout session. Please try again.",
            502,
        )

    return jsonify({
        "checkout_url":      session.url,
        "total_sar":         school_config["total_sar"],
        "price_per_student": school_config["price_per_student_sar"],
        "student_count":     student_count,
        "plan_tier":         plan_tier,
        "invoice_number":    invoice_number,
        "org_name":          org.name,
        "exam":              exam,
        "expires_days":      SCHOOL_DURATION_DAYS,
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# POST /api/billing/webhook  (Stripe → backend, no auth)
# ═════════════════════════════════════════════════════════════════════════════

@billing_bp.route("/webhook", methods=["POST"])
def webhook():
    """
    Stripe webhook endpoint.

    Security:
      Verifies Stripe-Signature header. Rejects invalid signatures.

    Idempotency:
      Inserts stripe_event_id into stripe_events (UNIQUE).
      Duplicate event → return 200 immediately, no double-grant.

    Routing:
      checkout.session.completed:
        - metadata has org_id  → grant org entitlement  (school payment)
        - metadata has user_id → grant user entitlement (individual payment)

      All other events → logged as skipped.
    """
    payload        = request.get_data()
    sig_header     = request.headers.get("Stripe-Signature", "")
    webhook_secret = current_app.config["STRIPE_WEBHOOK_SECRET"]
    stripe.api_key = current_app.config["STRIPE_SECRET_KEY"]

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

    event_record = StripeEvent(
        stripe_event_id=stripe_event_id,
        event_type=event_type,
        status="pending",
        payload=json.dumps(event, default=str),
    )
    db.session.add(event_record)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        current_app.logger.info(f"Duplicate Stripe event ignored: {stripe_event_id}")
        return jsonify({"received": True, "status": "already_processed"}), 200

    try:
        if event_type == "checkout.session.completed":
            _handle_checkout_completed(event["data"]["object"], event_record)
        else:
            event_record.status = "skipped"
            current_app.logger.info(f"Stripe event skipped: {event_type}")

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        try:
            event_record.status        = "failed"
            event_record.error_message = str(e)
            db.session.commit()
        except Exception:
            db.session.rollback()

        current_app.logger.error(
            f"Webhook processing error for {stripe_event_id}: {e}", exc_info=True
        )
        return jsonify({"received": True, "status": "processing_error"}), 200

    return jsonify({"received": True, "status": event_record.status}), 200


def _handle_checkout_completed(session_obj: dict, event_record: StripeEvent):
    """
    Single handler for both individual and school checkout completions.

    Branches on metadata:
      org_id present  → school payment  → org entitlement
      user_id present → individual      → user entitlement

    Raises on any validation failure — caller rolls back and marks event failed.
    """
    metadata          = session_obj.get("metadata") or {}
    stripe_session_id = session_obj.get("id")
    now               = datetime.now(timezone.utc)

    existing = Entitlement.query.filter_by(
        stripe_session_id=stripe_session_id
    ).first()
    if existing:
        event_record.status = "skipped"
        current_app.logger.info(
            f"Entitlement already exists for session {stripe_session_id}, skipping."
        )
        return

    org_id_str  = metadata.get("org_id")
    user_id_str = metadata.get("user_id")

    if org_id_str:
        _grant_org_entitlement(metadata, stripe_session_id, event_record, now)
    elif user_id_str:
        _grant_individual_entitlement(metadata, stripe_session_id, event_record, now)
    else:
        raise ValueError(
            f"Stripe session {stripe_session_id} has neither org_id nor user_id "
            "in metadata. Cannot grant entitlement."
        )


def _grant_individual_entitlement(
    metadata: dict, stripe_session_id: str, event_record: StripeEvent, now: datetime
):
    """Grants a paid entitlement to an individual student."""
    user_id_str   = metadata.get("user_id")
    plan_id_str   = metadata.get("plan_id")
    plan_type_str = metadata.get("plan_type")
    exam          = metadata.get("exam")

    missing = [k for k, v in {
        "user_id": user_id_str, "plan_id": plan_id_str,
        "plan_type": plan_type_str, "exam": exam,
    }.items() if not v]
    if missing:
        raise ValueError(f"Individual metadata missing fields: {missing}")

    user = db.session.get(User, int(user_id_str))
    if not user:
        raise ValueError(f"User {user_id_str} not found.")

    try:
        plan_config = get_individual_plan_config(plan_id_str, exam)
    except ValueError as e:
        raise ValueError(f"Invalid plan in metadata: {e}")

    expiry = compute_expiry(plan_config["duration_days"])

    entitlement = Entitlement(
        user_id=user.id,
        org_id=None,
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
        f"Individual entitlement granted: user={user.id} exam={exam} "
        f"plan={plan_id_str} expires={expiry.isoformat()}"
    )


def _grant_org_entitlement(
    metadata: dict, stripe_session_id: str, event_record: StripeEvent, now: datetime
):
    """Grants a paid entitlement to a school org."""
    org_id_str    = metadata.get("org_id")
    exam          = metadata.get("exam")
    plan_type_str = metadata.get("plan_type")
    student_count = metadata.get("student_count")
    duration_days = int(metadata.get("duration_days", SCHOOL_DURATION_DAYS))

    missing = [k for k, v in {
        "org_id": org_id_str, "exam": exam, "plan_type": plan_type_str,
    }.items() if not v]
    if missing:
        raise ValueError(f"School metadata missing fields: {missing}")

    org = db.session.get(Org, int(org_id_str))
    if not org:
        raise ValueError(f"Org {org_id_str} not found.")

    try:
        plan_type = PlanType(plan_type_str)
    except ValueError:
        raise ValueError(f"Invalid plan_type in metadata: {plan_type_str!r}")

    expiry = compute_expiry(duration_days)

    from ..utils.world_config import PLAN_WORLD_LIMIT
    max_world_index = PLAN_WORLD_LIMIT["basic"]  # 5 — all worlds unlocked

    entitlement = Entitlement(
        user_id=None,
        org_id=org.id,
        exam=exam,
        plan_id=PlanId.PREMIUM,
        plan_type=plan_type,
        max_world_index=max_world_index,
        entitlement_starts_at=now,
        entitlement_expires_at=expiry,
        stripe_session_id=stripe_session_id,
        student_count=int(student_count) if student_count else None,
    )
    db.session.add(entitlement)

    event_record.status       = "processed"
    event_record.processed_at = now

    current_app.logger.info(
        f"Org entitlement granted: org={org.id} ({org.name}) exam={exam} "
        f"plan_type={plan_type_str} students={student_count} "
        f"expires={expiry.isoformat()}"
    )


# ═════════════════════════════════════════════════════════════════════════════
# GET /api/billing/entitlements
# ═════════════════════════════════════════════════════════════════════════════

@billing_bp.route("/entitlements", methods=["GET"])
@require_auth
def get_entitlements():
    """
    Returns all active entitlements for the current user.
    Includes both individual and org-inherited entitlements.
    """
    user = _get_current_user()
    now  = datetime.now(timezone.utc)

    individual = Entitlement.query.filter(
        Entitlement.user_id == user.id,
        Entitlement.entitlement_expires_at > now,
    ).all()

    org_entitlements = []
    if user.org_id:
        org_entitlements = Entitlement.query.filter(
            Entitlement.org_id == user.org_id,
            Entitlement.entitlement_expires_at > now,
        ).all()

    from ..models.entitlement import ExamTrial
    trials = ExamTrial.query.filter_by(user_id=user.id).all()

    return jsonify({
        "individual_entitlements": [e.to_dict() for e in individual],
        "org_entitlements":        [e.to_dict() for e in org_entitlements],
        "trials":                  [t.to_dict() for t in trials],
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# GET /api/billing/admin/invoice/<invoice_number>
# ═════════════════════════════════════════════════════════════════════════════

@billing_bp.route("/admin/invoice/<invoice_number>", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def download_invoice(invoice_number: str):
    """
    Generate and stream a bilingual PDF invoice for a school payment.

    All invoice data passed as query params — generated on-the-fly from the
    create-school-checkout response stored in the admin panel.

    Query params:
        org_name          string
        exam              string   qudurat | tahsili
        plan_tier         string   standard | volume
        student_count     int
        price_per_student float    SAR
        total_sar         float
        expires_days      int      default 365

    Returns a PDF file download.
    """
    from ..utils.invoice_pdf import generate_school_invoice_pdf

    args = request.args

    org_name      = args.get("org_name", "")
    exam          = args.get("exam", "")
    plan_tier     = args.get("plan_tier", "standard")
    student_count = args.get("student_count", "0")
    price_each    = args.get("price_per_student", "0")
    total_sar     = args.get("total_sar", "0")
    expires_days  = args.get("expires_days", "365")

    invoice_data = {
        "invoice_number":    invoice_number,
        "org_name":          org_name or "—",
        "exam":              exam or "qudurat",
        "plan_tier":         plan_tier,
        "student_count":     int(student_count),
        "price_per_student": float(price_each),
        "total_sar":         float(total_sar),
        "expires_days":      int(expires_days),
        "generated_at":      datetime.now(timezone.utc).strftime("%d %B %Y"),
    }

    try:
        pdf_bytes = generate_school_invoice_pdf(invoice_data)
    except Exception as e:
        current_app.logger.error(f"Invoice PDF generation failed: {e}", exc_info=True)
        return error_response("pdf_error", "Could not generate invoice PDF.", 500)

    safe_name = invoice_number.replace("/", "-")
    return FlaskResponse(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="DrFahm_Invoice_{safe_name}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    ), 200