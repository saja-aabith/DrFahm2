"""
Admin API — drfahm_admin only.

All routes require role=drfahm_admin (enforced by @roles_required decorator).

Endpoints:
  Questions
    POST   /api/admin/questions/import
    GET    /api/admin/questions/bulk-template
    POST   /api/admin/questions/bulk-validate
    POST   /api/admin/questions/bulk-commit
    POST   /api/admin/questions/bulk-delete
    POST   /api/admin/questions/bulk-assign
    POST   /api/admin/questions/ai-review               (Chunk J)
    GET    /api/admin/questions/next-index
    GET    /api/admin/questions/review-progress
    GET    /api/admin/questions/topic-coverage
    POST   /api/admin/questions/find-duplicates         (Chunk K3)
    GET    /api/admin/questions
    GET    /api/admin/questions/:id
    PUT    /api/admin/questions/:id
    DELETE /api/admin/questions/:id
    PATCH  /api/admin/questions/:id/activate
    PATCH  /api/admin/questions/:id/mark-reviewed
    PATCH  /api/admin/questions/:id/approve-review      (Chunk J + K1)
    PATCH  /api/admin/questions/:id/reject-review       (Chunk J)
    POST   /api/admin/questions/bulk-activate
    POST   /api/admin/questions/bulk-topic

  Topics
    GET    /api/admin/topics

  Worlds  (Chunk K2)
    GET    /api/admin/worlds/health
    POST   /api/admin/worlds/:worldKey/smart-fill
    POST   /api/admin/worlds/:worldKey/clear

  Orgs
    POST   /api/admin/orgs
    GET    /api/admin/orgs
    GET    /api/admin/orgs/:org_id
    POST   /api/admin/orgs/:org_id/leader
    POST   /api/admin/orgs/:org_id/students/generate
    GET    /api/admin/orgs/:org_id/students/export
    POST   /api/admin/orgs/:org_id/entitlement

  Users
    GET    /api/admin/users
    POST   /api/admin/users
    PATCH  /api/admin/users/:user_id/activate
    PATCH  /api/admin/users/:user_id/deactivate
    POST   /api/admin/users/:user_id/reset-password
    DELETE /api/admin/users/:user_id                    (M1 delete)

  Stats
    GET    /api/admin/stats
"""

import csv
import io
import random
import re
import string
from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify, current_app, Response
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models.user import User, UserRole
from ..models.org import Org
from ..models.entitlement import Entitlement, PlanId, PlanType
from ..models.question import Question, Difficulty, ReviewStatus
from ..models.progress import LevelProgress, WorldProgress                                   # K2
from ..api.auth import roles_required, _get_current_user
from ..api.errors import bad_request, forbidden, conflict, error_response
from ..utils.world_config import (
    VALID_EXAMS, VALID_WORLD_KEYS, EXAM_WORLD_ORDER, EXAM_TRACKS,             # K2: added EXAM_TRACKS
    get_total_questions, validate_exam, validate_world_key, PLAN_WORLD_LIMIT,
    world_name,                                                                # K2: added world_name
)
from ..utils.topic_config import (
    TOPIC_TAXONOMY, ALL_TOPIC_KEYS, TOPIC_KEY_TO_LABEL,
    get_section_from_world_key, get_topics_for_world_key,
    validate_topic, get_api_taxonomy,
)

_wk_to_section = get_section_from_world_key

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

_ADMIN_ROLE = (UserRole.DRFAHM_ADMIN,)

_VALID_EXAM_SECTIONS = {
    "qudurat": {"math", "verbal"},
    "tahsili": {"math", "biology", "chemistry", "physics"},
}

_ALL_SECTIONS = {"math", "verbal", "biology", "chemistry", "physics"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _random_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(random.SystemRandom().choice(chars) for _ in range(length))


def _random_username_suffix(length: int = 4) -> str:
    return ''.join(random.SystemRandom().choice(string.digits) for _ in range(length))


def _paginate(query, page: int, per_page: int):
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, total


def _validate_exam_section(exam: str, section: str) -> bool:
    return section in _VALID_EXAM_SECTIONS.get(exam, set())


# ═════════════════════════════════════════════════════════════════════════════
# TOPICS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/topics", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_topics():
    section  = request.args.get("section", "").strip().lower() or None
    taxonomy = get_api_taxonomy()
    if section:
        if section not in taxonomy:
            return bad_request("invalid_section",
                               f"Invalid section: {section!r}. Valid: {sorted(taxonomy.keys())}")
        taxonomy = {section: taxonomy[section]}
    return jsonify({"taxonomy": taxonomy}), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTIONS — Legacy JSON import
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/import", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def import_questions():
    admin = _get_current_user()
    data  = request.get_json(silent=True)

    if not isinstance(data, list) or len(data) == 0:
        return bad_request("validation_error",
                           "Body must be a non-empty JSON array of question objects.")
    if len(data) > 5000:
        return bad_request("validation_error", "Maximum 5,000 questions per import call.")

    required_fields = {"exam", "world_key", "index", "question_text",
                       "option_a", "option_b", "option_c", "option_d", "correct_answer"}
    valid_answers   = {"a", "b", "c", "d"}
    now             = datetime.now(timezone.utc)
    upserted        = 0

    for i, item in enumerate(data):
        missing = required_fields - set(item.keys())
        if missing:
            return bad_request("validation_error", f"Item {i}: missing fields: {sorted(missing)}")

        exam      = str(item["exam"]).strip().lower()
        world_key = str(item["world_key"]).strip().lower()
        idx       = int(item["index"])
        answer    = str(item["correct_answer"]).strip().lower()

        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Item {i}: invalid exam {exam!r}.")
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Item {i}: invalid world_key {world_key!r}.")
        if answer not in valid_answers:
            return bad_request("validation_error", f"Item {i}: correct_answer must be a/b/c/d.")

        topic       = (item.get("topic") or "").strip() or None
        section_val = _wk_to_section(world_key)
        if topic and not validate_topic(topic, world_key):
            return bad_request("invalid_topic",
                               f"Item {i}: invalid topic {topic!r} for section {section_val!r}.")

        existing = Question.query.filter_by(
            exam=exam, world_key=world_key, index=idx, deleted_at=None
        ).first()

        if existing:
            existing.question_text       = item["question_text"]
            existing.option_a            = item["option_a"]
            existing.option_b            = item["option_b"]
            existing.option_c            = item["option_c"]
            existing.option_d            = item["option_d"]
            existing.correct_answer      = answer
            existing.topic               = topic
            existing.section             = section_val
            existing.image_url           = item.get("image_url") or existing.image_url
            if "hint" in item:
                existing.hint = (item["hint"] or "").strip() or existing.hint
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
                exam=exam, world_key=world_key, index=idx, section=section_val,
                question_text=item["question_text"],
                option_a=item["option_a"], option_b=item["option_b"],
                option_c=item["option_c"], option_d=item["option_d"],
                correct_answer=answer, topic=topic,
                hint=(item.get("hint") or "").strip() or None,
                image_url=item.get("image_url"),
                difficulty=Difficulty(diff) if diff and diff in {d.value for d in Difficulty} else None,
                is_active=bool(item.get("is_active", False)),
                created_by_admin_id=admin.id, updated_by_admin_id=admin.id,
            )
            db.session.add(q)
        upserted += 1

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return bad_request("import_conflict", "Duplicate or constraint violation during import.",
                           {"detail": str(e.orig)})

    return jsonify({
        "imported": upserted,
        "message":  f"Successfully upserted {upserted} question(s). "
                    "Questions are inactive by default.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK CSV UPLOAD
# ═════════════════════════════════════════════════════════════════════════════

_CSV_COLUMNS = [
    "exam", "section", "question_text",
    "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "hint", "topic", "difficulty",
]
_CSV_REQUIRED = set(_CSV_COLUMNS)


def _normalize_text(text: str) -> str:
    t = (text or "").strip().lower()
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'[^\w\s]', '', t)
    return t


def _parse_and_validate_csv(file_storage) -> dict:
    try:
        raw = file_storage.read()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
    except Exception:
        return {"error": "Could not read CSV file."}

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return {"error": "CSV file is empty or has no header row."}

    clean_headers = [h.strip().lower().replace(" ", "_") for h in reader.fieldnames]
    missing_cols  = _CSV_REQUIRED - set(clean_headers)
    if missing_cols:
        return {"error": f"CSV missing required columns: {sorted(missing_cols)}. "
                         f"Expected: {', '.join(_CSV_COLUMNS)}"}

    rows = []
    for raw_row in reader:
        row = {}
        for orig_key, clean_key in zip(reader.fieldnames, clean_headers):
            row[clean_key] = (raw_row.get(orig_key) or "").strip()
        rows.append(row)

    if not rows:
        return {"error": "CSV has headers but no data rows."}
    if len(rows) > 5000:
        return {"error": f"CSV has {len(rows)} rows. Maximum is 5,000 per upload."}

    existing_questions = db.session.query(
        Question.id, Question.qid, Question.exam, Question.section, Question.question_text
    ).filter(Question.deleted_at.is_(None)).all()

    existing_set = {}
    for eq in existing_questions:
        key = f"{eq.exam}::{eq.section}::{_normalize_text(eq.question_text)}"
        existing_set[key] = {"id": eq.id, "qid": str(eq.qid) if eq.qid else None}

    csv_seen      = {}
    valid_answers = {"a", "b", "c", "d"}
    valid_diffs   = {d.value for d in Difficulty}
    errors        = []
    duplicates    = []
    valid_rows    = []

    for i, row in enumerate(rows):
        row_num    = i + 2
        row_errors = []

        for field in _CSV_REQUIRED:
            if field == "hint":
                continue
            if not row.get(field):
                row_errors.append({"row": row_num, "field": field,
                                   "message": f"Required field '{field}' is empty."})
        if row_errors:
            errors.extend(row_errors)
            continue

        exam    = row["exam"].strip().lower()
        section = row["section"].strip().lower()
        answer  = row["correct_answer"].strip().lower()
        topic   = row["topic"].strip().lower()
        diff    = row["difficulty"].strip().lower()

        if exam not in VALID_EXAMS:
            errors.append({"row": row_num, "field": "exam",
                           "message": f"Invalid exam '{row['exam']}'. Must be qudurat or tahsili."})
            continue
        if section not in _ALL_SECTIONS:
            errors.append({"row": row_num, "field": "section",
                           "message": f"Invalid section '{row['section']}'."})
            continue
        if not _validate_exam_section(exam, section):
            errors.append({"row": row_num, "field": "section",
                           "message": f"Section '{section}' not valid for exam '{exam}'. "
                                      f"Valid: {sorted(_VALID_EXAM_SECTIONS.get(exam, set()))}."})
            continue
        if answer not in valid_answers:
            errors.append({"row": row_num, "field": "correct_answer",
                           "message": f"Must be a/b/c/d, got '{row['correct_answer']}'."})
            continue
        if diff not in valid_diffs:
            errors.append({"row": row_num, "field": "difficulty",
                           "message": f"Must be easy/medium/hard, got '{row['difficulty']}'."})
            continue

        valid_topic_keys = {k for k, _ in TOPIC_TAXONOMY.get(section, [])}
        if topic not in valid_topic_keys:
            errors.append({"row": row_num, "field": "topic",
                           "message": f"Topic '{row['topic']}' not valid for section '{section}'. "
                                      f"Valid: {sorted(valid_topic_keys)}."})
            continue

        norm_text = _normalize_text(row["question_text"])
        dup_key   = f"{exam}::{section}::{norm_text}"

        if dup_key in existing_set:
            match = existing_set[dup_key]
            duplicates.append({"row": row_num, "question_text": row["question_text"][:120],
                                "existing_id": match["id"], "existing_qid": match["qid"],
                                "duplicate_of_csv_row": None})
            continue
        if dup_key in csv_seen:
            duplicates.append({"row": row_num, "question_text": row["question_text"][:120],
                                "existing_id": None, "existing_qid": None,
                                "duplicate_of_csv_row": csv_seen[dup_key]})
            continue

        csv_seen[dup_key] = row_num
        valid_rows.append({
            "exam": exam, "section": section,
            "question_text": row["question_text"],
            "option_a": row["option_a"], "option_b": row["option_b"],
            "option_c": row["option_c"], "option_d": row["option_d"],
            "correct_answer": answer,
            "hint": row.get("hint") or None,
            "topic": topic, "difficulty": diff,
            "_row": row_num,
        })

    return {
        "valid": valid_rows, "errors": errors, "duplicates": duplicates,
        "stats": {
            "total_rows": len(rows), "valid_count": len(valid_rows),
            "error_count": len(errors), "duplicate_count": len(duplicates),
        },
    }


@admin_bp.route("/questions/bulk-template", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def bulk_template():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(_CSV_COLUMNS)
    writer.writerow(["qudurat", "math", "What is 2 + 2?", "3", "4", "5", "6", "b",
                     "Think about basic addition: start with 2 and count 2 more.",
                     "arithmetic", "easy"])
    writer.writerow(["qudurat", "verbal", "The synonym of 'happy' is:",
                     "Sad", "Joyful", "Angry", "Tired", "b", "",
                     "synonyms", "easy"])
    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=drfahm_bulk_template.csv"})


@admin_bp.route("/questions/bulk-validate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_validate():
    if "file" not in request.files:
        return bad_request("no_file", "No file uploaded. Send a CSV as multipart 'file' field.")
    f = request.files["file"]
    if not f.filename:
        return bad_request("no_file", "Empty file name.")
    if not f.filename.lower().endswith(".csv"):
        return bad_request("invalid_format", "Only .csv files are accepted.")

    result = _parse_and_validate_csv(f)
    if "error" in result:
        return bad_request("csv_parse_error", result["error"])
    return jsonify({
        "stats": result["stats"], "errors": result["errors"],
        "duplicates": result["duplicates"], "preview": result["valid"][:20],
    }), 200


@admin_bp.route("/questions/bulk-commit", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_commit():
    admin       = _get_current_user()
    force_dupes = request.args.get("force_duplicates", "").lower() == "true"

    if "file" not in request.files:
        return bad_request("no_file", "No file uploaded. Send a CSV as multipart 'file' field.")
    f = request.files["file"]
    if not f.filename or not f.filename.lower().endswith(".csv"):
        return bad_request("invalid_format", "Only .csv files are accepted.")

    result = _parse_and_validate_csv(f)
    if "error" in result:
        return bad_request("csv_parse_error", result["error"])

    rows_to_insert = list(result["valid"])

    if force_dupes and result["duplicates"]:
        f.seek(0)
        try:
            raw = f.read()
            try:
                text = raw.decode("utf-8-sig")
            except UnicodeDecodeError:
                text = raw.decode("latin-1")
        except Exception:
            return bad_request("csv_parse_error", "Could not re-read CSV file.")

        dup_row_nums  = {d["row"] for d in result["duplicates"]}
        reader        = csv.DictReader(io.StringIO(text))
        clean_headers = [h.strip().lower().replace(" ", "_") for h in reader.fieldnames]
        for i, raw_row in enumerate(reader):
            row_num = i + 2
            if row_num not in dup_row_nums:
                continue
            row = {ck: (raw_row.get(ok) or "").strip()
                   for ok, ck in zip(reader.fieldnames, clean_headers)}
            rows_to_insert.append({
                "exam": row["exam"].strip().lower(), "section": row["section"].strip().lower(),
                "question_text": row["question_text"],
                "option_a": row["option_a"], "option_b": row["option_b"],
                "option_c": row["option_c"], "option_d": row["option_d"],
                "correct_answer": row["correct_answer"].strip().lower(),
                "hint": row.get("hint") or None,
                "topic": row["topic"].strip().lower(),
                "difficulty": row["difficulty"].strip().lower(),
                "_row": row_num,
            })

    if not rows_to_insert:
        return jsonify({
            "inserted": 0, "skipped": result["stats"]["duplicate_count"],
            "errors": result["errors"], "duplicates": result["duplicates"],
            "message": "No valid rows to insert.",
        }), 200

    now      = datetime.now(timezone.utc)
    inserted = 0
    for row in rows_to_insert:
        diff = row.get("difficulty")
        q = Question(
            exam=row["exam"], section=row["section"],
            question_text=row["question_text"],
            option_a=row["option_a"], option_b=row["option_b"],
            option_c=row["option_c"], option_d=row["option_d"],
            correct_answer=row["correct_answer"],
            hint=row.get("hint") or None, topic=row.get("topic") or None,
            difficulty=Difficulty(diff) if diff and diff in {d.value for d in Difficulty} else None,
            is_active=False,
            created_by_admin_id=admin.id, updated_by_admin_id=admin.id,
        )
        db.session.add(q)
        inserted += 1

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return bad_request("import_conflict", "Constraint violation during bulk insert.",
                           {"detail": str(e.orig)})

    return jsonify({
        "inserted": inserted,
        "skipped": result["stats"]["duplicate_count"] if not force_dupes else 0,
        "errors": result["errors"], "duplicates": result["duplicates"],
        "message": f"Successfully inserted {inserted} question(s) into the question bank. "
                   "All questions are unassigned and inactive. "
                   "Use Bulk Assign to place them into worlds, then activate.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK DELETE
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-delete", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_delete_questions():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    ids = data.get("question_ids")
    if not isinstance(ids, list) or len(ids) == 0:
        return bad_request("validation_error",
                           "question_ids must be a non-empty array of integer IDs.")
    if len(ids) > 500:
        return bad_request("validation_error", "Maximum 500 IDs per bulk-delete call.")
    if not data.get("confirm"):
        return bad_request("confirmation_required", "Set confirm: true to proceed.")
    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return bad_request("validation_error", "All question_ids must be integers.")

    now      = datetime.now(timezone.utc)
    affected = Question.query.filter(
        Question.id.in_(ids), Question.deleted_at.is_(None),
    ).update({
        "deleted_at": now, "is_active": False,
        "deleted_by_admin_id": admin.id, "updated_by_admin_id": admin.id, "updated_at": now,
    }, synchronize_session=False)
    db.session.commit()
    return jsonify({"deleted": affected, "message": f"{affected} question(s) soft-deleted."}), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK ASSIGN
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-assign", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_assign_questions():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    ids = data.get("question_ids")
    if not isinstance(ids, list) or len(ids) == 0:
        return bad_request("validation_error",
                           "question_ids must be a non-empty array of integer IDs.")
    if len(ids) > 500:
        return bad_request("validation_error", "Maximum 500 IDs per bulk-assign call.")
    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return bad_request("validation_error", "All question_ids must be integers.")

    assign = data.get("assign")
    if not isinstance(assign, dict) or not assign:
        return bad_request("validation_error",
                           "'assign' must be a non-empty object with at least one field.")

    topic_val = assign.get("topic")
    diff_val  = assign.get("difficulty")
    wk_val    = assign.get("world_key")

    if diff_val is not None:
        diff_val = str(diff_val).strip().lower()
        if diff_val not in {d.value for d in Difficulty}:
            return bad_request("validation_error",
                               f"difficulty must be easy/medium/hard, got {diff_val!r}.")
    if wk_val is not None:
        wk_val = str(wk_val).strip().lower()
        if wk_val not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {wk_val!r}.")
    if topic_val is not None:
        topic_val = str(topic_val).strip().lower() or None
        if topic_val and topic_val not in ALL_TOPIC_KEYS:
            return bad_request("invalid_topic", f"Invalid topic key: {topic_val!r}.")

    questions = Question.query.filter(
        Question.id.in_(ids), Question.deleted_at.is_(None),
    ).all()
    if not questions:
        return bad_request("not_found", "No active questions found for the provided IDs.")

    now                 = datetime.now(timezone.utc)
    skipped             = []
    affected_ids        = []
    world_index_counter = {}

    if wk_val:
        for q in questions:
            key = (q.exam, wk_val)
            if key not in world_index_counter:
                current_max = db.session.query(func.max(Question.index)).filter(
                    Question.exam == q.exam, Question.world_key == wk_val,
                    Question.deleted_at.is_(None),
                ).scalar()
                world_index_counter[key] = current_max or 0

    for q in questions:
        if topic_val:
            valid_keys_for_section = {k for k, _ in TOPIC_TAXONOMY.get(q.section or "", [])}
            if topic_val not in valid_keys_for_section:
                skipped.append({"id": q.id,
                                 "reason": f"Topic '{topic_val}' not valid for section '{q.section}'."})
                continue
        if wk_val:
            world_section = _wk_to_section(wk_val)
            if q.section and q.section != world_section:
                skipped.append({"id": q.id,
                                 "reason": f"Section mismatch: question '{q.section}' vs "
                                           f"world '{world_section}'."})
                continue

        if topic_val is not None: q.topic      = topic_val
        if diff_val  is not None: q.difficulty = Difficulty(diff_val)
        if wk_val    is not None:
            key = (q.exam, wk_val)
            world_index_counter[key] = world_index_counter.get(key, 0) + 1
            q.world_key = wk_val
            q.index     = world_index_counter[key]

        q.updated_by_admin_id = admin.id
        q.updated_at          = now
        q.version            += 1
        affected_ids.append(q.id)

    db.session.commit()

    assigned_summary = {}
    if topic_val is not None: assigned_summary["topic"]      = topic_val
    if diff_val  is not None: assigned_summary["difficulty"] = diff_val
    if wk_val    is not None: assigned_summary["world_key"]  = wk_val

    return jsonify({
        "affected": len(affected_ids), "assigned": assigned_summary, "skipped": skipped,
        "message": f"{len(affected_ids)} question(s) updated. "
                   f"{len(skipped)} skipped due to section mismatch.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# AI REVIEW  (Chunk J + K1)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/ai-review", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def ai_review_questions():
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from ..utils.llm_provider import get_llm_provider, QuestionReviewResult  # noqa

    data      = request.get_json(silent=True) or {}
    ids       = data.get("question_ids")
    overwrite = bool(data.get("overwrite", False))

    if not isinstance(ids, list) or len(ids) == 0:
        return bad_request("validation_error",
                           "question_ids must be a non-empty array of integer IDs.")
    if len(ids) > 20:
        return bad_request("validation_error", "Maximum 20 questions per AI review call.")
    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return bad_request("validation_error", "All question_ids must be integers.")

    questions = Question.query.filter(
        Question.id.in_(ids), Question.deleted_at.is_(None),
    ).all()
    if not questions:
        return bad_request("not_found", "No active questions found for the provided IDs.")

    to_review        = []
    skipped_approved = []
    for q in questions:
        if not overwrite and q.review_status == ReviewStatus.APPROVED:
            skipped_approved.append(q.id)
        else:
            to_review.append(q)

    if not to_review:
        return jsonify({
            "processed": 0, "failed": 0,
            "skipped_approved": skipped_approved, "results": [],
            "message": "All selected questions are already approved. "
                       "Pass overwrite=true to re-review them.",
        }), 200

    now = datetime.now(timezone.utc)
    for q in to_review:
        q.review_status = ReviewStatus.AI_PENDING
        q.updated_at    = now
    db.session.commit()

    try:
        provider = get_llm_provider()
    except RuntimeError as exc:
        for q in to_review:
            q.review_status = ReviewStatus.UNREVIEWED
            q.updated_at    = now
        db.session.commit()
        return error_response("provider_error", str(exc), 501)

    section_topics: dict = {
        sec: [k for k, _ in topics]
        for sec, topics in TOPIC_TAXONOMY.items()
    }

    call_args = [
        (q.id, q.exam, q.section or "", q.question_text,
         q.option_a, q.option_b, q.option_c, q.option_d,
         section_topics.get(q.section or "", []))
        for q in to_review
    ]

    results_map: dict = {}
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(provider.review_question, *args): args[0]
                   for args in call_args}
        for future in as_completed(futures):
            q_id = futures[future]
            try:
                results_map[q_id] = future.result()
            except Exception as exc:
                results_map[q_id] = QuestionReviewResult(
                    question_id=q_id, predicted_answer=None, confidence=None,
                    proposed_hint=None, review_note=None, predicted_topic=None, error=str(exc),
                )

    now         = datetime.now(timezone.utc)
    q_map       = {q.id: q for q in to_review}
    processed   = 0
    failed      = 0
    results_out = []

    for q_id, result in results_map.items():
        q = q_map.get(q_id)
        if not q:
            continue
        if result.error:
            q.review_status = ReviewStatus.UNREVIEWED
            q.updated_at    = now
            failed += 1
            results_out.append({"question_id": q_id, "status": "failed",
                                 "predicted_answer": None, "confidence": None,
                                 "review_note": None, "proposed_hint": None,
                                 "predicted_topic": None, "error": result.error})
        else:
            q.llm_predicted_answer = result.predicted_answer
            q.llm_confidence       = result.confidence
            q.llm_review_note      = result.review_note
            q.llm_proposed_hint    = result.proposed_hint
            q.llm_predicted_topic  = result.predicted_topic
            q.llm_reviewed_at      = now
            q.review_status        = ReviewStatus.AI_REVIEWED
            q.updated_at           = now
            processed += 1
            results_out.append({"question_id": q_id, "status": "reviewed",
                                 "predicted_answer": result.predicted_answer,
                                 "confidence": result.confidence,
                                 "review_note": result.review_note,
                                 "proposed_hint": result.proposed_hint,
                                 "predicted_topic": result.predicted_topic,
                                 "error": None})

    db.session.commit()
    return jsonify({
        "processed": processed, "failed": failed,
        "skipped_approved": skipped_approved, "results": results_out,
        "message": f"AI review complete: {processed} reviewed, {failed} failed, "
                   f"{len(skipped_approved)} skipped (approved).",
    }), 200


@admin_bp.route("/questions/<int:question_id>/approve-review", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def approve_ai_review(question_id: int):
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)
    if q.review_status not in (ReviewStatus.AI_REVIEWED, ReviewStatus.REJECTED):
        return bad_request("invalid_state",
                           f"Cannot approve — review_status is '{q.review_status.value}'. "
                           "Expected 'ai_reviewed' or 'rejected'.")

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(f"Version mismatch (submitted {submitted_version}, current {q.version}). "
                        "Reload and retry.",
                        {"current_record": q.to_dict(include_answer=True)})

    accept_answer   = bool(data.get("accept_answer", True))
    accept_hint     = bool(data.get("accept_hint",   True))
    override_answer = (data.get("correct_answer") or "").strip().lower() or None
    now             = datetime.now(timezone.utc)

    if accept_answer:
        final_answer = override_answer or q.llm_predicted_answer
        if not final_answer or final_answer not in {"a", "b", "c", "d"}:
            return bad_request("validation_error",
                               "No valid answer available to approve. "
                               "Supply correct_answer in the body or ensure AI review ran first.")
        q.correct_answer            = final_answer
        q.last_reviewed_at          = now
        q.last_reviewed_by_admin_id = admin.id

    if accept_hint and q.llm_proposed_hint:
        q.hint = q.llm_proposed_hint

    accept_topic = bool(data.get("accept_topic", True))
    if accept_topic:
        topic_to_set = (data.get("topic") or "").strip().lower() or q.llm_predicted_topic
        if topic_to_set:
            section_key = q.section or (_wk_to_section(q.world_key) if q.world_key else None)
            if section_key:
                valid_keys = {k for k, _ in TOPIC_TAXONOMY.get(section_key, [])}
                if topic_to_set not in valid_keys:
                    return bad_request("invalid_topic",
                                       f"Topic '{topic_to_set}' not valid for section '{section_key}'. "
                                       f"Valid: {sorted(valid_keys)}.")
            elif topic_to_set not in ALL_TOPIC_KEYS:
                return bad_request("invalid_topic", f"Invalid topic key: '{topic_to_set}'.")
            q.topic = topic_to_set

    q.review_status       = ReviewStatus.APPROVED
    q.updated_by_admin_id = admin.id
    q.updated_at          = now
    q.version            += 1
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


@admin_bp.route("/questions/<int:question_id>/reject-review", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def reject_ai_review(question_id: int):
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(f"Version mismatch (submitted {submitted_version}, current {q.version}). "
                        "Reload and retry.",
                        {"current_record": q.to_dict(include_answer=True)})

    now = datetime.now(timezone.utc)
    q.review_status       = ReviewStatus.REJECTED
    q.updated_by_admin_id = admin.id
    q.updated_at          = now
    q.version            += 1
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTION — next-index / review-progress / topic-coverage
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/next-index", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_next_index():
    exam      = (request.args.get("exam") or "").strip().lower()
    world_key = (request.args.get("world_key") or "").strip().lower()
    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
    if world_key not in VALID_WORLD_KEYS:
        return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
    max_idx = db.session.query(func.max(Question.index)).filter(
        Question.exam == exam, Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).scalar()
    return jsonify({"exam": exam, "world_key": world_key, "next_index": (max_idx or 0) + 1}), 200


@admin_bp.route("/questions/review-progress", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def review_progress():
    exam_filter = request.args.get("exam", "").strip().lower() or None

    q = db.session.query(
        Question.exam, Question.section,
        func.count(Question.id).label("total"),
        func.sum(case((Question.last_reviewed_at.isnot(None), 1), else_=0)).label("reviewed"),
        func.sum(case((Question.review_status == ReviewStatus.AI_PENDING, 1), else_=0)).label("ai_pending"),
    ).filter(Question.deleted_at.is_(None)).group_by(
        Question.exam, Question.section,
    ).order_by(Question.exam, Question.section)

    if exam_filter:
        if exam_filter not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")
        q = q.filter(Question.exam == exam_filter)

    rows            = q.all()
    progress        = []
    total_all       = 0
    reviewed_all    = 0
    ai_pending_all  = 0
    for row in rows:
        reviewed   = int(row.reviewed   or 0)
        total      = int(row.total      or 0)
        ai_pending = int(row.ai_pending or 0)
        progress.append({"exam": row.exam, "section": row.section,
                          "total": total, "reviewed": reviewed,
                          "unreviewed": total - reviewed, "ai_pending": ai_pending})
        total_all      += total
        reviewed_all   += reviewed
        ai_pending_all += ai_pending

    return jsonify({
        "progress": progress,
        "summary": {"total": total_all, "reviewed": reviewed_all,
                    "unreviewed": total_all - reviewed_all,
                    "ai_pending": ai_pending_all},
    }), 200


@admin_bp.route("/questions/topic-coverage", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def topic_coverage():
    exam_filter    = request.args.get("exam",    "").strip().lower() or None
    section_filter = request.args.get("section", "").strip().lower() or None

    if exam_filter    and exam_filter    not in VALID_EXAMS:
        return bad_request("invalid_exam",    f"Invalid exam: {exam_filter!r}.")
    if section_filter and section_filter not in _ALL_SECTIONS:
        return bad_request("invalid_section", f"Invalid section: {section_filter!r}.")

    base_q = Question.query.filter(Question.deleted_at.is_(None))
    if exam_filter:    base_q = base_q.filter(Question.exam    == exam_filter)
    if section_filter: base_q = base_q.filter(Question.section == section_filter)

    total    = base_q.count()
    untagged = base_q.filter((Question.topic.is_(None)) | (Question.topic == "")).count()
    tagged   = total - untagged

    topic_q = db.session.query(
        Question.section, Question.exam, Question.topic,
        func.count(Question.id).label("count"),
    ).filter(Question.deleted_at.is_(None), Question.topic.isnot(None), Question.topic != "")
    if exam_filter:    topic_q = topic_q.filter(Question.exam    == exam_filter)
    if section_filter: topic_q = topic_q.filter(Question.section == section_filter)
    topic_q = topic_q.group_by(
        Question.section, Question.exam, Question.topic
    ).order_by(Question.section, func.count(Question.id).desc())
    rows = topic_q.all()

    by_section = {}
    for section_key, topics in TOPIC_TAXONOMY.items():
        if section_filter and section_key != section_filter:
            continue
        by_section[section_key] = {
            "total": 0, "tagged": 0, "untagged": 0, "pct_tagged": 0.0,
            "topics": {k: {"topic": k, "label": lbl, "count": 0} for k, lbl in topics},
        }

    sec_total_q = db.session.query(
        Question.section, func.count(Question.id).label("total"),
        func.sum(case(((Question.topic.is_(None)) | (Question.topic == ""), 1), else_=0)).label("untagged"),
    ).filter(Question.deleted_at.is_(None))
    if exam_filter:    sec_total_q = sec_total_q.filter(Question.exam    == exam_filter)
    if section_filter: sec_total_q = sec_total_q.filter(Question.section == section_filter)
    sec_total_q = sec_total_q.group_by(Question.section)

    for sec_row in sec_total_q.all():
        sec = sec_row.section
        if sec in by_section:
            t = int(sec_row.total    or 0)
            u = int(sec_row.untagged or 0)
            by_section[sec]["total"]      = t
            by_section[sec]["untagged"]   = u
            by_section[sec]["tagged"]     = t - u
            by_section[sec]["pct_tagged"] = round((t - u) / t * 100, 1) if t else 0.0

    flat_coverage = []
    for row in rows:
        sec = row.section
        if sec in by_section and row.topic in by_section[sec]["topics"]:
            by_section[sec]["topics"][row.topic]["count"] += int(row.count)
        flat_coverage.append({"section": sec, "topic": row.topic,
                               "label": TOPIC_KEY_TO_LABEL.get(row.topic, row.topic),
                               "count": int(row.count)})

    by_section_out = {}
    for sec, data in by_section.items():
        by_section_out[sec] = {
            "total": data["total"], "tagged": data["tagged"],
            "untagged": data["untagged"], "pct_tagged": data["pct_tagged"],
            "topics": sorted(data["topics"].values(), key=lambda x: x["count"], reverse=True),
        }

    pct_tagged = round(tagged / total * 100, 1) if total else 0.0
    return jsonify({
        "coverage": flat_coverage, "by_section": by_section_out,
        "summary": {"total": total, "tagged": tagged, "untagged": untagged, "pct_tagged": pct_tagged},
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# DUPLICATE DETECTION  (Chunk K3)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/find-duplicates", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def find_duplicates():
    data    = request.get_json(silent=True) or {}
    section = (data.get("section") or "").strip().lower()

    if not section or section not in _ALL_SECTIONS:
        return bad_request("invalid_section",
                           f"section is required. Valid: {sorted(_ALL_SECTIONS)}")

    rows = db.session.query(
        Question.id, Question.exam, Question.world_key,
        Question.question_text, Question.correct_answer,
        Question.is_active, Question.review_status,
    ).filter(
        Question.section   == section,
        Question.deleted_at.is_(None),
    ).order_by(Question.id).all()

    buckets: dict = {}
    for row in rows:
        key = _normalize_text(row.question_text)
        if key not in buckets:
            buckets[key] = []
        buckets[key].append(row)

    duplicate_groups = []
    for key, qs in buckets.items():
        if len(qs) < 2:
            continue
        duplicate_groups.append({
            "count":              len(qs),
            "normalized_preview": key[:100],
            "questions": [
                {
                    "id":             q.id,
                    "exam":           q.exam,
                    "world_key":      q.world_key,
                    "question_text":  q.question_text[:250],
                    "correct_answer": q.correct_answer,
                    "is_active":      q.is_active,
                    "review_status":  q.review_status.value if q.review_status else "unreviewed",
                }
                for q in qs
            ],
        })

    duplicate_groups.sort(key=lambda g: (-g["count"], g["questions"][0]["id"]))
    total_duplicate_questions = sum(g["count"] for g in duplicate_groups)

    return jsonify({
        "section":                   section,
        "total_groups":              len(duplicate_groups),
        "total_duplicate_questions": total_duplicate_questions,
        "duplicate_groups":          duplicate_groups,
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTIONS — List / Get / Update / Delete
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_questions():
    exam          = request.args.get("exam",          "").strip().lower() or None
    section       = request.args.get("section",       "").strip().lower() or None
    world_key     = request.args.get("world_key",     "").strip().lower() or None
    is_active     = request.args.get("is_active")
    difficulty    = request.args.get("difficulty",    "").strip().lower() or None
    topic         = request.args.get("topic",         "").strip().lower() or None
    reviewed      = request.args.get("reviewed",      "").strip().lower() or None
    review_status = request.args.get("review_status", "").strip().lower() or None
    search        = request.args.get("search",        "").strip() or None
    unassigned    = request.args.get("unassigned",    "").strip().lower() or None
    qid           = request.args.get("qid",           "").strip() or None
    page          = max(1, int(request.args.get("page",     1) or 1))
    per_page      = min(200, max(1, int(request.args.get("per_page", 50) or 50)))
    ids_only      = request.args.get("ids_only", "").strip().lower() == "true"

    q = Question.query.filter(Question.deleted_at.is_(None))

    if qid:       q = q.filter(Question.qid == qid)
    if exam:
        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
        q = q.filter(Question.exam == exam)
    if section:
        if section not in _ALL_SECTIONS:
            return bad_request("invalid_section", f"Invalid section: {section!r}.")
        q = q.filter(Question.section == section)
    if world_key:
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
        q = q.filter(Question.world_key == world_key)
    if unassigned == "true":  q = q.filter(Question.world_key.is_(None))
    elif unassigned == "false": q = q.filter(Question.world_key.isnot(None))
    if is_active is not None:
        q = q.filter(Question.is_active == (is_active.lower() == "true"))
    if difficulty and difficulty in {d.value for d in Difficulty}:
        q = q.filter(Question.difficulty == Difficulty(difficulty))
    if topic:
        if topic == "_untagged":
            q = q.filter((Question.topic.is_(None)) | (Question.topic == ""))
        elif topic in ALL_TOPIC_KEYS:
            q = q.filter(Question.topic == topic)
        else:
            return bad_request("invalid_topic", f"Invalid topic filter: {topic!r}.")
    if reviewed == "true":  q = q.filter(Question.last_reviewed_at.isnot(None))
    elif reviewed == "false": q = q.filter(Question.last_reviewed_at.is_(None))
    if review_status and review_status in {s.value for s in ReviewStatus}:
        q = q.filter(Question.review_status == ReviewStatus(review_status))
    if search:
        q = q.filter(Question.question_text.ilike(f"%{search}%"))

    q = q.order_by(
        Question.exam, Question.section,
        Question.world_key.nullslast(), Question.index.nullslast(),
    )

    if ids_only:
        id_list = [row[0] for row in q.with_entities(Question.id).all()]
        return jsonify({"ids": id_list, "total": len(id_list)}), 200

    items, total = _paginate(q, page, per_page)
    return jsonify({
        "questions": [item.to_dict(include_answer=True) for item in items],
        "total": total, "page": page, "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
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
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(f"Question was modified by another admin (expected version "
                        f"{submitted_version}, current {q.version}). Reload and retry.",
                        {"current_record": q.to_dict(include_answer=True)})

    valid_answers = {"a", "b", "c", "d"}

    if "question_text" in data: q.question_text = data["question_text"]
    if "option_a"      in data: q.option_a      = data["option_a"]
    if "option_b"      in data: q.option_b      = data["option_b"]
    if "option_c"      in data: q.option_c      = data["option_c"]
    if "option_d"      in data: q.option_d      = data["option_d"]
    if "is_active"     in data: q.is_active     = bool(data["is_active"])

    if "topic" in data:
        topic_val = (data["topic"] or "").strip() or None
        if topic_val:
            section_key = q.section or (_wk_to_section(q.world_key) if q.world_key else None)
            if section_key:
                valid_keys = {k for k, _ in TOPIC_TAXONOMY.get(section_key, [])}
                if topic_val not in valid_keys:
                    return bad_request("invalid_topic",
                                       f"Topic '{topic_val}' not valid for section '{section_key}'.")
            elif topic_val not in ALL_TOPIC_KEYS:
                return bad_request("invalid_topic", f"Invalid topic key: {topic_val!r}.")
        q.topic = topic_val

    if "image_url" in data:
        img = data["image_url"]
        if img:
            if len(img) > 700_000:
                return bad_request("image_too_large", "Image must be under 500KB.")
            if not (img.startswith("data:image/") or img.startswith("http")):
                return bad_request("invalid_image", "image_url must be a data URL or HTTP URL.")
        q.image_url = img or None

    if "hint" in data:
        q.hint = (data["hint"] or "").strip() or None

    if "correct_answer" in data:
        ans = (data["correct_answer"] or "").strip().lower()
        if ans not in valid_answers:
            return bad_request("validation_error", "correct_answer must be one of a/b/c/d.")
        q.correct_answer            = ans
        q.last_reviewed_at          = datetime.now(timezone.utc)
        q.last_reviewed_by_admin_id = admin.id

    if "difficulty" in data:
        diff = data["difficulty"]
        if diff and diff not in {d.value for d in Difficulty}:
            return bad_request("validation_error", "difficulty must be easy/medium/hard.")
        q.difficulty = Difficulty(diff) if diff else None

    if "world_key" in data:
        wk = (data["world_key"] or "").strip().lower() or None
        if wk and wk not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {wk!r}.")
        if wk and q.section:
            wk_section = _wk_to_section(wk)
            if wk_section != q.section:
                return bad_request("section_mismatch",
                                   f"Cannot assign question (section: {q.section!r}) "
                                   f"to world '{wk}' (section: {wk_section!r}).")
        q.world_key = wk

    if "index" in data:
        q.index = int(data["index"]) if data["index"] is not None else None

    q.version            += 1
    q.updated_by_admin_id = admin.id
    q.updated_at          = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


@admin_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@roles_required(*_ADMIN_ROLE)
def delete_question(question_id: int):
    admin = _get_current_user()
    q     = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)
    now = datetime.now(timezone.utc)
    q.deleted_at = now; q.deleted_by_admin_id = admin.id
    q.is_active  = False; q.updated_by_admin_id = admin.id; q.updated_at = now
    db.session.commit()
    return jsonify({"message": "Question deleted."}), 200


@admin_bp.route("/questions/<int:question_id>/activate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def toggle_question_active(question_id: int):
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}
    q     = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)
    if "is_active" not in data:
        return bad_request("validation_error", "is_active (boolean) is required.")
    q.is_active           = bool(data["is_active"])
    q.updated_by_admin_id = admin.id
    q.version            += 1
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


@admin_bp.route("/questions/<int:question_id>/mark-reviewed", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def mark_question_reviewed(question_id: int):
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}
    q     = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(f"Version mismatch (expected {submitted_version}, current {q.version}). "
                        "Reload and retry.",
                        {"current_record": q.to_dict(include_answer=True)})

    now = datetime.now(timezone.utc)
    q.last_reviewed_at          = now
    q.last_reviewed_by_admin_id = admin.id
    q.updated_by_admin_id       = admin.id
    q.updated_at                = now
    q.version                  += 1
    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK ACTIVATE / BULK TOPIC (legacy — kept for backward compat)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-activate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_activate_questions():
    admin     = _get_current_user()
    data      = request.get_json(silent=True) or {}
    is_active = data.get("is_active")
    if is_active is None:
        return bad_request("validation_error", "is_active (boolean) is required.")

    is_active = bool(is_active)
    exam      = (data.get("exam")      or "").strip().lower() or None
    world_key = (data.get("world_key") or "").strip().lower() or None
    ids       = data.get("ids")
    now       = datetime.now(timezone.utc)

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
        {"is_active": is_active, "updated_by_admin_id": admin.id, "updated_at": now},
        synchronize_session=False,
    )
    db.session.commit()
    action = "activated" if is_active else "deactivated"
    return jsonify({"affected": affected, "message": f"{affected} question(s) {action}.",
                    "is_active": is_active}), 200


@admin_bp.route("/questions/bulk-topic", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_assign_topic():
    admin     = _get_current_user()
    data      = request.get_json(silent=True) or {}
    topic_val = (data.get("topic") or "").strip() or None
    exam      = (data.get("exam")      or "").strip().lower() or None
    world_key = (data.get("world_key") or "").strip().lower() or None
    ids       = data.get("ids")

    if topic_val and topic_val not in ALL_TOPIC_KEYS:
        return bad_request("invalid_topic", f"Invalid topic: {topic_val!r}.")

    now = datetime.now(timezone.utc)
    q   = Question.query.filter(Question.deleted_at.is_(None))
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
        {"topic": topic_val, "updated_by_admin_id": admin.id, "updated_at": now},
        synchronize_session=False,
    )
    db.session.commit()
    label = TOPIC_KEY_TO_LABEL.get(topic_val, topic_val) if topic_val else "none"
    return jsonify({"affected": affected, "topic": topic_val,
                    "message": f"{affected} question(s) topic set to '{label}'."}), 200


# ═════════════════════════════════════════════════════════════════════════════
# WORLD ALLOCATION TOOLS  (Chunk K2)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/worlds/health", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def world_health():
    exam_filter = request.args.get("exam", "").strip().lower() or None
    if exam_filter and exam_filter not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")

    exams_to_include = [exam_filter] if exam_filter else sorted(VALID_EXAMS)

    agg_q = db.session.query(
        Question.exam, Question.world_key,
        func.count(Question.id).label("assigned"),
        func.sum(case((Question.is_active.is_(True), 1), else_=0)).label("active"),
    ).filter(Question.deleted_at.is_(None), Question.world_key.isnot(None))
    if exam_filter:
        agg_q = agg_q.filter(Question.exam == exam_filter)
    agg_q = agg_q.group_by(Question.exam, Question.world_key)

    agg_map = {}
    for row in agg_q.all():
        agg_map[(row.exam, row.world_key)] = {
            "assigned": int(row.assigned or 0),
            "active":   int(row.active   or 0),
        }

    topic_q = db.session.query(
        Question.exam, Question.world_key, Question.topic,
        func.count(Question.id).label("cnt"),
    ).filter(Question.deleted_at.is_(None), Question.world_key.isnot(None),
             Question.topic.isnot(None), Question.topic != "")
    if exam_filter:
        topic_q = topic_q.filter(Question.exam == exam_filter)
    topic_q = topic_q.group_by(Question.exam, Question.world_key, Question.topic)

    topic_map = {}
    for row in topic_q.all():
        key = (row.exam, row.world_key)
        if key not in topic_map:
            topic_map[key] = {}
        topic_map[key][row.topic] = int(row.cnt)

    diff_q = db.session.query(
        Question.exam, Question.world_key, Question.difficulty,
        func.count(Question.id).label("cnt"),
    ).filter(Question.deleted_at.is_(None), Question.world_key.isnot(None))
    if exam_filter:
        diff_q = diff_q.filter(Question.exam == exam_filter)
    diff_q = diff_q.group_by(Question.exam, Question.world_key, Question.difficulty)

    diff_map = {}
    for row in diff_q.all():
        key = (row.exam, row.world_key)
        if key not in diff_map:
            diff_map[key] = {"easy": 0, "medium": 0, "hard": 0, "untagged": 0}
        diff_key = row.difficulty.value if row.difficulty else "untagged"
        diff_map[key][diff_key] = int(row.cnt)

    prog_q = db.session.query(
        LevelProgress.exam, LevelProgress.world_key,
        func.count(func.distinct(LevelProgress.user_id)).label("student_count"),
    )
    if exam_filter:
        prog_q = prog_q.filter(LevelProgress.exam == exam_filter)
    prog_q = prog_q.group_by(LevelProgress.exam, LevelProgress.world_key)

    prog_map = {}
    for row in prog_q.all():
        prog_map[(row.exam, row.world_key)] = int(row.student_count)

    worlds_out     = []
    total_capacity = 0
    total_assigned = 0
    total_active   = 0

    for exam in exams_to_include:
        for track_key, track_data in EXAM_TRACKS[exam].items():
            for wk in track_data["worlds"]:
                capacity = get_total_questions(wk)
                agg      = agg_map.get((exam, wk), {"assigned": 0, "active": 0})
                assigned = agg["assigned"]
                active   = agg["active"]
                fill_pct = round(assigned / capacity * 100) if capacity else 0

                topic_counts    = topic_map.get((exam, wk), {})
                topic_breakdown = sorted(
                    [{"topic": t, "label": TOPIC_KEY_TO_LABEL.get(t, t), "count": c}
                     for t, c in topic_counts.items()],
                    key=lambda x: -x["count"],
                )

                diff_counts   = diff_map.get((exam, wk), {"easy": 0, "medium": 0, "hard": 0, "untagged": 0})
                student_count = prog_map.get((exam, wk), 0)

                worlds_out.append({
                    "world_key":            wk,
                    "exam":                 exam,
                    "section":              track_key,
                    "display_name":         world_name(wk),
                    "capacity":             capacity,
                    "assigned":             assigned,
                    "active":               active,
                    "inactive":             assigned - active,
                    "empty_slots":          capacity - assigned,
                    "fill_pct":             fill_pct,
                    "topic_breakdown":      topic_breakdown,
                    "difficulty_breakdown": diff_counts,
                    "student_count":        student_count,
                    "has_student_progress": student_count > 0,
                })

                total_capacity += capacity
                total_assigned += assigned
                total_active   += active

    return jsonify({
        "worlds": worlds_out,
        "summary": {
            "total_capacity": total_capacity,
            "total_assigned": total_assigned,
            "total_active":   total_active,
            "total_empty":    total_capacity - total_assigned,
        },
    }), 200


@admin_bp.route("/worlds/<world_key>/smart-fill", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def world_smart_fill(world_key: str):
    admin     = _get_current_user()
    data      = request.get_json(silent=True) or {}
    world_key = world_key.lower()

    if world_key not in VALID_WORLD_KEYS:
        return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")

    exam = (data.get("exam") or "").strip().lower()
    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", "exam is required (qudurat or tahsili).")
    if world_key not in EXAM_WORLD_ORDER.get(exam, []):
        return bad_request("invalid_world_key",
                           f"world_key {world_key!r} does not belong to exam {exam!r}.")

    section  = _wk_to_section(world_key)
    capacity = get_total_questions(world_key)

    current_count = Question.query.filter(
        Question.exam == exam, Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).count()

    available_slots = capacity - current_count
    if available_slots <= 0:
        return bad_request("world_full",
                           f"World {world_key!r} is already at or above capacity "
                           f"({current_count}/{capacity}). Clear it first to refill.")

    topics         = data.get("topics")
    difficulty     = (data.get("difficulty") or "").strip().lower() or None
    min_confidence = data.get("min_confidence")
    max_fill       = data.get("max_fill")
    activate       = bool(data.get("activate", False))
    reviewed_only  = bool(data.get("reviewed_only", False))

    if difficulty and difficulty not in {d.value for d in Difficulty}:
        return bad_request("validation_error",
                           f"difficulty must be easy/medium/hard, got {difficulty!r}.")
    if topics is not None:
        if not isinstance(topics, list):
            return bad_request("validation_error", "topics must be an array of topic keys.")
        for t in topics:
            if t not in ALL_TOPIC_KEYS:
                return bad_request("invalid_topic", f"Invalid topic key: {t!r}.")
    if min_confidence is not None:
        try:
            min_confidence = float(min_confidence)
            if not (0.0 <= min_confidence <= 1.0):
                raise ValueError
        except (ValueError, TypeError):
            return bad_request("validation_error",
                               "min_confidence must be a float between 0.0 and 1.0.")
    if max_fill is not None:
        try:
            max_fill = int(max_fill)
            if max_fill < 1:
                raise ValueError
        except (ValueError, TypeError):
            return bad_request("validation_error", "max_fill must be a positive integer.")

    fill_limit = min(available_slots, max_fill) if max_fill else available_slots

    q = Question.query.filter(
        Question.exam      == exam,
        Question.section   == section,
        Question.world_key.is_(None),
        Question.deleted_at.is_(None),
    )
    if topics:
        q = q.filter(Question.topic.in_(topics))
    if difficulty:
        q = q.filter(Question.difficulty == Difficulty(difficulty))
    if min_confidence is not None:
        q = q.filter(Question.llm_confidence.isnot(None),
                     Question.llm_confidence >= min_confidence)
    if reviewed_only:
        from sqlalchemy import or_ as sa_or
        q = q.filter(sa_or(
            Question.last_reviewed_at.isnot(None),
            Question.review_status == ReviewStatus.APPROVED,
        ))

    q = q.order_by(Question.topic.nullslast(), Question.difficulty.nullslast(), Question.id)
    candidates = q.limit(fill_limit).all()

    if not candidates:
        return jsonify({
            "filled": 0, "capacity": capacity,
            "was_assigned": current_count, "now_assigned": current_count,
            "available_slots": available_slots, "activated": activate,
            "message": "No unassigned questions match the specified criteria.",
        }), 200

    max_idx = db.session.query(func.max(Question.index)).filter(
        Question.exam == exam, Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).scalar() or 0

    now = datetime.now(timezone.utc)
    for i, cand in enumerate(candidates):
        cand.world_key           = world_key
        cand.index               = max_idx + i + 1
        cand.is_active           = activate
        cand.updated_by_admin_id = admin.id
        cand.updated_at          = now
        cand.version            += 1

    db.session.commit()

    now_assigned = current_count + len(candidates)
    return jsonify({
        "filled":          len(candidates),
        "capacity":        capacity,
        "was_assigned":    current_count,
        "now_assigned":    now_assigned,
        "available_slots": available_slots - len(candidates),
        "activated":       activate,
        "message":         f"Filled {len(candidates)} question(s) into {world_key!r}. "
                           f"{now_assigned}/{capacity} slots used.",
    }), 200


@admin_bp.route("/worlds/<world_key>/clear", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def world_clear(world_key: str):
    admin     = _get_current_user()
    data      = request.get_json(silent=True) or {}
    world_key = world_key.lower()

    if world_key not in VALID_WORLD_KEYS:
        return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")

    exam = (data.get("exam") or "").strip().lower()
    if exam not in VALID_EXAMS:
        return bad_request("invalid_exam", "exam is required (qudurat or tahsili).")
    if world_key not in EXAM_WORLD_ORDER.get(exam, []):
        return bad_request("invalid_world_key",
                           f"world_key {world_key!r} does not belong to exam {exam!r}.")

    if not data.get("confirm"):
        return bad_request("confirmation_required",
                           "Set confirm: true to proceed with clearing this world.")

    student_count = db.session.query(
        func.count(func.distinct(LevelProgress.user_id))
    ).filter(
        LevelProgress.exam      == exam,
        LevelProgress.world_key == world_key,
    ).scalar() or 0

    force = bool(data.get("force", False))

    if student_count > 0 and not force:
        return jsonify({
            "error": {
                "code": "student_progress_exists",
                "message": (
                    f"{student_count} student(s) have attempt history in {world_key!r}. "
                    "Their records will be preserved, but questions will be removed from "
                    "this world. Pass force: true to proceed."
                ),
                "details": {"student_count": student_count, "world_key": world_key, "exam": exam},
            }
        }), 409

    q_count = Question.query.filter(
        Question.exam == exam, Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).count()

    if q_count == 0:
        return jsonify({"cleared": 0, "student_count": student_count,
                        "message": f"World {world_key!r} is already empty."}), 200

    now = datetime.now(timezone.utc)
    Question.query.filter(
        Question.exam == exam, Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).update({
        "world_key": None, "index": None, "is_active": False,
        "updated_by_admin_id": admin.id, "updated_at": now,
    }, synchronize_session=False)
    db.session.commit()

    return jsonify({
        "cleared":       q_count,
        "student_count": student_count,
        "message":       (
            f"{q_count} question(s) returned to bank from {world_key!r}. "
            f"Student progress records ({student_count} student(s)) are preserved."
        ),
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

    if not name: return bad_request("validation_error", "name is required.")
    if not slug: return bad_request("validation_error", "slug is required.")
    if len(slug) < 3 or len(slug) > 50:
        return bad_request("validation_error", "slug must be 3–50 characters.")
    if Org.query.filter_by(slug=slug).first():
        return conflict(f"An org with slug {slug!r} already exists.")

    org = Org(name=name, slug=slug, estimated_student_count=count, created_by_admin_id=admin.id)
    db.session.add(org)
    db.session.commit()
    return jsonify({"org": org.to_dict()}), 201


@admin_bp.route("/orgs", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_orgs():
    page     = max(1, int(request.args.get("page",     1) or 1))
    per_page = min(100, max(1, int(request.args.get("per_page", 20) or 20)))
    search   = request.args.get("search", "").strip()
    q        = Org.query
    if search:
        q = q.filter(Org.name.ilike(f"%{search}%") | Org.slug.ilike(f"%{search}%"))
    q = q.order_by(Org.created_at.desc())
    items, total = _paginate(q, page, per_page)
    return jsonify({"orgs": [o.to_dict() for o in items], "total": total,
                    "page": page, "per_page": per_page}), 200


@admin_bp.route("/orgs/<int:org_id>", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_org(org_id: int):
    org = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)
    leader       = User.query.filter_by(org_id=org.id, role=UserRole.SCHOOL_LEADER).first()
    students     = User.query.filter_by(org_id=org.id, role=UserRole.STUDENT).all()
    entitlements = Entitlement.query.filter_by(org_id=org.id).order_by(Entitlement.created_at.desc()).all()
    return jsonify({
        "org": org.to_dict(), "leader": leader.to_dict() if leader else None,
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
    if User.query.filter_by(org_id=org.id, role=UserRole.SCHOOL_LEADER).first():
        return conflict("This org already has a leader.")
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or _random_password()
    if not username: return bad_request("validation_error", "username is required.")
    if len(username) < 3: return bad_request("validation_error", "username must be at least 3 characters.")
    if User.query.filter_by(username=username).first():
        return conflict(f"Username {username!r} already taken.")
    leader = User(username=username, role=UserRole.SCHOOL_LEADER, org_id=org.id)
    leader.set_password(password)
    db.session.add(leader)
    db.session.commit()
    return jsonify({"user": leader.to_dict(), "password": password,
                    "message": "Leader created. Save the password — it cannot be retrieved later."}), 201


@admin_bp.route("/orgs/<int:org_id>/students/generate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def generate_students(org_id: int):
    """
    Generate student accounts for a school org.

    Username format: {schoolname}_student_{N}
    e.g. alforsanschool_student_1, alforsanschool_student_2

    - schoolname derived from org.name: lowercased, all non-alphanumeric chars stripped
    - N is sequential, continuing from existing student count
    - Collision fallback appends a random 4-digit suffix if needed
    """
    admin = _get_current_user()
    org   = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)

    data  = request.get_json(silent=True) or {}
    count = data.get("count", 10)
    if not isinstance(count, int) or count < 1 or count > 500:
        return bad_request("validation_error", "count must be 1–500.")

    name_prefix = re.sub(r'[^a-z0-9]', '', org.name.lower())
    if not name_prefix:
        name_prefix = org.slug.replace('-', '').replace('_', '')[:20]

    existing_count = User.query.filter_by(
        org_id=org.id, role=UserRole.STUDENT
    ).count()

    created = []
    for i in range(count):
        student_num = existing_count + i + 1
        username    = f"{name_prefix}_student_{student_num}"

        if User.query.filter_by(username=username).first():
            username = f"{name_prefix}_student_{student_num}_{_random_username_suffix(4)}"

        password = _random_password()
        student  = User(username=username, role=UserRole.STUDENT, org_id=org.id)
        student.set_password(password)
        db.session.add(student)
        created.append({"username": username, "password": password})

    db.session.commit()
    return jsonify({
        "created":  len(created),
        "students": created,
        "message":  f"{len(created)} student accounts created for {org.name}.",
    }), 201


@admin_bp.route("/orgs/<int:org_id>/students/export", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def export_students_csv(org_id: int):
    org = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)
    students = User.query.filter_by(org_id=org.id, role=UserRole.STUDENT).order_by(User.username).all()
    output   = io.StringIO()
    writer   = csv.writer(output)
    writer.writerow(["username", "role", "is_active", "created_at"])
    for s in students:
        writer.writerow([s.username, s.role.value, s.is_active, s.created_at.isoformat()])
    return Response(output.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={org.slug}_students.csv"})


@admin_bp.route("/orgs/<int:org_id>/entitlement", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def grant_org_entitlement(org_id: int):
    admin = _get_current_user()
    org   = Org.query.get(org_id)
    if not org:
        return error_response("not_found", "Org not found.", 404)
    data    = request.get_json(silent=True) or {}
    exam    = (data.get("exam")    or "").strip().lower()
    plan_id = (data.get("plan_id") or "").strip().lower()
    days    = data.get("duration_days", 365)
    if exam    not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
    if plan_id not in ("basic", "premium"):
        return bad_request("validation_error", "plan_id must be 'basic' or 'premium'.")
    if not isinstance(days, int) or days < 1:
        return bad_request("validation_error", "duration_days must be a positive integer.")
    now     = datetime.now(timezone.utc)
    expires = now + timedelta(days=days)
    plan_type_map = {"basic": PlanType.ORG_BASIC, "premium": PlanType.ORG_PREMIUM}
    ent = Entitlement(
        org_id=org.id, exam=exam, plan_id=PlanId(plan_id),
        plan_type=plan_type_map[plan_id], max_world_index=PLAN_WORLD_LIMIT[plan_id],
        entitlement_starts_at=now, entitlement_expires_at=expires, granted_by_admin_id=admin.id,
    )
    db.session.add(ent)
    db.session.commit()
    return jsonify({"entitlement": ent.to_dict(),
                    "message": f"Org {org.name!r} granted {plan_id} plan for {exam} ({days} days)."}), 201


# ═════════════════════════════════════════════════════════════════════════════
# USERS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/users", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_users():
    page     = max(1, int(request.args.get("page",     1) or 1))
    per_page = min(200, max(1, int(request.args.get("per_page", 50) or 50)))
    role     = request.args.get("role",   "").strip().lower()
    search   = request.args.get("search", "").strip()
    q        = User.query
    if role:
        try:
            q = q.filter(User.role == UserRole(role))
        except ValueError:
            return bad_request("invalid_role", f"Invalid role: {role!r}.")
    if search:
        q = q.filter(User.username.ilike(f"%{search}%"))
    q = q.order_by(User.created_at.desc())
    items, total = _paginate(q, page, per_page)
    return jsonify({"users": [u.to_dict() for u in items], "total": total,
                    "page": page, "per_page": per_page}), 200


@admin_bp.route("/users", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def create_admin_user():
    admin    = _get_current_user()
    data     = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or _random_password()
    if not username: return bad_request("validation_error", "username is required.")
    if len(username) < 3: return bad_request("validation_error", "username must be at least 3 characters.")
    max_admins    = current_app.config.get("MAX_DRFAHM_ADMINS", 5)
    current_count = User.query.filter_by(role=UserRole.DRFAHM_ADMIN).count()
    if current_count >= max_admins:
        return forbidden(f"Maximum {max_admins} admin accounts allowed.")
    if User.query.filter_by(username=username).first():
        return conflict(f"Username {username!r} already taken.")
    new_admin = User(username=username, role=UserRole.DRFAHM_ADMIN)
    new_admin.set_password(password)
    db.session.add(new_admin)
    db.session.commit()
    return jsonify({"user": new_admin.to_dict(), "password": password,
                    "message": "Admin created. Save the password — it cannot be retrieved later."}), 201


@admin_bp.route("/users/<int:user_id>/activate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def activate_user(user_id: int):
    user = User.query.get(user_id)
    if not user: return error_response("not_found", "User not found.", 404)
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def deactivate_user(user_id: int):
    user = User.query.get(user_id)
    if not user: return error_response("not_found", "User not found.", 404)
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict()}), 200


@admin_bp.route("/users/<int:user_id>/reset-password", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def reset_user_password(user_id: int):
    data = request.get_json(silent=True) or {}
    user = User.query.get(user_id)
    if not user: return error_response("not_found", "User not found.", 404)
    new_password = data.get("password") or _random_password()
    user.set_password(new_password)
    db.session.commit()
    return jsonify({"user": user.to_dict(), "password": new_password,
                    "message": "Password reset. Save it — it cannot be retrieved later."}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@roles_required(*_ADMIN_ROLE)
def delete_user(user_id: int):
    """
    Hard-delete a user account.

    Restrictions:
    - Cannot delete your own account.
    - Cannot delete drfahm_admin accounts (use deactivate instead).

    Cascades via DB FK (ondelete=CASCADE):
    LevelProgress, WorldProgress, ExamTrial, Entitlement rows for this user
    are deleted automatically.
    """
    admin = _get_current_user()
    user  = db.session.get(User, user_id)
    if not user:
        return error_response("not_found", "User not found.", 404)
    if user.id == admin.id:
        return forbidden("self_delete", "You cannot delete your own account.")
    if user.role == UserRole.DRFAHM_ADMIN:
        return forbidden("delete_admin",
                         "Admin accounts cannot be deleted. Use deactivate instead.")
    username = user.username
    db.session.delete(user)
    db.session.commit()
    return jsonify({
        "message":          f"User '{username}' permanently deleted.",
        "deleted_username": username,
    }), 200


# ── DELETE /api/admin/orgs/<org_id> ──────────────────────────────────────────

@admin_bp.route("/orgs/<int:org_id>", methods=["DELETE"])
@roles_required(*_ADMIN_ROLE)
def delete_org(org_id: int):
    """
    Hard-delete a school (Org) AND all its student/leader accounts.

    Deletion order:
    1. Delete all User accounts with org_id = org_id (students + leader).
       Each user deletion cascades to LevelProgress, WorldProgress,
       ExamTrial, Entitlement rows via DB FK (ondelete=CASCADE).
    2. Delete the Org record itself (cascades memberships/entitlements).

    Query param:
      ?delete_students=false   — skip student deletion (keep accounts, just remove school)
    """
    org = db.session.get(Org, org_id)
    if not org:
        return error_response("not_found", "School not found.", 404)

    delete_students = request.args.get("delete_students", "true").lower() != "false"
    deleted_students = 0

    if delete_students:
        # Explicit deletion in FK-safe order (no reliance on DB cascade)
        members = User.query.filter_by(org_id=org.id).all()
        member_ids = [m.id for m in members]

        if member_ids:
            # 1. Delete progress records
            LevelProgress.query.filter(LevelProgress.user_id.in_(member_ids)).delete(synchronize_session=False)
            WorldProgress.query.filter(WorldProgress.user_id.in_(member_ids)).delete(synchronize_session=False)
            # 2. Delete individual entitlements
            Entitlement.query.filter(Entitlement.user_id.in_(member_ids)).delete(synchronize_session=False)
            # 3. Delete the users themselves
            User.query.filter(User.id.in_(member_ids)).delete(synchronize_session=False)
            deleted_students = len(member_ids)

        db.session.flush()

    # Delete org-level entitlements
    Entitlement.query.filter_by(org_id=org.id).delete(synchronize_session=False)
    db.session.flush()

    name = org.name
    db.session.delete(org)
    db.session.commit()

    return jsonify({
        "message":         f"School '{name}' deleted with {deleted_students} student accounts.",
        "deleted_name":    name,
        "deleted_students": deleted_students,
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# STATS  (K4: extended with by_review_status + by_section_detail)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stats", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_stats():
    now = datetime.now(timezone.utc)

    total_questions      = Question.query.filter(Question.deleted_at.is_(None)).count()
    active_questions     = Question.query.filter(Question.deleted_at.is_(None), Question.is_active == True).count()
    unassigned_questions = Question.query.filter(Question.deleted_at.is_(None), Question.world_key.is_(None)).count()
    total_users          = User.query.filter_by(role=UserRole.STUDENT).count()
    total_orgs           = Org.query.count()
    active_entitlements  = Entitlement.query.filter(Entitlement.entitlement_expires_at > now).count()

    questions_per_exam = dict(
        db.session.query(Question.exam, func.count(Question.id))
        .filter(Question.deleted_at.is_(None)).group_by(Question.exam).all()
    )
    questions_per_section = dict(
        db.session.query(Question.section, func.count(Question.id))
        .filter(Question.deleted_at.is_(None)).group_by(Question.section).all()
    )

    by_review_status = {s.value: 0 for s in ReviewStatus}
    review_rows = db.session.query(
        Question.review_status,
        func.count(Question.id).label("cnt"),
    ).filter(Question.deleted_at.is_(None)).group_by(Question.review_status).all()
    for row in review_rows:
        key = row.review_status.value if row.review_status else ReviewStatus.UNREVIEWED.value
        by_review_status[key] = by_review_status.get(key, 0) + int(row.cnt)

    section_rows = db.session.query(
        Question.section,
        func.count(Question.id).label("total"),
        func.sum(case((Question.is_active.is_(True), 1), else_=0)).label("active"),
        func.sum(case((Question.last_reviewed_at.isnot(None), 1), else_=0)).label("reviewed"),
        func.sum(case((Question.world_key.is_(None), 1), else_=0)).label("unassigned"),
    ).filter(Question.deleted_at.is_(None)).group_by(Question.section).all()

    by_section_detail = {}
    for row in section_rows:
        sec = row.section or "unknown"
        by_section_detail[sec] = {
            "total":      int(row.total      or 0),
            "active":     int(row.active     or 0),
            "reviewed":   int(row.reviewed   or 0),
            "unassigned": int(row.unassigned or 0),
        }

    return jsonify({
        "questions": {
            "total":             total_questions,
            "active":            active_questions,
            "unassigned":        unassigned_questions,
            "per_exam":          questions_per_exam,
            "per_section":       questions_per_section,
            "by_review_status":  by_review_status,
            "by_section_detail": by_section_detail,
        },
        "users":        {"students": total_users},
        "orgs":         {"total": total_orgs},
        "entitlements": {"active": active_entitlements},
    }), 200