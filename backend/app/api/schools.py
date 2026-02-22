from flask import Blueprint, request, jsonify, current_app
from ..extensions import db
from ..models.leads import Lead, VALID_DURATIONS, compute_estimated_band
from ..api.errors import bad_request

schools_bp = Blueprint("schools", __name__, url_prefix="/api/schools")


@schools_bp.route("/leads", methods=["POST"])
def submit_lead():
    """
    Public endpoint — no auth required.
    Captures school contact form submissions.
    """
    data = request.get_json(silent=True) or {}

    name  = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    role  = (data.get("role") or "").strip().lower()

    if not name:
        return bad_request("validation_error", "name is required.")
    if not email or "@" not in email:
        return bad_request("validation_error", "A valid email is required.")
    if role not in ("student", "parent", "school"):
        return bad_request("validation_error",
                           "role must be one of: student, parent, school.")

    qudurat_students = data.get("qudurat_students")
    tahsili_students = data.get("tahsili_students")
    total_students   = None
    estimated_band   = None

    if role == "school":
        school_name = (data.get("school_name") or "").strip()
        if not school_name:
            return bad_request("validation_error",
                               "school_name is required for school leads.")

        preferred_duration = (data.get("preferred_duration") or "").strip()
        if preferred_duration and preferred_duration not in VALID_DURATIONS:
            return bad_request("validation_error",
                               f"preferred_duration must be one of {sorted(VALID_DURATIONS)}.")

        if qudurat_students is not None:
            try:
                qudurat_students = int(qudurat_students)
            except (TypeError, ValueError):
                return bad_request("validation_error",
                                   "qudurat_students must be an integer.")

        if tahsili_students is not None:
            try:
                tahsili_students = int(tahsili_students)
            except (TypeError, ValueError):
                return bad_request("validation_error",
                                   "tahsili_students must be an integer.")

        if qudurat_students is not None or tahsili_students is not None:
            total_students = (qudurat_students or 0) + (tahsili_students or 0)
            estimated_band = compute_estimated_band(total_students) if total_students > 0 else None
    else:
        school_name        = None
        preferred_duration = None

    lead = Lead(
        name=name,
        email=email,
        role=role,
        message=(data.get("message") or "").strip() or None,
        context=(data.get("context") or "").strip() or None,
        school_name=school_name,
        qudurat_students=qudurat_students,
        tahsili_students=tahsili_students,
        total_students=total_students,
        preferred_duration=preferred_duration if role == "school" else None,
        estimated_band=estimated_band,
    )
    db.session.add(lead)
    db.session.commit()

    current_app.logger.info(
        f"New lead: role={role} email={email} school={school_name}"
    )

    return jsonify({
        "message": "Thank you! We'll be in touch within 1–2 business days.",
        "lead_id": lead.id,
    }), 201