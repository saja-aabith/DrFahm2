"""
Admin API — drfahm_admin only.

All routes require role=drfahm_admin (enforced by @roles_required decorator).

Endpoints:
  Questions
    POST   /api/admin/questions/import
    GET    /api/admin/questions/bulk-template
    POST   /api/admin/questions/bulk-validate           (dry-run CSV)
    POST   /api/admin/questions/bulk-commit             (insert from CSV)
    POST   /api/admin/questions/bulk-delete             (soft-delete selected)
    POST   /api/admin/questions/bulk-assign             (assign topic/difficulty/world)
    POST   /api/admin/questions/ai-review               (Chunk J — AI review batch)
    GET    /api/admin/questions/next-index
    GET    /api/admin/questions/review-progress
    GET    /api/admin/questions/topic-coverage
    GET    /api/admin/questions                        (+ search, topic, section, unassigned, qid, review_status)
    GET    /api/admin/questions/:id
    PUT    /api/admin/questions/:id          (optimistic lock on version)
    DELETE /api/admin/questions/:id          (soft delete)
    PATCH  /api/admin/questions/:id/activate
    PATCH  /api/admin/questions/:id/mark-reviewed
    PATCH  /api/admin/questions/:id/approve-review      (Chunk J + K1)
    PATCH  /api/admin/questions/:id/reject-review       (Chunk J)
    POST   /api/admin/questions/bulk-activate
    POST   /api/admin/questions/bulk-topic

  Topics
    GET    /api/admin/topics

  Orgs
    POST   /api/admin/orgs
    GET    /api/admin/orgs
    GET    /api/admin/orgs/:org_id
    POST   /api/admin/orgs/:org_id/leader
    POST   /api/admin/orgs/:org_id/students/generate
    GET    /api/admin/orgs/:org_id/students/export   (CSV)
    POST   /api/admin/orgs/:org_id/entitlement

  Users
    GET    /api/admin/users
    POST   /api/admin/users
    PATCH  /api/admin/users/:user_id/activate
    PATCH  /api/admin/users/:user_id/deactivate
    POST   /api/admin/users/:user_id/reset-password

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

# Convenience alias used throughout this module
_wk_to_section = get_section_from_world_key

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

_ADMIN_ROLE = (UserRole.DRFAHM_ADMIN,)

# Valid (exam, section) combinations
_VALID_EXAM_SECTIONS = {
    "qudurat": {"math", "verbal"},
    "tahsili": {"math", "biology", "chemistry", "physics"},
}

# All valid sections
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
    """True if the (exam, section) combination is valid."""
    return section in _VALID_EXAM_SECTIONS.get(exam, set())


# ═════════════════════════════════════════════════════════════════════════════
# TOPICS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/topics", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_topics():
    """
    Returns the full topic taxonomy.
    Optional filter: ?section=math
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
# QUESTIONS — Legacy JSON import (kept for programmatic/seed use)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/import", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def import_questions():
    """
    Bulk import / upsert questions via JSON array.
    Upsert key: (exam, world_key, index).
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or []

    if not isinstance(data, list) or len(data) == 0:
        return bad_request("validation_error", "Body must be a non-empty JSON array.")

    valid_answers = {"a", "b", "c", "d"}
    upserted = 0

    for item in data:
        exam      = (item.get("exam")      or "").strip().lower()
        world_key = (item.get("world_key") or "").strip().lower() or None
        index     = item.get("index")
        answer    = (item.get("correct_answer") or "").strip().lower()
        section   = (item.get("section") or "").strip().lower() or None
        topic     = (item.get("topic") or "").strip() or None
        diff      = (item.get("difficulty") or "").strip().lower() or None

        if exam not in VALID_EXAMS:
            continue
        if world_key and world_key not in VALID_WORLD_KEYS:
            continue
        if answer not in valid_answers:
            continue

        if not section and world_key:
            section = _wk_to_section(world_key)

        existing = None
        if world_key and index is not None:
            existing = Question.query.filter_by(
                exam=exam, world_key=world_key, index=index, deleted_at=None
            ).first()

        if existing:
            existing.question_text  = item.get("question_text", existing.question_text)
            existing.option_a       = item.get("option_a", existing.option_a)
            existing.option_b       = item.get("option_b", existing.option_b)
            existing.option_c       = item.get("option_c", existing.option_c)
            existing.option_d       = item.get("option_d", existing.option_d)
            existing.correct_answer = answer
            existing.is_active      = bool(item.get("is_active", existing.is_active))
            existing.topic          = topic
            existing.difficulty     = Difficulty(diff) if diff and diff in {d.value for d in Difficulty} else existing.difficulty
            existing.version       += 1
        else:
            q = Question(
                exam=exam,
                section=section,
                world_key=world_key,
                index=index,
                question_text=item.get("question_text", ""),
                option_a=item.get("option_a", ""),
                option_b=item.get("option_b", ""),
                option_c=item.get("option_c", ""),
                option_d=item.get("option_d", ""),
                correct_answer=answer,
                hint=item.get("hint") or None,
                topic=topic,
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
                           "Constraint violation during bulk insert.",
                           {"detail": str(e.orig)})

    return jsonify({
        "imported": upserted,
        "message":  f"Successfully upserted {upserted} question(s). "
                    "Questions are inactive by default — activate individually or in bulk.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK CSV UPLOAD
# ═════════════════════════════════════════════════════════════════════════════

# CSV column order for template download
_CSV_COLUMNS = [
    "exam", "section", "question_text",
    "option_a", "option_b", "option_c", "option_d",
    "correct_answer", "hint", "topic", "difficulty",
]

# All 11 columns are required (hint may be empty but column must exist)
_CSV_REQUIRED = set(_CSV_COLUMNS)


def _normalize_text(text: str) -> str:
    """Normalize question text for exact-match duplicate detection."""
    t = (text or "").strip().lower()
    t = re.sub(r'\s+', ' ', t)
    t = re.sub(r'[^\w\s]', '', t)
    return t


def _parse_and_validate_csv(file_storage) -> dict:
    """
    Shared CSV parser for bulk-validate and bulk-commit.

    CSV columns (all required; hint may be empty):
      exam, section, question_text, option_a, option_b, option_c, option_d,
      correct_answer, hint, topic, difficulty

    NOTE: world_key is NOT in the CSV — questions go into the bank first.

    Returns dict with keys: valid, errors, duplicates, stats
    OR {"error": "..."} on hard parse failure.
    """
    try:
        raw = file_storage.read()
        try:
            text = raw.decode("utf-8-sig")   # handles BOM from Excel
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
    except Exception:
        return {"error": "Could not read CSV file."}

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        return {"error": "CSV file is empty or has no header row."}

    # Normalize header names
    clean_headers = [h.strip().lower().replace(" ", "_") for h in reader.fieldnames]

    missing_cols = _CSV_REQUIRED - set(clean_headers)
    if missing_cols:
        return {"error": f"CSV missing required columns: {sorted(missing_cols)}. "
                         f"Expected: {', '.join(_CSV_COLUMNS)}"}

    # Parse all rows
    rows = []
    for raw_row in reader:
        row = {}
        for orig_key, clean_key in zip(reader.fieldnames, clean_headers):
            row[clean_key] = (raw_row.get(orig_key) or "").strip()
        rows.append(row)

    if not rows:
        return {"error": "CSV has headers but no data rows."}

    valid_answers = {"a", "b", "c", "d"}
    valid_diffs   = {"easy", "medium", "hard"}

    errors     = []
    duplicates = []
    valid_rows = []
    csv_seen   = {}   # normalized_text → row_num

    # Pre-load existing questions for duplicate detection
    existing_set = {}
    for q in Question.query.filter(Question.deleted_at.is_(None)).with_entities(
        Question.id, Question.qid, Question.exam, Question.section, Question.question_text
    ).all():
        norm = _normalize_text(q.question_text)
        key  = f"{q.exam}::{q.section}::{norm}"
        existing_set[key] = {"id": q.id, "qid": str(q.qid) if q.qid else None}

    for row_num, row in enumerate(rows, start=2):
        exam    = (row.get("exam")    or "").strip().lower()
        section = (row.get("section") or "").strip().lower()
        answer  = (row.get("correct_answer") or "").strip().lower()
        diff    = (row.get("difficulty") or "").strip().lower()
        topic   = (row.get("topic") or "").strip().lower()

        # Required fields (hint is optional)
        for col in _CSV_COLUMNS:
            if col == "hint":
                continue
            if not row.get(col, "").strip():
                errors.append({"row": row_num, "field": col,
                               "message": f"'{col}' is required and cannot be empty."})
                break
        else:
            # Validate exam
            if exam not in VALID_EXAMS:
                errors.append({"row": row_num, "field": "exam",
                               "message": f"Must be 'qudurat' or 'tahsili', got '{exam}'."})
                continue

            # Validate section
            if section not in _ALL_SECTIONS:
                errors.append({"row": row_num, "field": "section",
                               "message": f"Must be: math, verbal, biology, chemistry, or physics."})
                continue

            # Validate (exam, section) combination
            if not _validate_exam_section(exam, section):
                valid_sections = sorted(_VALID_EXAM_SECTIONS.get(exam, set()))
                errors.append({"row": row_num, "field": "section",
                               "message": f"Section '{section}' is not valid for exam '{exam}'. "
                                          f"Valid sections for {exam}: {valid_sections}."})
                continue

            # Validate correct_answer
            if answer not in valid_answers:
                errors.append({"row": row_num, "field": "correct_answer",
                               "message": f"Must be a/b/c/d, got '{row['correct_answer']}'."})
                continue

            # Validate difficulty
            if diff not in valid_diffs:
                errors.append({"row": row_num, "field": "difficulty",
                               "message": f"Must be easy/medium/hard, got '{row['difficulty']}'."})
                continue

            # Validate topic against section (subject-specific enforcement)
            valid_topic_keys = {k for k, _ in TOPIC_TAXONOMY.get(section, [])}
            if topic not in valid_topic_keys:
                errors.append({"row": row_num, "field": "topic",
                               "message": f"Topic '{row['topic']}' is not valid for section "
                                          f"'{section}'. "
                                          f"Valid topics: {sorted(valid_topic_keys)}."})
                continue

            # Duplicate check — against existing DB
            norm_text = _normalize_text(row["question_text"])
            dup_key   = f"{exam}::{section}::{norm_text}"

            if dup_key in existing_set:
                match = existing_set[dup_key]
                duplicates.append({
                    "row":           row_num,
                    "question_text": row["question_text"][:120],
                    "existing_id":   match["id"],
                    "existing_qid":  match["qid"],
                    "duplicate_of_csv_row": None,
                })
                continue

            # Duplicate check — within this CSV
            if dup_key in csv_seen:
                duplicates.append({
                    "row":                  row_num,
                    "question_text":        row["question_text"][:120],
                    "existing_id":          None,
                    "existing_qid":         None,
                    "duplicate_of_csv_row": csv_seen[dup_key],
                })
                continue

            csv_seen[dup_key] = row_num

            valid_rows.append({
                "exam":           exam,
                "section":        section,
                "question_text":  row["question_text"],
                "option_a":       row["option_a"],
                "option_b":       row["option_b"],
                "option_c":       row["option_c"],
                "option_d":       row["option_d"],
                "correct_answer": answer,
                "hint":           row.get("hint") or None,   # empty string → None
                "topic":          topic,
                "difficulty":     diff,
                "_row":           row_num,
            })
            continue

    return {
        "valid":      valid_rows,
        "errors":     errors,
        "duplicates": duplicates,
        "stats": {
            "total_rows":      len(rows),
            "valid_count":     len(valid_rows),
            "error_count":     len(errors),
            "duplicate_count": len(duplicates),
        },
    }


@admin_bp.route("/questions/bulk-template", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def bulk_template():
    """
    Download a CSV template for bulk question upload.
    Includes header + 2 example rows.

    NOTE: world_key is NOT a column — questions go into the bank first,
    world/level assignment is done later via admin bulk tools.
    hint column is optional — leave empty if unknown, AI Review will generate it.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(_CSV_COLUMNS)
    writer.writerow([
        "qudurat", "math", "What is 2 + 2?",
        "3", "4", "5", "6", "b",
        "Think about basic addition: start with 2 and count 2 more.",
        "arithmetic", "easy",
    ])
    writer.writerow([
        "qudurat", "verbal", "The synonym of 'happy' is:",
        "Sad", "Joyful", "Angry", "Tired", "b",
        "",   # hint intentionally blank — AI Review will generate it
        "synonyms", "easy",
    ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=drfahm_bulk_template.csv"},
    )


@admin_bp.route("/questions/bulk-validate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_validate():
    """
    Dry-run validation of a CSV file. Zero DB writes.
    Accepts: multipart/form-data with 'file' field (CSV).
    """
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
        "stats":      result["stats"],
        "errors":     result["errors"],
        "duplicates": result["duplicates"],
        "preview":    result["valid"][:20],
    }), 200


@admin_bp.route("/questions/bulk-commit", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_commit():
    """
    Parse, validate, and insert questions from CSV into the question bank.
    Questions are inserted WITHOUT world_key or index (unassigned).
    All questions inserted as is_active=false.
    Optional query param: ?force_duplicates=true
    """
    admin = _get_current_user()

    if "file" not in request.files:
        return bad_request("no_file", "No file uploaded. Send a CSV as multipart 'file' field.")

    f = request.files["file"]
    if not f.filename or not f.filename.lower().endswith(".csv"):
        return bad_request("invalid_format", "Only .csv files are accepted.")

    force_dupes = request.args.get("force_duplicates", "false").lower() == "true"

    result = _parse_and_validate_csv(f)
    if "error" in result:
        return bad_request("csv_parse_error", result["error"])

    if result["stats"]["error_count"] > 0:
        return bad_request("validation_errors",
                           f"{result['stats']['error_count']} row(s) failed validation. "
                           "Fix errors and re-upload.",
                           {
                               "stats":  result["stats"],
                               "errors": result["errors"][:50],
                           })

    rows_to_insert = result["valid"]
    if not force_dupes:
        # duplicates are excluded from valid_rows already by the parser
        pass

    if not rows_to_insert:
        return jsonify({
            "inserted":   0,
            "skipped":    result["stats"]["duplicate_count"],
            "errors":     [],
            "duplicates": result["duplicates"],
            "message":    "No new questions to insert (all rows were duplicates or invalid).",
        }), 200

    now      = datetime.now(timezone.utc)
    inserted = 0

    for row in rows_to_insert:
        diff = row.get("difficulty")
        q = Question(
            exam=row["exam"],
            section=row["section"],
            question_text=row["question_text"],
            option_a=row["option_a"],
            option_b=row["option_b"],
            option_c=row["option_c"],
            option_d=row["option_d"],
            correct_answer=row["correct_answer"],
            hint=row.get("hint") or None,
            topic=row.get("topic") or None,
            difficulty=Difficulty(diff) if diff and diff in {d.value for d in Difficulty} else None,
            is_active=False,
            created_by_admin_id=admin.id,
            updated_by_admin_id=admin.id,
        )
        db.session.add(q)
        inserted += 1

    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        return bad_request("import_conflict",
                           "Constraint violation during bulk insert.",
                           {"detail": str(e.orig)})

    return jsonify({
        "inserted":   inserted,
        "skipped":    result["stats"]["duplicate_count"] if not force_dupes else 0,
        "errors":     result["errors"],
        "duplicates": result["duplicates"],
        "message":    f"Successfully inserted {inserted} question(s) into the question bank. "
                      "All questions are unassigned and inactive. "
                      "Use Bulk Assign to place them into worlds, then activate.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK DELETE
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-delete", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_delete_questions():
    """
    Soft-delete a list of questions by ID.
    Body: { "question_ids": [int], "confirm": true }
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    ids = data.get("question_ids")
    if not isinstance(ids, list) or len(ids) == 0:
        return bad_request("validation_error",
                           "question_ids must be a non-empty array of integer IDs.")
    if len(ids) > 500:
        return bad_request("validation_error", "Maximum 500 IDs per bulk-delete call.")
    if not data.get("confirm"):
        return bad_request("confirmation_required",
                           "Set confirm: true to proceed with bulk deletion.")

    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return bad_request("validation_error", "All question_ids must be integers.")

    now = datetime.now(timezone.utc)

    affected = Question.query.filter(
        Question.id.in_(ids),
        Question.deleted_at.is_(None),
    ).update(
        {
            "deleted_at":          now,
            "is_active":           False,
            "deleted_by_admin_id": admin.id,
            "updated_by_admin_id": admin.id,
            "updated_at":          now,
        },
        synchronize_session=False,
    )
    db.session.commit()

    return jsonify({
        "deleted": affected,
        "message": f"{affected} question(s) soft-deleted.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# BULK ASSIGN
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-assign", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_assign_questions():
    """
    Bulk assign topic, difficulty, and/or world to selected questions.
    Body: { "question_ids": [int], "assign": { "topic"?, "difficulty"?, "world_key"? } }
    """
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
                           "'assign' must be a non-empty object with at least one field "
                           "(topic, difficulty, world_key).")

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
        Question.id.in_(ids),
        Question.deleted_at.is_(None),
    ).all()

    if not questions:
        return bad_request("not_found", "No active questions found for the provided IDs.")

    now          = datetime.now(timezone.utc)
    skipped      = []
    affected_ids = []

    world_index_counter = {}
    if wk_val:
        world_section = _wk_to_section(wk_val)
        for q in questions:
            exam_key        = q.exam
            wk_counter_key  = (exam_key, wk_val)
            if wk_counter_key not in world_index_counter:
                current_max = db.session.query(func.max(Question.index)).filter(
                    Question.exam      == exam_key,
                    Question.world_key == wk_val,
                    Question.deleted_at.is_(None),
                ).scalar()
                world_index_counter[wk_counter_key] = current_max or 0

    for q in questions:
        if topic_val:
            valid_keys_for_section = {k for k, _ in TOPIC_TAXONOMY.get(q.section or "", [])}
            if topic_val not in valid_keys_for_section:
                skipped.append({
                    "id":     q.id,
                    "reason": f"Topic '{topic_val}' is not valid for section '{q.section}'.",
                })
                continue

        if wk_val:
            world_section = _wk_to_section(wk_val)
            if q.section and q.section != world_section:
                skipped.append({
                    "id":     q.id,
                    "reason": f"Cannot assign question #{q.id} (section: {q.section!r}) "
                               f"to world '{wk_val}' (section: {world_section!r}).",
                })
                continue

        if topic_val is not None:
            q.topic = topic_val
        if diff_val is not None:
            q.difficulty = Difficulty(diff_val)
        if wk_val is not None:
            counter_key = (q.exam, wk_val)
            world_index_counter[counter_key] = world_index_counter.get(counter_key, 0) + 1
            q.world_key = wk_val
            q.index     = world_index_counter[counter_key]

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
        "affected":  len(affected_ids),
        "assigned":  assigned_summary,
        "skipped":   skipped,
        "message":   f"{len(affected_ids)} question(s) updated. "
                     f"{len(skipped)} skipped due to section mismatch.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# AI REVIEW  (Chunk J + K1)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/ai-review", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def ai_review_questions():
    """
    Trigger AI review for a selected batch of questions.

    The LLM proposes: predicted_answer, confidence, review_note, proposed_hint,
    and (K1) predicted_topic.
    Nothing is written to correct_answer, hint, or topic until admin approves.

    Body:
    {
      "question_ids": [int],   -- required, max 20 per call
      "overwrite": false        -- optional; if true, re-reviews approved questions
    }
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from ..utils.llm_provider import get_llm_provider  # noqa: PLC0415

    data      = request.get_json(silent=True) or {}
    ids       = data.get("question_ids")
    overwrite = bool(data.get("overwrite", False))

    if not isinstance(ids, list) or len(ids) == 0:
        return bad_request("validation_error",
                           "question_ids must be a non-empty array of integer IDs.")
    if len(ids) > 20:
        return bad_request("validation_error",
                           "Maximum 20 questions per AI review call. "
                           "The frontend batches larger selections automatically.")
    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return bad_request("validation_error", "All question_ids must be integers.")

    questions = Question.query.filter(
        Question.id.in_(ids),
        Question.deleted_at.is_(None),
    ).all()

    if not questions:
        return bad_request("not_found", "No active questions found for the provided IDs.")

    # Partition: skip already-approved unless overwrite=True
    to_review        = []
    skipped_approved = []
    for q in questions:
        if not overwrite and q.review_status == ReviewStatus.APPROVED:
            skipped_approved.append(q.id)
        else:
            to_review.append(q)

    if not to_review:
        return jsonify({
            "processed":        0,
            "failed":           0,
            "skipped_approved": skipped_approved,
            "results":          [],
            "message":          "All selected questions are already approved. "
                                "Pass overwrite=true to re-review.",
        }), 200

    try:
        provider = get_llm_provider()
    except RuntimeError as exc:
        return error_response("not_implemented", str(exc), 501)

    # K1: pre-compute valid topic keys per section so threads can pass them
    # to the LLM. Done once here, outside the thread pool.
    section_topics: dict = {
        sec: [k for k, _ in topics]
        for sec, topics in TOPIC_TAXONOMY.items()
    }

    def _call_one(q):
        return provider.review_question(
            question_id=q.id,
            exam=q.exam,
            section=q.section or "",
            question_text=q.question_text,
            option_a=q.option_a,
            option_b=q.option_b,
            option_c=q.option_c,
            option_d=q.option_d,
            valid_topics=section_topics.get(q.section or "", []),  # K1
        )

    # Mark all as ai_pending before firing threads
    now = datetime.now(timezone.utc)
    for q in to_review:
        q.review_status = ReviewStatus.AI_PENDING
        q.updated_at    = now
    db.session.commit()

    processed    = 0
    failed       = 0
    results_out  = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_q = {executor.submit(_call_one, q): q for q in to_review}
        for future in as_completed(future_to_q):
            q      = future_to_q[future]
            q_id   = q.id
            now    = datetime.now(timezone.utc)
            try:
                result = future.result()
            except Exception as exc:
                q.review_status = ReviewStatus.UNREVIEWED
                q.updated_at    = now
                failed += 1
                results_out.append({
                    "question_id":     q_id,
                    "status":          "failed",
                    "predicted_answer": None,
                    "confidence":      None,
                    "review_note":     None,
                    "proposed_hint":   None,
                    "predicted_topic": None,
                    "error":           str(exc),
                })
                continue

            if result.error:
                q.review_status = ReviewStatus.UNREVIEWED
                q.updated_at    = now
                failed += 1
                results_out.append({
                    "question_id":     q_id,
                    "status":          "failed",
                    "predicted_answer": None,
                    "confidence":      None,
                    "review_note":     None,
                    "proposed_hint":   None,
                    "predicted_topic": None,
                    "error":           result.error,
                })
            else:
                q.llm_predicted_answer = result.predicted_answer
                q.llm_confidence       = result.confidence
                q.llm_review_note      = result.review_note
                q.llm_proposed_hint    = result.proposed_hint
                q.llm_predicted_topic  = result.predicted_topic  # K1
                q.llm_reviewed_at      = now
                q.review_status        = ReviewStatus.AI_REVIEWED
                q.updated_at           = now
                processed += 1
                results_out.append({
                    "question_id":     q_id,
                    "status":          "reviewed",
                    "predicted_answer": result.predicted_answer,
                    "confidence":      result.confidence,
                    "review_note":     result.review_note,    # internal — admin panel only
                    "proposed_hint":   result.proposed_hint,
                    "predicted_topic": result.predicted_topic,  # K1
                    "error":           None,
                })

    db.session.commit()

    return jsonify({
        "processed":        processed,
        "failed":           failed,
        "skipped_approved": skipped_approved,
        "results":          results_out,
        "message":          f"AI review complete: {processed} reviewed, "
                            f"{failed} failed, {len(skipped_approved)} skipped (approved).",
    }), 200


@admin_bp.route("/questions/<int:question_id>/approve-review", methods=["PATCH"])
@roles_required(*_ADMIN_ROLE)
def approve_ai_review(question_id: int):
    """
    Admin approves AI review suggestions for a single question.

    Body:
    {
      "version":        int,             -- required (optimistic lock)
      "accept_answer":  true|false,      -- default true
      "accept_hint":    true|false,      -- default true
      "accept_topic":   true|false,      -- default true (K1)
      "correct_answer": "a"|"b"|"c"|"d", -- optional override
      "topic":          "algebra"         -- optional override; must be valid for section (K1)
    }
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    if q.review_status not in (ReviewStatus.AI_REVIEWED, ReviewStatus.REJECTED):
        return bad_request(
            "invalid_state",
            f"Cannot approve — review_status is '{q.review_status.value}'. "
            "Expected 'ai_reviewed' or 'rejected'.",
        )

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Version mismatch (submitted {submitted_version}, current {q.version}). "
            "Reload and retry.",
            {"current_record": q.to_dict(include_answer=True)},
        )

    accept_answer   = bool(data.get("accept_answer", True))
    accept_hint     = bool(data.get("accept_hint",   True))
    override_answer = (data.get("correct_answer") or "").strip().lower() or None

    now = datetime.now(timezone.utc)

    if accept_answer:
        final_answer = override_answer or q.llm_predicted_answer
        if not final_answer or final_answer not in {"a", "b", "c", "d"}:
            return bad_request(
                "validation_error",
                "No valid answer available to approve. "
                "Either supply correct_answer in the body or ensure the question "
                "has been AI-reviewed first.",
            )
        q.correct_answer            = final_answer
        q.last_reviewed_at          = now
        q.last_reviewed_by_admin_id = admin.id

    if accept_hint and q.llm_proposed_hint:
        q.hint = q.llm_proposed_hint

    # K1 — topic acceptance
    # accept_topic defaults to True. If admin supplies an explicit topic override
    # it takes precedence over the AI prediction.
    accept_topic = bool(data.get("accept_topic", True))
    if accept_topic:
        topic_to_set = (data.get("topic") or "").strip().lower() or q.llm_predicted_topic
        if topic_to_set:
            # Hard-validate against section's controlled vocab — same rules as CSV import.
            section_key = q.section or (_wk_to_section(q.world_key) if q.world_key else None)
            if section_key:
                valid_keys = {k for k, _ in TOPIC_TAXONOMY.get(section_key, [])}
                if topic_to_set not in valid_keys:
                    return bad_request(
                        "invalid_topic",
                        f"Topic '{topic_to_set}' is not valid for section '{section_key}'. "
                        f"Valid topics: {sorted(valid_keys)}.",
                    )
            elif topic_to_set not in ALL_TOPIC_KEYS:
                return bad_request("invalid_topic",
                                   f"Invalid topic key: '{topic_to_set}'.")
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
    """
    Admin rejects AI review suggestions.
    Sets review_status='rejected'. Does NOT change correct_answer, hint, or topic.
    Body: { "version": int }
    """
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Version mismatch (submitted {submitted_version}, current {q.version}). "
            "Reload and retry.",
            {"current_record": q.to_dict(include_answer=True)},
        )

    now = datetime.now(timezone.utc)
    q.review_status       = ReviewStatus.REJECTED
    q.updated_by_admin_id = admin.id
    q.updated_at          = now
    q.version            += 1

    db.session.commit()
    return jsonify({"question": q.to_dict(include_answer=True)}), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTION — next-index
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
        Question.exam      == exam,
        Question.world_key == world_key,
        Question.deleted_at.is_(None),
    ).scalar()

    return jsonify({"exam": exam, "world_key": world_key, "next_index": (max_idx or 0) + 1}), 200


# ═════════════════════════════════════════════════════════════════════════════
# REVIEW PROGRESS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/review-progress", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def review_progress():
    exam_filter = request.args.get("exam", "").strip().lower() or None

    q = db.session.query(
        Question.exam,
        Question.section,
        func.count(Question.id).label("total"),
        func.sum(
            case((Question.last_reviewed_at.isnot(None), 1), else_=0)
        ).label("reviewed"),
    ).filter(
        Question.deleted_at.is_(None),
    ).group_by(
        Question.exam,
        Question.section,
    ).order_by(
        Question.exam,
        Question.section,
    )

    if exam_filter:
        if exam_filter not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")
        q = q.filter(Question.exam == exam_filter)

    rows = q.all()

    progress     = []
    total_all    = 0
    reviewed_all = 0

    for row in rows:
        reviewed = int(row.reviewed or 0)
        total    = int(row.total or 0)
        progress.append({
            "exam":       row.exam,
            "section":    row.section,
            "total":      total,
            "reviewed":   reviewed,
            "unreviewed": total - reviewed,
        })
        total_all    += total
        reviewed_all += reviewed

    return jsonify({
        "progress": progress,
        "summary": {
            "total":      total_all,
            "reviewed":   reviewed_all,
            "unreviewed": total_all - reviewed_all,
        },
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# TOPIC COVERAGE
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/topic-coverage", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def topic_coverage():
    exam_filter    = request.args.get("exam", "").strip().lower() or None
    section_filter = request.args.get("section", "").strip().lower() or None

    if exam_filter and exam_filter not in VALID_EXAMS:
        return bad_request("invalid_exam", f"Invalid exam: {exam_filter!r}.")
    if section_filter and section_filter not in _ALL_SECTIONS:
        return bad_request("invalid_section", f"Invalid section: {section_filter!r}.")

    base_q = Question.query.filter(Question.deleted_at.is_(None))
    if exam_filter:
        base_q = base_q.filter(Question.exam == exam_filter)
    if section_filter:
        base_q = base_q.filter(Question.section == section_filter)

    total    = base_q.count()
    untagged = base_q.filter(
        (Question.topic.is_(None)) | (Question.topic == "")
    ).count()
    tagged = total - untagged

    topic_q = db.session.query(
        Question.section,
        Question.exam,
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
        topic_q = topic_q.filter(Question.section == section_filter)

    topic_q = topic_q.group_by(
        Question.section, Question.exam, Question.topic
    ).order_by(Question.section, func.count(Question.id).desc())

    rows = topic_q.all()

    by_section = {}
    for section_key, topics in TOPIC_TAXONOMY.items():
        if section_filter and section_key != section_filter:
            continue
        by_section[section_key] = {
            "total":      0,
            "tagged":     0,
            "untagged":   0,
            "pct_tagged": 0.0,
            "topics":     {k: {"topic": k, "label": lbl, "count": 0} for k, lbl in topics},
        }

    sec_total_q = db.session.query(
        Question.section,
        func.count(Question.id).label("total"),
        func.sum(case(
            ((Question.topic.is_(None)) | (Question.topic == ""), 1),
            else_=0
        )).label("untagged"),
    ).filter(Question.deleted_at.is_(None))

    if exam_filter:
        sec_total_q = sec_total_q.filter(Question.exam == exam_filter)
    if section_filter:
        sec_total_q = sec_total_q.filter(Question.section == section_filter)

    sec_total_q = sec_total_q.group_by(Question.section)

    for sec_row in sec_total_q.all():
        sec = sec_row.section
        if sec in by_section:
            t = int(sec_row.total or 0)
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
        flat_coverage.append({
            "section": sec,
            "topic":   row.topic,
            "label":   TOPIC_KEY_TO_LABEL.get(row.topic, row.topic),
            "count":   int(row.count),
        })

    by_section_out = {}
    for sec, sec_data in by_section.items():
        by_section_out[sec] = {
            "total":      sec_data["total"],
            "tagged":     sec_data["tagged"],
            "untagged":   sec_data["untagged"],
            "pct_tagged": sec_data["pct_tagged"],
            "topics":     sorted(sec_data["topics"].values(), key=lambda x: x["count"], reverse=True),
        }

    pct_tagged = round(tagged / total * 100, 1) if total else 0.0

    return jsonify({
        "coverage":   flat_coverage,
        "by_section": by_section_out,
        "summary": {
            "total":      total,
            "tagged":     tagged,
            "untagged":   untagged,
            "pct_tagged": pct_tagged,
        },
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# QUESTIONS — List / Get / Update / Delete
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def list_questions():
    """List questions with filters and pagination."""
    page       = max(1, int(request.args.get("page",     1) or 1))
    per_page   = min(200, max(1, int(request.args.get("per_page", 50) or 50)))
    exam       = request.args.get("exam",       "").strip().lower() or None
    section    = request.args.get("section",    "").strip().lower() or None
    world_key  = request.args.get("world_key",  "").strip().lower() or None
    topic      = request.args.get("topic",      "").strip().lower() or None
    difficulty = request.args.get("difficulty", "").strip().lower() or None
    is_active  = request.args.get("is_active",  "").strip().lower() or None
    unassigned = request.args.get("unassigned", "").strip().lower() or None
    reviewed   = request.args.get("reviewed",   "").strip().lower() or None
    review_status = request.args.get("review_status", "").strip().lower() or None
    search     = request.args.get("search",     "").strip() or None
    qid        = request.args.get("qid",        "").strip() or None

    q = Question.query.filter(Question.deleted_at.is_(None))

    if qid:
        q = q.filter(Question.qid.cast(db.String).ilike(f"%{qid}%"))
    if exam:
        if exam not in VALID_EXAMS:
            return bad_request("invalid_exam", f"Invalid exam: {exam!r}.")
        q = q.filter(Question.exam == exam)
    if section:
        q = q.filter(Question.section == section)
    if world_key:
        if world_key not in VALID_WORLD_KEYS:
            return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
        q = q.filter(Question.world_key == world_key)
    if topic:
        q = q.filter(Question.topic == topic)
    if difficulty:
        try:
            q = q.filter(Question.difficulty == Difficulty(difficulty))
        except ValueError:
            return bad_request("invalid_difficulty", f"Invalid difficulty: {difficulty!r}.")
    if is_active == "true":
        q = q.filter(Question.is_active == True)
    elif is_active == "false":
        q = q.filter(Question.is_active == False)
    if unassigned == "true":
        q = q.filter(Question.world_key.is_(None))
    elif unassigned == "false":
        q = q.filter(Question.world_key.isnot(None))
    if reviewed:
        if reviewed == "true":
            q = q.filter(Question.last_reviewed_at.isnot(None))
        elif reviewed == "false":
            q = q.filter(Question.last_reviewed_at.is_(None))
    if review_status:
        valid_statuses = {s.value for s in ReviewStatus}
        if review_status in valid_statuses:
            q = q.filter(Question.review_status == ReviewStatus(review_status))
    if search:
        q = q.filter(Question.question_text.ilike(f"%{search}%"))

    q = q.order_by(
        Question.exam,
        Question.section,
        Question.world_key.nullslast(),
        Question.index.nullslast(),
    )

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
    """Update question. Requires version for optimistic locking."""
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Question was modified by another admin (expected version {submitted_version}, "
            f"current version {q.version}). Reload and retry.",
            {"current_record": q.to_dict(include_answer=True)},
        )

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
                                       f"Topic '{topic_val}' is not valid for section '{section_key}'.")
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
    q.deleted_at          = now
    q.deleted_by_admin_id = admin.id
    q.is_active           = False
    q.updated_by_admin_id = admin.id
    q.updated_at          = now
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

    q = Question.query.filter_by(id=question_id, deleted_at=None).first()
    if not q:
        return error_response("not_found", "Question not found.", 404)

    submitted_version = data.get("version")
    if submitted_version is None:
        return bad_request("version_required", "version is required.")
    if int(submitted_version) != q.version:
        return conflict(
            f"Version mismatch (submitted {submitted_version}, current {q.version}). "
            "Reload and retry.",
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
# BULK ACTIVATE / BULK TOPIC (legacy — kept for backward compat)
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/questions/bulk-activate", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_activate_questions():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

    if "is_active" not in data:
        return bad_request("validation_error", "is_active (boolean) is required.")

    is_active = bool(data["is_active"])
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
    return jsonify({
        "affected":  affected,
        "message":   f"{affected} question(s) {action}.",
        "is_active": is_active,
    }), 200


@admin_bp.route("/questions/bulk-topic", methods=["POST"])
@roles_required(*_ADMIN_ROLE)
def bulk_assign_topic():
    admin = _get_current_user()
    data  = request.get_json(silent=True) or {}

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
    return jsonify({
        "affected": affected,
        "topic":    topic_val,
        "message":  f"{affected} question(s) topic set to '{label}'.",
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

    q = Org.query
    if search:
        q = q.filter(Org.name.ilike(f"%{search}%") | Org.slug.ilike(f"%{search}%"))
    q = q.order_by(Org.created_at.desc())

    items, total = _paginate(q, page, per_page)
    return jsonify({
        "orgs":     [o.to_dict() for o in items],
        "total":    total,
        "page":     page,
        "per_page": per_page,
    }), 200


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
        "org":          org.to_dict(),
        "leader":       leader.to_dict() if leader else None,
        "students":     [s.to_dict() for s in students],
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
        "user":     leader.to_dict(),
        "password": password,
        "message":  "Leader created. Save the password — it cannot be retrieved later.",
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

    prefix  = org.slug[:8]
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

    students = User.query.filter_by(
        org_id=org.id, role=UserRole.STUDENT
    ).order_by(User.username).all()

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

    data    = request.get_json(silent=True) or {}
    exam    = (data.get("exam")    or "").strip().lower()
    plan_id = (data.get("plan_id") or "").strip().lower()
    days    = data.get("duration_days", 365)

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
    page     = max(1, int(request.args.get("page",     1) or 1))
    per_page = min(200, max(1, int(request.args.get("per_page", 50) or 50)))
    role     = request.args.get("role",   "").strip().lower()
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
        "users":    [u.to_dict() for u in items],
        "total":    total,
        "page":     page,
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

    max_admins    = current_app.config.get("MAX_DRFAHM_ADMINS", 5)
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
        "user":     new_admin.to_dict(),
        "password": password,
        "message":  "Admin created. Save the password — it cannot be retrieved later.",
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
        "user":     user.to_dict(),
        "password": new_password,
        "message":  "Password reset. Save it — it cannot be retrieved later.",
    }), 200


# ═════════════════════════════════════════════════════════════════════════════
# STATS
# ═════════════════════════════════════════════════════════════════════════════

@admin_bp.route("/stats", methods=["GET"])
@roles_required(*_ADMIN_ROLE)
def get_stats():
    now = datetime.now(timezone.utc)

    total_questions      = Question.query.filter(Question.deleted_at.is_(None)).count()
    active_questions     = Question.query.filter(Question.deleted_at.is_(None), Question.is_active == True).count()
    unassigned_questions = Question.query.filter(Question.deleted_at.is_(None), Question.world_key.is_(None)).count()

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

    questions_per_section = dict(
        db.session.query(Question.section, func.count(Question.id))
        .filter(Question.deleted_at.is_(None))
        .group_by(Question.section)
        .all()
    )

    return jsonify({
        "questions": {
            "total":       total_questions,
            "active":      active_questions,
            "unassigned":  unassigned_questions,
            "per_exam":    questions_per_exam,
            "per_section": questions_per_section,
        },
        "users":        {"students": total_users},
        "orgs":         {"total": total_orgs},
        "entitlements": {"active": active_entitlements},
    }), 200