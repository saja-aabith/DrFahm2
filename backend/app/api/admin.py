"""
Admin API — drfahm_admin only.

All routes require role=drfahm_admin (enforced by @roles_required decorator).

Endpoints:
  Questions
    POST   /api/admin/questions/import
    GET    /api/admin/questions
    GET    /api/admin/questions/:id
    PUT    /api/admin/questions/:id          (optimistic lock on version)
    DELETE /api/admin/questions/:id          (soft delete)
    PATCH  /api/admin/questions/:id/activate

  Orgs
    POST   /api/admin/orgs
    GET    /api/admin/orgs
    GET    /api/admin/orgs/:org_id
    POST   /api/admin/orgs/:org_id/leader
    POST   /api/admin/orgs/:org_id/students/generate
    GET    /api/admin/orgs/:org_id/students/export   (CSV)
    POST   /api/admin/orgs/:org_id/entitlement       (grant org entitlement)

  Users
    GET    /api/admin/users
    POST   /api/admin/users                  (create drfahm_admin only)
    PATCH  /api/admin/users/:user_id/activate
    PATCH  /api/admin/users/:user_id/deactivate
    POST   /api/admin/users/:user_id/reset-password
"""

import csv
import io
import random
import string
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, current_app, Response
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.user import User, UserRole
from ..models.org import Org
from ..models.entitlement import Entitlement, PlanId, PlanType
from ..models.question import Question, Difficulty
from ..api.auth import roles_required, _get_current_user
from ..api.errors import bad_request, forbidden, conflict, error_response
from ..utils.world_config import (
    VALID_EXAMS, VALID_WORLD_KEYS, EXAM_WORLD_ORDER,
    get_total_questions, validate_exam, validate_world_key, PLAN_WORLD_LIMIT,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

_ADMIN_ROLE = (UserRole.DRFAHM_ADMIN,)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _random_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(random.SystemRandom().choice(chars) for _ in range(length))


def _random_username_suffix(length: int = 4) -> str:
    return ''.join(random.SystemRandom().choice(string.digits) for _ in range(length))


def _paginate(query, page: int, per_page: int):
    total   = query.count()
    items   = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, total


# ═════════════════════════════════════════════════════════════════════════════
# QUESTIONS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/import", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def import_questions():
    """
    Bulk import / upsert questions.

    Body: JSON array of question objects.
    Upsert key: (exam, world_key, index).
    Setting allow_partial=true skips the "must equal total_questions" check.

    Validation:
    - exam must be valid
    - world_key must belong to exam
    - index must be 1-based integer
    - correct_answer must be a/b/c/d (or absent — defaults to 'a' placeholder)
    - No duplicate (exam, world_key, index) within the payload
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True)

    if not isinstance(data, list):
        return bad_request("validation_error", "Request body must be a JSON array of question objects.")

    if len(data) == 0:
        return bad_request("validation_error", "Question array is empty.")

    if len(data) > 2000:
        return bad_request("validation_error", "Maximum 2,000 questions per import call.")

    allow_partial = request.args.get("allow_partial", "false").lower() == "true"
    valid_answers = {"a", "b", "c", "d"}

    # ── Validate each record ──
    seen_keys = set()
    errors    = []

    for i, q in enumerate(data):
        if not isinstance(q, dict):
            errors.append(f"[{i}] Must be an object.")
            continue

        exam      = (q.get("exam") or "").strip().lower()
        world_key = (q.get("world_key") or "").strip().lower()
        index     = q.get("index")

        if exam not in VALID_EXAMS:
            errors.append(f"[{i}] Invalid exam: {exam!r}.")
            continue

        if world_key not in VALID_WORLD_KEYS:
            errors.append(f"[{i}] Invalid world_key: {world_key!r}.")
            continue

        if world_key not in EXAM_WORLD_ORDER.get(exam, []):
            errors.append(f"[{i}] world_key {world_key!r} does not belong to exam {exam!r}.")
            continue

        if not isinstance(index, int) or index < 1:
            errors.append(f"[{i}] index must be a positive integer, got {index!r}.")
            continue

        if not allow_partial:
            max_index = get_total_questions(world_key)
            if index > max_index:
                errors.append(f"[{i}] index {index} exceeds max {max_index} for world_key {world_key!r}.")
                continue

        key = (exam, world_key, index)
        if key in seen_keys:
            errors.append(f"[{i}] Duplicate (exam, world_key, index) = {key} in payload.")
            continue
        seen_keys.add(key)

        for field in ("question_text", "option_a", "option_b", "option_c", "option_d"):
            if not q.get(field):
                errors.append(f"[{i}] Missing required field: {field!r}.")
                break

        correct = (q.get("correct_answer") or "a").strip().lower()
        if correct not in valid_answers:
            errors.append(f"[{i}] correct_answer must be a/b/c/d, got {correct!r}.")

    if errors:
        return bad_request("import_validation_failed",
                           f"{len(errors)} validation error(s).",
                           {"errors": errors[:50]})  # cap at 50 to avoid giant response

    # ── Upsert ──
    upserted = 0
    now = datetime.now(timezone.utc)

    for q in data:
        exam      = q["exam"].strip().lower()
        world_key = q["world_key"].strip().lower()
        index     = int(q["index"])

        existing = Question.query.filter_by(
            exam=exam, world_key=world_key, index=index
        ).first()

        correct_answer = (q.get("correct_answer") or "a").strip().lower()

        difficulty_raw = q.get("difficulty")
        difficulty     = None
        if difficulty_raw and difficulty_raw in {d.value for d in Difficulty}:
            difficulty = Difficulty(difficulty_raw)

        if existing:
            # Only update content fields — never overwrite a reviewed answer
            # unless the incoming record has a non-placeholder answer
            existing.question_text = q["question_text"]
            existing.option_a      = q["option_a"]
            existing.option_b      = q["option_b"]
            existing.option_c      = q["option_c"]
            existing.option_d      = q["option_d"]
            existing.topic         = q.get("topic") or existing.topic
            if difficulty:
                existing.difficulty = difficulty
            # Only update correct_answer if it's non-placeholder or existing is 'a' placeholder
            if correct_answer != "a" or existing.correct_answer == "a":
                existing.correct_answer = correct_answer
            existing.version            += 1
            existing.updated_by_admin_id = admin.id
            existing.updated_at          = now
        else:
            new_q = Question(
                exam=exam,
                world_key=world_key,
                index=index,
                question_text=q["question_text"],
                option_a=q["option_a"],
                option_b=q["option_b"],
                option_c=q["option_c"],
                option_d=q["option_d"],
                correct_answer=correct_answer,
                topic=q.get("topic"),
                difficulty=difficulty,
                is_active=False,   # requires admin review before going live
                created_by_admin_id=admin.id,
            )
            db.session.add(new_q)

        upserted += 1

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return bad_request("import_integrity_error",
                           "Database constraint violated during import.",
                           {"detail": str(e.orig)})

    return jsonify({
        "imported": upserted,
        "message":  f"Successfully upserted {upserted} question(s). "
                    "Questions are inactive by default — activate individually or in bulk.",
    }), 200


@admin_bp.route("/questions", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_questions():
    """
    List questions with filters.
    Query params: exam, world_key, is_active, page (default 1), per_page (default 50, max 200)
    """
    exam      = request.args.get("exam", "").strip().lower() or None
    world_key = request.args.get("world_key", "").strip().lower() or None
    is_active = request.args.get("is_active")
    page      = max(1, int(request.args.get("page", 1) or 1))
    per_page  = min(200, max(1, int(request.args.get("per_page", 50) or 50)))

    q = Question.query.filter(Question.deleted_at.is_(None))

    if exam:
        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
        q = q.filter(Question.exam == exam)

    if world_key:
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
        q = q.filter(Question.world_key == world_key)

    if is_active is not None:
        q = q.filter(Question.is_active == (is_active.lower() == "true"))

    q = q.order_by(Question.exam, Question.world_key, Question.index)

    items, total = _paginate(q, page, per_page)

    return jsonify({
        "questions": [item.to_dict(include_answer=True) for item in items],
        "total":     total,
        "page":      page,
        "per_page":  per_page,
        "pages":     (total + per_page - 1) // per_page,
    }), 200


@admin_bp.route("/questions/<int:question_id>", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_question(question_id: int):
    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


@admin_bp.route("/questions/<int:question_id>", methods=["PUT"])
@roles_required(*_ADMIN_ROLE)
def update_question(question_id: int):
    """
    Update question. Requires version in body for optimistic locking.
    Mismatch → 409 with current record in error.details.
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    # ── Optimistic lock check ──
    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required",
                           "version is required for question updates to prevent conflicts.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Question was modified by another admin (expected version {submitted_version}, "
            f"current version {q.version}). Reload and retry.",
            {"current_record": q.to_dict(include_answer=True)},
        )

    valid_answers = {"a", "b", "c", "d"}

    # ── Apply updates ──
    if "question_text" in data: q.question_text = data["question_text"]
    if "option_a"      in data: q.option_a      = data["option_a"]
    if "option_b"      in data: q.option_b      = data["option_b"]
    if "option_c"      in data: q.option_c      = data["option_c"]
    if "option_d"      in data: q.option_d      = data["option_d"]
    if "topic"         in data: q.topic         = data["topic"]
    if "is_active"     in data: q.is_active     = bool(data["is_active"])

    if "correct_answer" in data:
        ans = (data["correct_answer"] or "").strip().lower()
        if ans not in valid_answers:
            return bad_request("validation_error",
                               "correct_answer must be one of a/b/c/d.")
        q.correct_answer = ans
        # Mark as reviewed
        q.last_reviewed_at          = datetime.now(timezone.utc)
        q.last_reviewed_by_admin_id = admin.id

    if "difficulty" in data:
        diff = data["difficulty"]
        if diff and diff not in {d.value for d in Difficulty}:
            return bad_request("validation_error",
                               f"difficulty must be easy/medium/hard.")
        q.difficulty = Difficulty(diff) if diff else None

    q.version            += 1
    q.updated_by_admin_id = admin.id
    q.updated_at          = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


@admin_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@roles_required(*_ADMIN_ROLE)
def delete_question(question_id: int):
    """Soft delete — sets deleted_at timestamp."""
    admin = _get_current_user()
    q     = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    q.deleted_at          = datetime.now(timezone.utc)
    q.is_active            = False
    q.updated_by_admin_id = admin.id
    db.session.commit()
    return jsonify({"message": "Question deleted."}), 200


@admin_bp.route("/questions/<int:question_id>/activate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def toggle_question_active(question_id: int):
    """Toggle is_active. Body: { "is_active": true|false }"""
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}
    q     = Question.query.filter_by(id=question_id, deleted_at=None).first()

    if not q:
        return error_response("not_found", "Question not found.", 404)

    if "is_active" not in data:
        return bad_request("validation_error", "is_active (boolean) is required.")

    q.is_active            = bool(data["is_active"])
    q.updated_by_admin_id = admin.id
    q.version             += 1
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


# ═════════════════════════════════════════════════════════════════════════════
# ORGS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/orgs", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_org():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    name  = (data.get("name") or "").strip()
    slug  = (data.get("slug") or "").strip().lower()
    count = data.get("estimated_student_count")

    if not name:
        return bad_request("validation_error", "name is required.")
    if not slug:
        return bad_request("validation_error", "slug is required.")
    if len(slug) < 3 or len(slug) > 50:
        return bad_request("validation_error", "slug must be 3–50 characters.")
    if not slug.replace("-", "").replace("_", "").isalnum():
        return bad_request("validation_error",
                           "slug may only contain letters, numbers, hyphens, and underscores.")

    if Org.query.filter_by(slug=slug).first():
        return bad_request("slug_taken", f"Slug {slug!r} is already in use.")

    org = Org(
        name=name,
        slug=slug,
        estimated_student_count=int(count) if count else None,
        created_by_admin_id=admin.id,
    )
    db.session.add(org)
    db.session.commit()
    return jsonify({"org": org.to_dict()}), 201


@admin_bp.route("/orgs", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_orgs():
    page     = max(1, int(request.args.get("page", 1) or 1))
    per_page = min(100, max(1, int(request.args.get("per_page", 20) or 20)))

    q              = Org.query.order_by(Org.created_at.desc())
    items, total   = _paginate(q, page, per_page)

    result = []
    for org in items:
        d = org.to_dict()
        d["student_count"] = User.query.filter_by(
            org_id=org.id, role=UserRole.STUDENT
        ).count()
        result.append(d)

    return jsonify({
        "orgs":     result,
        "total":    total,
        "page":     page,
        "per_page": per_page,
    }), 200


@admin_bp.route("/orgs/<int:org_id>", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_org(org_id: int):
    org = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    d = org.to_dict()
    d["leader"] = None

    leader = User.query.filter_by(
        org_id=org_id, role=UserRole.SCHOOL_LEADER
    ).first()
    if leader:
        d["leader"] = leader.to_dict()

    d["student_count"] = User.query.filter_by(
        org_id=org_id, role=UserRole.STUDENT
    ).count()

    entitlements = Entitlement.query.filter_by(org_id=org_id).all()
    d["entitlements"] = [e.to_dict() for e in entitlements]

    return jsonify({"org": d}), 200


@admin_bp.route("/orgs/<int:org_id>/leader", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_leader(org_id: int):
    """Create one school_leader for this org. Only one leader per org."""
    admin = _get_current_user()
    org   = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    existing = User.query.filter_by(
        org_id=org_id, role=UserRole.SCHOOL_LEADER
    ).first()
    if existing:
        return bad_request("leader_exists",
                           f"Org {org.name} already has a school leader: {existing.username}.")

    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip() or None
    password = data.get("password") or _random_password(12)

    if not username:
        return bad_request("validation_error", "username is required.")
    if len(username) < 3 or len(username) > 80:
        return bad_request("validation_error", "username must be 3–80 characters.")

    if User.query.filter_by(username=username).first():
        return bad_request("username_taken", f"Username {username!r} is taken.")
    if email and User.query.filter_by(email=email).first():
        return bad_request("email_taken", "That email is already registered.")

    leader = User(
        username=username,
        email=email,
        role=UserRole.SCHOOL_LEADER,
        org_id=org_id,
        created_by_admin_id=admin.id,
    )
    leader.set_password(password)
    db.session.add(leader)
    db.session.commit()

    result = leader.to_dict()
    result["generated_password"] = password  # Only returned once — log or store securely
    return jsonify({"leader": result}), 201


@admin_bp.route("/orgs/<int:org_id>/students/generate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def generate_students(org_id: int):
    """
    Bulk-generate student accounts for an org.

    Body: { "count": int (1–500) }

    Returns the full list of { username, password } pairs.
    Passwords are returned ONCE and are NOT stored in plaintext.
    Frontend must trigger immediate CSV download from this response.
    """
    admin = _get_current_user()
    org   = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    data  = request.get_json(silent=True) or {}
    count = data.get("count")

    if not isinstance(count, int) or count < 1 or count > 500:
        return bad_request("validation_error",
                           "count must be an integer between 1 and 500.")

    # Determine next student number for this org
    existing_count = User.query.filter_by(
        org_id=org_id, role=UserRole.STUDENT
    ).count()

    generated = []

    for i in range(count):
        num      = existing_count + i + 1
        username = f"{org.slug}_s{num:04d}"
        password = _random_password(10)

        # Ensure username uniqueness (rare collision safety)
        while User.query.filter_by(username=username).first():
            username = f"{org.slug}_s{num:04d}_{_random_username_suffix(3)}"

        student = User(
            username=username,
            email=None,
            role=UserRole.STUDENT,
            org_id=org_id,
            created_by_admin_id=admin.id,
        )
        student.set_password(password)
        db.session.add(student)
        generated.append({"username": username, "password": password})

    db.session.commit()

    return jsonify({
        "generated": len(generated),
        "org_id":    org_id,
        "org_name":  org.name,
        "students":  generated,
        "warning":   "Passwords are shown once and not stored in plaintext. Download CSV immediately.",
    }), 201


@admin_bp.route("/orgs/<int:org_id>/students/export", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def export_students(org_id: int):
    """
    Export student account list as CSV.
    Passwords are NOT included (one-time only at generation).
    """
    org = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    students = (
        User.query
        .filter_by(org_id=org_id, role=UserRole.STUDENT)
        .order_by(User.created_at.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["username", "email", "is_active", "org", "created_at"])
    for s in students:
        writer.writerow([
            s.username,
            s.email or "",
            "yes" if s.is_active else "no",
            org.name,
            s.created_at.strftime("%Y-%m-%d %H:%M UTC"),
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{org.slug}_students.csv"'
        },
    )


@admin_bp.route("/orgs/<int:org_id>/entitlement", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def grant_org_entitlement(org_id: int):
    """
    Grant an org-level entitlement (manual, after school deal signed).
    Body: { exam, plan_id: basic|premium, duration_days: int }
    """
    admin = _get_current_user()
    org   = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    data         = request.get_json(silent=True) or {}
    exam         = (data.get("exam") or "").strip().lower()
    plan_id_str  = (data.get("plan_id") or "").strip().lower()
    duration_days = data.get("duration_days")

    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", f"exam must be one of {sorted(VALID_EXAMS)}.")

    if plan_id_str not in ("basic", "premium"):
        return bad_request("invalid_plan_id", "plan_id must be basic or premium.")

    if not isinstance(duration_days, int) or duration_days < 1:
        return bad_request("validation_error", "duration_days must be a positive integer.")

    plan_id       = PlanId(plan_id_str)
    max_world_idx = PLAN_WORLD_LIMIT[plan_id_str]
    now           = datetime.now(timezone.utc)
    expiry        = now + timedelta(days=duration_days)

    ent = Entitlement(
        org_id=org_id,
        user_id=None,
        exam=exam,
        plan_id=plan_id,
        plan_type=PlanType.SCHOOL_PREMIUM_1Y,
        max_world_index=max_world_idx,
        entitlement_starts_at=now,
        entitlement_expires_at=expiry,
    )
    db.session.add(ent)
    db.session.commit()
    return jsonify({"entitlement": ent.to_dict()}), 201


# ═════════════════════════════════════════════════════════════════════════════
# USERS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/users", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_users():
    role     = request.args.get("role", "").strip().lower() or None
    page     = max(1, int(request.args.get("page", 1) or 1))
    per_page = min(100, max(1, int(request.args.get("per_page", 50) or 50)))
    search   = request.args.get("q", "").strip() or None

    q = User.query

    if role:
        try:
            q = q.filter(User.role == UserRole(role))
        except ValueError:
            return bad_request("invalid_role", f"Invalid role: {role!r}.")

    if search:
        q = q.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )

    q = q.order_by(User.created_at.desc())
    items, total = _paginate(q, page, per_page)

    return jsonify({
        "users":    [u.to_dict() for u in items],
        "total":    total,
        "page":     page,
        "per_page": per_page,
    }), 200


@admin_bp.route("/users", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_admin_user():
    """
    Create a new drfahm_admin account.
    Enforces MAX_DRFAHM_ADMINS cap.
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    email    = (data.get("email") or "").strip() or None
    password = (data.get("password") or "").strip()

    if not username or len(username) < 3:
        return bad_request("validation_error", "username must be at least 3 characters.")
    if not password or len(password) < 8:
        return bad_request("validation_error", "password must be at least 8 characters.")

    # Enforce admin cap
    current_admin_count = User.query.filter_by(
        role=UserRole.DRFAHM_ADMIN, is_active=True
    ).count()
    max_admins = current_app.config["MAX_DRFAHM_ADMINS"]

    if current_admin_count >= max_admins:
        return forbidden(
            "admin_cap_reached",
            f"Maximum of {max_admins} DrFahm admin accounts allowed. "
            f"Deactivate an existing admin first."
        )

    if User.query.filter_by(username=username).first():
        return bad_request("username_taken", "That username is already taken.")
    if email and User.query.filter_by(email=email).first():
        return bad_request("email_taken", "That email is already registered.")

    new_admin = User(
        username=username,
        email=email,
        role=UserRole.DRFAHM_ADMIN,
        created_by_admin_id=admin.id,
    )
    new_admin.set_password(password)
    db.session.add(new_admin)
    db.session.commit()
    return jsonify({"user": new_admin.to_dict()}), 201


@admin_bp.route("/users/<int:user_id>/activate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def activate_user(user_id: int):
    user = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)
    user.is_active  = True
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def deactivate_user(user_id: int):
    admin = _get_current_user()
    user  = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)
    if user.id == admin.id:
        return bad_request("cannot_deactivate_self",
                           "You cannot deactivate your own account.")
    user.is_active  = False
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def reset_user_password(user_id: int):
    """
    Reset a user's password.
    Body: { "new_password": str } — or omit to auto-generate.
    Returns the new password in the response (one-time only).
    """
    data  = request.get_json(silent=True) or {}
    user  = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)

    new_password = (data.get("new_password") or "").strip() or _random_password(12)

    if len(new_password) < 8:
        return bad_request("validation_error",
                           "new_password must be at least 8 characters.")

    user.set_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "message":      "Password reset successfully.",
        "new_password": new_password,
        "warning":      "This password is shown once and not stored in plaintext.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# STATS (lightweight dashboard numbers)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stats", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_stats():
    from ..models.billing import StripeEvent
    from ..models.entitlement import ExamTrial, Entitlement

    total_students    = User.query.filter_by(role=UserRole.STUDENT).count()
    active_students   = User.query.filter_by(role=UserRole.STUDENT, is_active=True).count()
    total_orgs        = Org.query.count()
    total_questions   = Question.query.filter(Question.deleted_at.is_(None)).count()
    active_questions  = Question.query.filter(
        Question.deleted_at.is_(None), Question.is_active == True
    ).count()
    now               = datetime.now(timezone.utc)
    active_ents       = Entitlement.query.filter(
        Entitlement.entitlement_expires_at > now
    ).count()
    active_trials     = ExamTrial.query.filter(
        ExamTrial.trial_expires_at > now
    ).count()
    stripe_revenue_events = StripeEvent.query.filter_by(
        event_type="checkout.session.completed", status="processed"
    ).count()

    return jsonify({
        "students":        {"total": total_students, "active": active_students},
        "orgs":            {"total": total_orgs},
        "questions":       {"total": total_questions, "active": active_questions},
        "entitlements":    {"active": active_ents},
        "trials":          {"active": active_trials},
        "stripe_payments": stripe_revenue_events,
    }), 200