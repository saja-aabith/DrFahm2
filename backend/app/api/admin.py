"""
Admin API — drfahm_admin only.

All routes require role=drfahm_admin (enforced by @roles_required decorator).

Endpoints:
  Questions
    POST   /api/admin/questions/import
    GET    /api/admin/questions/next-index
    GET    /api/admin/questions/review-progress
    GET    /api/admin/questions/topic-coverage        ← NEW
    GET    /api/admin/questions                        (+ search, topic, reviewed params)
    GET    /api/admin/questions/:id
    PUT    /api/admin/questions/:id          (optimistic lock on version)
    DELETE /api/admin/questions/:id          (soft delete)
    PATCH  /api/admin/questions/:id/activate
    PATCH  /api/admin/questions/:id/mark-reviewed      ← NEW
    POST   /api/admin/questions/bulk-activate
    POST   /api/admin/questions/bulk-topic             ← NEW

  Topics
    GET    /api/admin/topics                           ← NEW

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

  Stats
    GET    /api/admin/stats
"""

import csv
import io
import random
import string
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, current_app, Response
from sqlalchemy import func, case
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
from ..utils.topic_config import (
    TOPIC_TAXONOMY, ALL_TOPIC_KEYS, TOPIC_KEY_TO_LABEL,
    get_section_from_world_key, get_topics_for_world_key,
    validate_topic, get_api_taxonomy,
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
# TOPICS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/topics", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_topics():
    """
    Returns the full topic taxonomy.

    Optional filter: ?section=math (only return topics for that section)

    Response:
    {
        "taxonomy": {
            "math": [{"key": "algebra", "label": "Algebra"}, ...],
            "verbal": [{"key": "synonyms", "label": "Synonyms"}, ...],
            ...
        }
    }
    """
    section = request.args.get("section", "").strip().lower() or None

    taxonomy = get_api_taxonomy()

    if section:
        if section not in taxonomy:
            return bad_request("invalid_section",
                               f"Invalid section: {section!r}. "
                               f"Valid: {sorted(taxonomy.keys())}")
        taxonomy = {section: taxonomy[section]}

    return jsonify({"taxonomy": taxonomy}), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTIONS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/import", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def import_questions():
    """
    Bulk import / upsert questions.

    Body: JSON array of question objects.
    Upsert key: (exam, world_key, index) — UNIQUE constraint.

    Each item must have:
      exam, world_key, index, question_text, option_a..d, correct_answer

    Optional:
      topic, difficulty, is_active (default false), image_url, explanation
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True)

    if not isinstance(data, list) or len(data) == 0:
        return bad_request("validation_error",
                           "Body must be a non-empty JSON array of question objects.")
    if len(data) > 5000:
        return bad_request("validation_error",
                           "Maximum 5,000 questions per import call.")

    required_fields = {"exam", "world_key", "index", "question_text",
                       "option_a", "option_b", "option_c", "option_d",
                       "correct_answer"}
    valid_answers   = {"a", "b", "c", "d"}
    now             = datetime.now(timezone.utc)
    upserted        = 0

    for i, item in enumerate(data):
        missing = required_fields - set(item.keys())
        if missing:
            return bad_request("validation_error",
                               f"Item {i}: missing fields: {sorted(missing)}")

        exam      = str(item["exam"]).strip().lower()
        world_key = str(item["world_key"]).strip().lower()
        idx       = int(item["index"])
        answer    = str(item["correct_answer"]).strip().lower()

        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Item {i}: invalid exam {exam!r}.")
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Item {i}: invalid world_key {world_key!r}.")
        if answer not in valid_answers:
            return bad_request("validation_error",
                               f"Item {i}: correct_answer must be a/b/c/d.")

        # Validate topic if provided
        topic = (item.get("topic") or "").strip() or None
        if topic and not validate_topic(topic, world_key):
            return bad_request("invalid_topic",
                               f"Item {i}: invalid topic {topic!r} for section "
                               f"{get_section_from_world_key(world_key)!r}.")

        existing = Question.query.filter_by(
            exam=exam, world_key=world_key, index=idx
        ).first()

        if existing:
            existing.question_text = item["question_text"]
            existing.option_a      = item["option_a"]
            existing.option_b      = item["option_b"]
            existing.option_c      = item["option_c"]
            existing.option_d      = item["option_d"]
            existing.correct_answer = answer
            existing.topic         = topic
            existing.image_url     = item.get("image_url") or existing.image_url
            if "explanation" in item:
                existing.explanation = (item["explanation"] or "").strip() or existing.explanation
            diff = (item.get("difficulty") or "").strip().lower()
            if diff and diff in {d.value for d in Difficulty}:
                existing.difficulty = Difficulty(diff)
            if "is_active" in item:
                existing.is_active = bool(item["is_active"])
            existing.updated_by_admin_id = admin.id
            existing.updated_at          = now
            existing.version            += 1
        else:
            diff = (item.get("difficulty") or "").strip().lower()
            q = Question(
                exam=exam, world_key=world_key, index=idx,
                question_text=item["question_text"],
                option_a=item["option_a"], option_b=item["option_b"],
                option_c=item["option_c"], option_d=item["option_d"],
                correct_answer=answer,
                topic=topic,
                explanation=(item.get("explanation") or "").strip() or None,
                image_url=item.get("image_url"),
                difficulty=Difficulty(diff) if diff and diff in {d.value for d in Difficulty} else None,
                is_active=bool(item.get("is_active", False)),
                created_by_admin_id=admin.id,
                updated_by_admin_id=admin.id,
            )
            db.session.add(q)
        upserted += 1

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return bad_request("import_conflict",
                           "Duplicate or constraint violation during import.",
                           {"detail": str(e.orig)})

    return jsonify({
        "imported": upserted,
        "message":  f"Successfully upserted {upserted} question(s). "
                    "Questions are inactive by default — activate individually or in bulk.",
    }), 200


@admin_bp.route("/questions/next-index", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_next_index():
    """
    Returns the next available index for a given exam + world_key.
    GET /api/admin/questions/next-index?exam=qudurat&world_key=math_100
    Response: { "next_index": 101 }
    """
    exam      = (request.args.get("exam") or "").strip().lower()
    world_key = (request.args.get("world_key") or "").strip().lower()

    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
    if world_key not in VALID_WORLD_KEYS:
        return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")

    max_idx = db.session.query(func.max(Question.index)).filter(
        Question.exam      == exam,
        Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).scalar()

    next_index = (max_idx or 0) + 1
    return jsonify({"exam": exam, "world_key": world_key, "next_index": next_index}), 200


@admin_bp.route("/questions/review-progress", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def review_progress():
    """
    Returns review progress per exam/world.
    A question is 'reviewed' if last_reviewed_at IS NOT NULL.
    This is set when an admin explicitly confirms or changes the correct answer.

    This approach treats all answer options (a/b/c/d) equally — no bias.

    Optional filter: ?exam=qudurat
    """
    exam_filter = request.args.get("exam", "").strip().lower() or None

    q = db.session.query(
        Question.exam,
        Question.world_key,
        func.count(Question.id).label("total"),
        func.sum(
            case(
                (Question.last_reviewed_at.isnot(None), 1),
                else_=0,
            )
        ).label("reviewed"),
    ).filter(
        Question.deleted_at.is_(None),
    ).group_by(
        Question.exam,
        Question.world_key,
    ).order_by(
        Question.exam,
        Question.world_key,
    )

    if exam_filter:
        if exam_filter not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")
        q = q.filter(Question.exam == exam_filter)

    rows = q.all()

    progress = []
    total_all = 0
    reviewed_all = 0

    for row in rows:
        reviewed = int(row.reviewed or 0)
        total = int(row.total or 0)
        progress.append({
            "exam": row.exam,
            "world_key": row.world_key,
            "total": total,
            "reviewed": reviewed,
            "unreviewed": total - reviewed,
        })
        total_all += total
        reviewed_all += reviewed

    return jsonify({
        "progress": progress,
        "summary": {
            "total": total_all,
            "reviewed": reviewed_all,
            "unreviewed": total_all - reviewed_all,
        },
    }), 200


@admin_bp.route("/questions/topic-coverage", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def topic_coverage():
    """
    Returns topic coverage stats — how many questions are tagged per topic.

    Optional filters: ?exam=qudurat&section=math

    Response: {
        "coverage": [
            { "topic": "algebra", "label": "Algebra", "section": "math", "count": 142 },
            { "topic": "geometry", "label": "Geometry", "section": "math", "count": 87 },
            ...
        ],
        "summary": {
            "total": 2100,
            "tagged": 860,
            "untagged": 1240
        }
    }
    """
    exam_filter    = request.args.get("exam", "").strip().lower() or None
    section_filter = request.args.get("section", "").strip().lower() or None

    # Total + untagged count
    base_q = Question.query.filter(Question.deleted_at.is_(None))
    if exam_filter:
        if exam_filter not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")
        base_q = base_q.filter(Question.exam == exam_filter)

    total = base_q.count()
    untagged = base_q.filter(
        (Question.topic.is_(None)) | (Question.topic == "")
    ).count()

    # Per-topic counts
    topic_q = db.session.query(
        Question.topic,
        func.count(Question.id).label("count"),
    ).filter(
        Question.deleted_at.is_(None),
        Question.topic.isnot(None),
        Question.topic != "",
    )

    if exam_filter:
        topic_q = topic_q.filter(Question.exam == exam_filter)

    if section_filter:
        # Filter to world_keys that match the section prefix
        if section_filter not in TOPIC_TAXONOMY:
            return bad_request("invalid_section",
                               f"Invalid section: {section_filter!r}.")
        matching_worlds = [
            wk for wk in VALID_WORLD_KEYS
            if get_section_from_world_key(wk) == section_filter
        ]
        topic_q = topic_q.filter(Question.world_key.in_(matching_worlds))

    topic_q = topic_q.group_by(Question.topic).order_by(func.count(Question.id).desc())
    rows = topic_q.all()

    coverage = []
    for row in rows:
        topic_key = row.topic
        # Determine section from topic key
        section = None
        for sec, topics in TOPIC_TAXONOMY.items():
            if topic_key in {k for k, _ in topics}:
                section = sec
                break
        coverage.append({
            "topic": topic_key,
            "label": TOPIC_KEY_TO_LABEL.get(topic_key, topic_key),
            "section": section,
            "count": int(row.count),
        })

    return jsonify({
        "coverage": coverage,
        "summary": {
            "total": total,
            "tagged": total - untagged,
            "untagged": untagged,
        },
    }), 200


@admin_bp.route("/questions", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_questions():
    """
    List questions with filters.
    Query params: exam, world_key, is_active, difficulty, topic, reviewed,
                  search, page (default 1), per_page (default 50, max 200)

    Special filter values:
      topic=_untagged  → questions with no topic assigned
      reviewed=true    → questions with last_reviewed_at set
      reviewed=false   → questions not yet reviewed
    """
    exam       = request.args.get("exam", "").strip().lower() or None
    world_key  = request.args.get("world_key", "").strip().lower() or None
    section    = request.args.get("section", "").strip().lower() or None
    is_active  = request.args.get("is_active")
    difficulty = request.args.get("difficulty", "").strip().lower() or None
    topic      = request.args.get("topic", "").strip().lower() or None
    reviewed   = request.args.get("reviewed", "").strip().lower() or None
    search     = request.args.get("search", "").strip() or None
    page       = max(1, int(request.args.get("page", 1) or 1))
    per_page   = min(200, max(1, int(request.args.get("per_page", 50) or 50)))

    q = Question.query.filter(Question.deleted_at.is_(None))

    if exam:
        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
        q = q.filter(Question.exam == exam)

    if world_key:
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
        q = q.filter(Question.world_key == world_key)
    elif section:
        # Filter by section prefix (e.g. section=math → world_key LIKE 'math_%')
        valid_sections = {"math", "verbal", "biology", "chemistry", "physics"}
        if section in valid_sections:
            q = q.filter(Question.world_key.like(f"{section}_%"))

    if is_active is not None:
        q = q.filter(Question.is_active == (is_active.lower() == "true"))

    if difficulty:
        if difficulty in {d.value for d in Difficulty}:
            q = q.filter(Question.difficulty == Difficulty(difficulty))

    if topic:
        if topic == "_untagged":
            q = q.filter((Question.topic.is_(None)) | (Question.topic == ""))
        elif topic in ALL_TOPIC_KEYS:
            q = q.filter(Question.topic == topic)
        else:
            return bad_request("invalid_topic", f"Invalid topic filter: {topic!r}.")

    if reviewed:
        if reviewed == "true":
            q = q.filter(Question.last_reviewed_at.isnot(None))
        elif reviewed == "false":
            q = q.filter(Question.last_reviewed_at.is_(None))

    if search:
        q = q.filter(Question.question_text.ilike(f"%{search}%"))

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
    if "is_active"     in data: q.is_active     = bool(data["is_active"])

    if "topic" in data:
        topic_val = (data["topic"] or "").strip() or None
        if topic_val and not validate_topic(topic_val, q.world_key):
            section = get_section_from_world_key(q.world_key)
            valid_topics = [k for k, _ in TOPIC_TAXONOMY.get(section, [])]
            return bad_request(
                "invalid_topic",
                f"Topic {topic_val!r} is not valid for section {section!r}. "
                f"Valid topics: {valid_topics}"
            )
        q.topic = topic_val

    if "image_url" in data:
        img = data["image_url"]
        if img:
            if len(img) > 700_000:
                return bad_request("image_too_large",
                                   "Image must be under 500KB.")
            if not (img.startswith("data:image/") or img.startswith("http")):
                return bad_request("invalid_image",
                                   "image_url must be a data URL or HTTP URL.")
        q.image_url = img or None

    if "explanation" in data:
        q.explanation = (data["explanation"] or "").strip() or None

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
                               f"difficulty must be easy/hard.")
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


@admin_bp.route("/questions/<int:question_id>/mark-reviewed", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def mark_question_reviewed(question_id: int):
    """
    Explicitly mark a question as reviewed without changing any content.
    Used when admin confirms the current answer is correct (e.g. answer IS 'a').

    This solves the bug where questions with correct_answer='a' couldn't
    be counted as reviewed. Now review status is tracked via last_reviewed_at
    timestamp, independent of which answer option is correct.

    Body: { "version": int }  (required for optimistic locking)
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required",
                           "version is required for optimistic locking.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Question was modified by another admin (expected version {submitted_version}, "
            f"current version {q.version}). Reload and retry.",
            {"current_record": q.to_dict(include_answer=True)},
        )

    now = datetime.now(timezone.utc)
    q.last_reviewed_at          = now
    q.last_reviewed_by_admin_id = admin.id
    q.updated_by_admin_id       = admin.id
    q.updated_at                = now
    q.version                  += 1

    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK QUESTION ACTIONS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-activate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_activate_questions():
    """
    Bulk activate or deactivate questions matching filters.

    Body:
    {
      "is_active": true|false,     -- required: target state
      "exam": "qudurat"|"tahsili", -- optional filter
      "world_key": "math_100",     -- optional filter
      "ids": [1,2,3]               -- optional: explicit list of question IDs
                                      (if provided, exam/world_key filters ignored)
    }

    Returns count of affected rows.
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    if "is_active" not in data:
        return bad_request("validation_error", "is_active (boolean) is required.")

    is_active  = bool(data["is_active"])
    exam       = (data.get("exam") or "").strip().lower() or None
    world_key  = (data.get("world_key") or "").strip().lower() or None
    ids        = data.get("ids")  # optional explicit list

    now = datetime.now(timezone.utc)

    q = Question.query.filter(Question.deleted_at.is_(None))

    if ids:
        if not isinstance(ids, list) or len(ids) == 0:
            return bad_request("validation_error", "ids must be a non-empty array.")
        if len(ids) > 2000:
            return bad_request("validation_error", "Maximum 2,000 IDs per bulk call.")
        q = q.filter(Question.id.in_(ids))
    else:
        if exam:
            if exam not in VALID_EXAMS:
                return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
            q = q.filter(Question.exam == exam)
        if world_key:
            if world_key not in VALID_WORLD_KEYS:
                return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
            q = q.filter(Question.world_key == world_key)

    affected = q.update(
        {
            "is_active":            is_active,
            "updated_by_admin_id":  admin.id,
            "updated_at":           now,
        },
        synchronize_session=False,
    )
    db.session.commit()

    action = "activated" if is_active else "deactivated"
    return jsonify({
        "affected": affected,
        "message":  f"{affected} question(s) {action}.",
        "is_active": is_active,
    }), 200


@admin_bp.route("/questions/bulk-topic", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_assign_topic():
    """
    Bulk assign a topic to questions matching filters or explicit IDs.

    Body:
    {
      "topic": "algebra",              -- required: topic key (or null to clear)
      "exam": "qudurat"|"tahsili",     -- optional filter
      "world_key": "math_100",         -- optional filter
      "ids": [1,2,3]                   -- optional: explicit list of question IDs
    }

    Returns count of affected rows.
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    topic_val = (data.get("topic") or "").strip() or None
    exam      = (data.get("exam") or "").strip().lower() or None
    world_key = (data.get("world_key") or "").strip().lower() or None
    ids       = data.get("ids")

    # Validate topic exists in taxonomy (unless clearing)
    if topic_val and topic_val not in ALL_TOPIC_KEYS:
        return bad_request("invalid_topic",
                           f"Invalid topic: {topic_val!r}. "
                           f"Must be a valid topic key from the taxonomy.")

    now = datetime.now(timezone.utc)

    q = Question.query.filter(Question.deleted_at.is_(None))

    if ids:
        if not isinstance(ids, list) or len(ids) == 0:
            return bad_request("validation_error", "ids must be a non-empty array.")
        if len(ids) > 2000:
            return bad_request("validation_error", "Maximum 2,000 IDs per bulk call.")
        q = q.filter(Question.id.in_(ids))
    else:
        if exam:
            if exam not in VALID_EXAMS:
                return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
            q = q.filter(Question.exam == exam)
        if world_key:
            if world_key not in VALID_WORLD_KEYS:
                return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
            q = q.filter(Question.world_key == world_key)

    affected = q.update(
        {
            "topic":                topic_val,
            "updated_by_admin_id":  admin.id,
            "updated_at":           now,
        },
        synchronize_session=False,
    )
    db.session.commit()

    label = TOPIC_KEY_TO_LABEL.get(topic_val, topic_val) if topic_val else "none"
    return jsonify({
        "affected": affected,
        "topic": topic_val,
        "message": f"{affected} question(s) topic set to {label}.",
    }), 200


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

    existing = Org.query.filter_by(slug=slug).first()
    if existing:
        return conflict(f"An org with slug {slug!r} already exists.")

    org = Org(
        name=name,
        slug=slug,
        estimated_student_count=count,
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
    search   = request.args.get("search", "").strip()

    q = Org.query
    if search:
        q = q.filter(Org.name.ilike(f"%{search}%") | Org.slug.ilike(f"%{search}%"))
    q = q.order_by(Org.created_at.desc())

    items, total = _paginate(q, page, per_page)
    return jsonify({
        "orgs": [o.to_dict() for o in items],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200


@admin_bp.route("/orgs/<int:org_id>", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_org(org_id: int):
    org = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    leader = User.query.filter_by(org_id=org.id, role=UserRole.SCHOOL_LEADER).first()
    students = User.query.filter_by(org_id=org.id, role=UserRole.STUDENT).all()
    entitlements = Entitlement.query.filter_by(org_id=org.id).order_by(Entitlement.created_at.desc()).all()

    return jsonify({
        "org": org.to_dict(),
        "leader": leader.to_dict() if leader else None,
        "students": [s.to_dict() for s in students],
        "entitlements": [e.to_dict() for e in entitlements],
    }), 200


@admin_bp.route("/orgs/<int:org_id>/leader", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_org_leader(org_id: int):
    admin = _get_current_user()
    org   = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    existing_leader = User.query.filter_by(org_id=org.id, role=UserRole.SCHOOL_LEADER).first()
    if existing_leader:
        return conflict("This org already has a leader.")

    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or _random_password()

    if not username:
        return bad_request("validation_error", "username is required.")
    if len(username) < 3:
        return bad_request("validation_error", "username must be at least 3 characters.")

    dup = User.query.filter_by(username=username).first()
    if dup:
        return conflict(f"Username {username!r} already taken.")

    leader = User(username=username, role=UserRole.SCHOOL_LEADER, org_id=org.id)
    leader.set_password(password)
    db.session.add(leader)
    db.session.commit()

    return jsonify({
        "user": leader.to_dict(),
        "password": password,
        "message": "Leader created. Save the password — it cannot be retrieved later.",
    }), 201


@admin_bp.route("/orgs/<int:org_id>/students/generate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def generate_students(org_id: int):
    admin = _get_current_user()
    org   = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    data  = request.get_json(silent=True) or {}
    count = data.get("count", 10)
    if not isinstance(count, int) or count < 1 or count > 500:
        return bad_request("validation_error", "count must be 1–500.")

    prefix = org.slug[:8]
    created = []

    for _ in range(count):
        attempts = 0
        while attempts < 10:
            suffix   = _random_username_suffix()
            username = f"{prefix}_{suffix}"
            if not User.query.filter_by(username=username).first():
                break
            attempts += 1
        else:
            continue

        password = _random_password()
        student  = User(username=username, role=UserRole.STUDENT, org_id=org.id)
        student.set_password(password)
        db.session.add(student)
        created.append({"username": username, "password": password})

    db.session.commit()
    return jsonify({
        "created": len(created),
        "students": created,
        "message": f"{len(created)} student accounts created for {org.name}.",
    }), 201


@admin_bp.route("/orgs/<int:org_id>/students/export", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def export_students_csv(org_id: int):
    org = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    students = User.query.filter_by(org_id=org.id, role=UserRole.STUDENT).order_by(User.username).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["username", "role", "is_active", "created_at"])
    for s in students:
        writer.writerow([s.username, s.role.value, s.is_active, s.created_at.isoformat()])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={org.slug}_students.csv"},
    )


@admin_bp.route("/orgs/<int:org_id>/entitlement", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def grant_org_entitlement(org_id: int):
    admin = _get_current_user()
    org   = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    data = request.get_json(silent=True) or {}
    exam        = (data.get("exam") or "").strip().lower()
    plan_id     = (data.get("plan_id") or "").strip().lower()
    days        = data.get("duration_days", 365)

    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
    if plan_id not in ("basic", "premium"):
        return bad_request("validation_error", "plan_id must be 'basic' or 'premium'.")
    if not isinstance(days, int) or days < 1:
        return bad_request("validation_error", "duration_days must be a positive integer.")

    now     = datetime.now(timezone.utc)
    expires = now + timedelta(days=days)

    plan_type_map = {
        "basic":   PlanType.ORG_BASIC,
        "premium": PlanType.ORG_PREMIUM,
    }

    ent = Entitlement(
        org_id=org.id,
        exam=exam,
        plan_id=PlanId(plan_id),
        plan_type=plan_type_map[plan_id],
        max_world_index=PLAN_WORLD_LIMIT[plan_id],
        entitlement_starts_at=now,
        entitlement_expires_at=expires,
        granted_by_admin_id=admin.id,
    )
    db.session.add(ent)
    db.session.commit()

    return jsonify({
        "entitlement": ent.to_dict(),
        "message": f"Org {org.name!r} granted {plan_id} plan for {exam} ({days} days).",
    }), 201


# ═════════════════════════════════════════════════════════════════════════════
# USERS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/users", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_users():
    page     = max(1, int(request.args.get("page", 1) or 1))
    per_page = min(200, max(1, int(request.args.get("per_page", 50) or 50)))
    role     = request.args.get("role", "").strip().lower()
    search   = request.args.get("search", "").strip()

    q = User.query
    if role:
        try:
            q = q.filter(User.role == UserRole(role))
        except ValueError:
            return bad_request("invalid_role", f"Invalid role: {role!r}.")
    if search:
        q = q.filter(User.username.ilike(f"%{search}%"))
    q = q.order_by(User.created_at.desc())

    items, total = _paginate(q, page, per_page)
    return jsonify({
        "users": [u.to_dict() for u in items],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200


@admin_bp.route("/users", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_admin_user():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    username = (data.get("username") or "").strip()
    password = data.get("password") or _random_password()

    if not username:
        return bad_request("validation_error", "username is required.")
    if len(username) < 3:
        return bad_request("validation_error", "username must be at least 3 characters.")

    max_admins = current_app.config.get("MAX_DRFAHM_ADMINS", 5)
    current_count = User.query.filter_by(role=UserRole.DRFAHM_ADMIN).count()
    if current_count >= max_admins:
        return forbidden(f"Maximum {max_admins} admin accounts allowed.")

    dup = User.query.filter_by(username=username).first()
    if dup:
        return conflict(f"Username {username!r} already taken.")

    new_admin = User(username=username, role=UserRole.DRFAHM_ADMIN)
    new_admin.set_password(password)
    db.session.add(new_admin)
    db.session.commit()

    return jsonify({
        "user": new_admin.to_dict(),
        "password": password,
        "message": "Admin created. Save the password — it cannot be retrieved later.",
    }), 201


@admin_bp.route("/users/<int:user_id>/activate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def activate_user(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def deactivate_user(user_id: int):
    user = User.query.get(user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def reset_user_password(user_id: int):
    data = request.get_json(silent=True) or {}
    user = User.query.get(user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)

    new_password = data.get("password") or _random_password()
    user.set_password(new_password)
    db.session.commit()

    return jsonify({
        "user": user.to_dict(),
        "password": new_password,
        "message": "Password reset. Save it — it cannot be retrieved later.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# STATS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stats", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_stats():
    now = datetime.now(timezone.utc)

    total_questions = Question.query.filter(Question.deleted_at.is_(None)).count()
    active_questions = Question.query.filter(
        Question.deleted_at.is_(None), Question.is_active == True
    ).count()

    total_users = User.query.filter_by(role=UserRole.STUDENT).count()
    total_orgs  = Org.query.count()

    active_entitlements = Entitlement.query.filter(
        Entitlement.entitlement_expires_at > now
    ).count()

    questions_per_exam = dict(
        db.session.query(Question.exam, func.count(Question.id))
        .filter(Question.deleted_at.is_(None))
        .group_by(Question.exam)
        .all()
    )

    return jsonify({
        "questions": {
            "total": total_questions,
            "active": active_questions,
            "per_exam": questions_per_exam,
        },
        "users": {
            "students": total_users,
        },
        "orgs": {
            "total": total_orgs,
        },
        "entitlements": {
            "active": active_entitlements,
        },
    }), 200