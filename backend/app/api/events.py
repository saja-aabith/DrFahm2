from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models.events import AppEvent, VALID_EVENT_TYPES
from ..api.errors import bad_request

events_bp = Blueprint("events", __name__, url_prefix="/api/events")


@events_bp.route("/track", methods=["POST"])
@jwt_required(optional=True)
def track_event():
    """
    Log an analytics event. Auth optional — captures pre-login events too.
    Body: { event_type, exam?, plan_id?, meta? }
    """
    data       = request.get_json(silent=True) or {}
    event_type = (data.get("event_type") or "").strip()

    if not event_type:
        return bad_request("validation_error", "event_type is required.")

    if event_type not in VALID_EVENT_TYPES:
        return bad_request("invalid_event_type",
                           f"event_type must be one of: {sorted(VALID_EVENT_TYPES)}.")

    user_id = None
    raw_id  = get_jwt_identity()
    if raw_id:
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            pass

    event = AppEvent(
        user_id=user_id,
        event_type=event_type,
        exam=data.get("exam"),
        plan_id=data.get("plan_id"),
        meta=data.get("meta"),
    )
    db.session.add(event)
    db.session.commit()

    return jsonify({"tracked": True}), 200