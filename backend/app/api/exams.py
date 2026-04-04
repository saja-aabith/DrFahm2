"""
Exam APIs — world map, questions, submission, progress, leaderboard.

Key invariants enforced here:
- Trial started on first world-map or questions request (get_or_create_trial).
- Frontend renders exactly what backend returns — no lock logic on client.
- Questions returned in index ASC order, no shuffling.
- Correct answers NEVER returned in questions endpoint.
- Pass threshold from config (PASS_THRESHOLD_PCT, default 100%).
- WorldProgress updated automatically when all 10 levels pass.

TRACK-AWARE:
  world_map returns tracks grouped structure.
  Progression is within-track only.

M1 ADDITIONS:
  - duration_seconds stored on LevelProgress (first passing attempt only).
  - GET /<exam>/leaderboard — top 20 + current user rank.
    Primary sort:  levels_passed DESC.
    Tiebreaker:    avg duration_seconds ASC, nulls last (fastest wins).

M2 ADDITIONS:
  - GET /<exam>/predicted-score — weighted-depth prediction.
  - predicted_score injected into submit_level response (no extra round-trip).
  - Algorithm isolated in _compute_predicted_score(); constants in
    _PREDICTION_CONFIG — change calibration without touching logic.
"""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import func, desc, asc

from ..extensions import db
from ..models.question import Question
from ..models.progress import LevelProgress, WorldProgress
from ..models.user import User, UserRole
from ..api.auth import require_auth, _get_current_user
from ..api.errors import bad_request, forbidden, error_response
from ..utils.world_config import (
    EXAM_WORLD_ORDER,
    EXAM_TRACKS,
    LEVELS_PER_WORLD,
    WORLD_BAND,
    LockReason,
    get_world_index,
    get_track_world_index,
    get_level_question_range,
    get_questions_per_level,
    validate_exam,
    validate_world_key,
    world_name,
    world_name_ar,
    VALID_WORLD_KEYS,
    get_track_info,
)
from ..utils.access import (
    get_or_create_trial,
    resolve_world_access,
    resolve_level_access,
    build_level_states,
)

exams_bp = Blueprint("exams", __name__, url_prefix="/api/exams")

# Maximum rows returned in the public leaderboard.
_LEADERBOARD_TOP_N = 20

# ── M2: Predicted score configuration ─────────────────────────────────────────
# Change values here to re-calibrate the prediction without touching logic.
_PREDICTION_CONFIG = {
    # Score a student would receive with zero preparation (floor).
    "base_score": 30,
    # base_score + scale_range = 100 (ceiling at full completion).
    "scale_range": 70,
    # Theoretical max weight achievable in a single section.
    # 10 levels × (1.0 + 1.5 + 2.0 + 2.5 + 3.0) = 100.0
    "max_weight_per_section": 100.0,
    # Minimum levels passed to reach each confidence tier.
    "confidence_thresholds": {"medium": 10, "high": 30},
}


def _compute_predicted_score(passed_records: list) -> dict:
    """
    Predict exam score from a list of passed LevelProgress records.

    Formula (weighted-depth):
      weight per level  = world_band / 100   (World1=1.0 … World5=3.0)
      section ratio     = sum(weights) / max_weight_per_section   (0–1)
      section score     = base_score + ratio × scale_range
      overall score     = average of section scores

    Returns:
        {
            "score":           int | None,
            "sections":        { section_key: int },
            "based_on_levels": int,
            "confidence":      "none" | "low" | "medium" | "high",
        }

    To swap the algorithm: replace only this function and keep the
    _PREDICTION_CONFIG dict in sync with any new constants needed.
    """
    cfg = _PREDICTION_CONFIG

    if not passed_records:
        return {
            "score": None,
            "sections": {},
            "based_on_levels": 0,
            "confidence": "none",
        }

    by_section: dict[str, float] = {}
    for lp in passed_records:
        band    = WORLD_BAND.get(lp.world_key, 100)
        weight  = band / 100.0
        section = lp.world_key.split("_")[0]
        by_section[section] = by_section.get(section, 0.0) + weight

    sections_out: dict[str, int] = {}
    completion_ratios: list[float] = []
    for section, total_weight in by_section.items():
        ratio  = min(total_weight / cfg["max_weight_per_section"], 1.0)
        completion_ratios.append(ratio)
        sections_out[section] = round(cfg["base_score"] + ratio * cfg["scale_range"])

    overall_ratio = sum(completion_ratios) / len(completion_ratios)
    predicted     = round(cfg["base_score"] + overall_ratio * cfg["scale_range"])

    n = len(passed_records)
    if   n >= cfg["confidence_thresholds"]["high"]:   confidence = "high"
    elif n >= cfg["confidence_thresholds"]["medium"]: confidence = "medium"
    else:                                              confidence = "low"

    return {
        "score":           predicted,
        "sections":        sections_out,
        "based_on_levels": n,
        "confidence":      confidence,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_exam_param(exam: str):
    """Returns (exam, error_response | None)."""
    try:
        validate_exam(exam)
        return exam, None
    except ValueError:
        return None, bad_request(
            "invalid_exam",
            f"Invalid exam: {exam!r}. Must be 'qudurat' or 'tahsili'."
        )


def _validate_world_key_param(world_key: str, exam: str):
    if world_key not in VALID_WORLD_KEYS:
        return bad_request("invalid_world_key", f"Invalid world_key: {world_key!r}.")
    if world_key not in EXAM_WORLD_ORDER.get(exam, []):
        return bad_request(
            "world_not_in_exam",
            f"world_key {world_key!r} does not belong to exam {exam!r}."
        )
    return None


def _validate_level_number(level_number_str: str):
    try:
        level_number = int(level_number_str)
    except (ValueError, TypeError):
        return None, bad_request("invalid_level_number", "level_number must be an integer.")
    if not (1 <= level_number <= LEVELS_PER_WORLD):
        return None, bad_request(
            "invalid_level_number",
            f"level_number must be between 1 and {LEVELS_PER_WORLD}."
        )
    return level_number, None


def _preload_world_progress(user_id: int, exam: str) -> dict:
    rows = WorldProgress.query.filter_by(user_id=user_id, exam=exam).all()
    return {r.world_key: r for r in rows}


def _preload_level_progress(user_id: int, exam: str) -> dict:
    rows = LevelProgress.query.filter_by(user_id=user_id, exam=exam).all()
    return {(r.world_key, r.level_number): r for r in rows}


def _parse_duration_seconds(raw) -> int | None:
    if raw is None:
        return None
    try:
        val = int(raw)
        return val if val >= 0 else None
    except (ValueError, TypeError):
        return None


# ── GET /api/exams/<exam>/world-map ───────────────────────────────────────────

@exams_bp.route("/<exam>/world-map", methods=["GET"])
@require_auth
def world_map(exam: str):
    _, err = _validate_exam_param(exam)
    if err:
        return err

    user       = _get_current_user()
    trial_days = current_app.config["TRIAL_DAYS"]

    get_or_create_trial(user, exam, trial_days)
    db.session.commit()

    world_progress_map = _preload_world_progress(user.id, exam)
    level_progress_map = _preload_level_progress(user.id, exam)

    tracks_info   = get_track_info(exam)
    tracks_output = []

    for track in tracks_info:
        worlds_in_track = []

        for world_key in track["worlds"]:
            track_world_index = get_track_world_index(exam, world_key)
            world_result      = resolve_world_access(user, exam, world_key)
            world_locked      = not world_result["allowed"]
            world_lock_reason = world_result["lock_reason"]

            levels = []
            for level_number in range(1, LEVELS_PER_WORLD + 1):
                lp     = level_progress_map.get((world_key, level_number))
                passed = bool(lp and lp.passed)

                if world_locked:
                    level_locked      = True
                    level_lock_reason = world_lock_reason
                elif level_number == 1:
                    level_locked      = False
                    level_lock_reason = None
                else:
                    prev_lp     = level_progress_map.get((world_key, level_number - 1))
                    prev_passed = bool(prev_lp and prev_lp.passed)
                    if not prev_passed:
                        level_locked      = True
                        level_lock_reason = LockReason.LEVEL_LOCKED
                    else:
                        level_locked      = False
                        level_lock_reason = None

                levels.append({
                    "level_number": level_number,
                    "locked":       level_locked,
                    "lock_reason":  level_lock_reason,
                    "passed":       passed,
                })

            worlds_in_track.append({
                "world_key":     world_key,
                "world_name":    world_name(world_key),
                "world_name_ar": world_name_ar(world_key),
                "index":         track_world_index,
                "locked":        world_locked,
                "lock_reason":   world_lock_reason,
                "levels":        levels,
            })

        tracks_output.append({
            "track_key":  track["track_key"],
            "track_name": track["track_name"],
            "worlds":     worlds_in_track,
        })

    return jsonify({"exam": exam, "tracks": tracks_output}), 200


# ── GET /api/exams/<exam>/worlds/<world_key>/levels/<level_number>/questions ──

@exams_bp.route(
    "/<exam>/worlds/<world_key>/levels/<level_number>/questions",
    methods=["GET"]
)
@require_auth
def get_questions(exam: str, world_key: str, level_number: str):
    _, err = _validate_exam_param(exam)
    if err:
        return err

    err = _validate_world_key_param(world_key, exam)
    if err:
        return err

    level_number, err = _validate_level_number(level_number)
    if err:
        return err

    user       = _get_current_user()
    trial_days = current_app.config["TRIAL_DAYS"]

    get_or_create_trial(user, exam, trial_days)
    db.session.commit()

    access = resolve_level_access(user, exam, world_key, level_number)
    if not access["allowed"]:
        return forbidden(
            access["lock_reason"],
            f"Access denied: {access['lock_reason']}",
            {"lock_reason": access["lock_reason"]}
        )

    start_index, end_index = get_level_question_range(world_key, level_number)

    questions = (
        Question.query
        .filter(
            Question.exam       == exam,
            Question.world_key  == world_key,
            Question.index      >= start_index,
            Question.index      <= end_index,
            Question.is_active  == True,
            Question.deleted_at == None,
        )
        .order_by(Question.index.asc())
        .all()
    )

    expected_count = end_index - start_index + 1
    if len(questions) < expected_count:
        current_app.logger.warning(
            f"Question bank incomplete: exam={exam} world={world_key} "
            f"level={level_number} expected={expected_count} got={len(questions)}"
        )

    return jsonify({
        "exam":         exam,
        "world_key":    world_key,
        "level_number": level_number,
        "total":        len(questions),
        "questions":    [q.to_dict(include_answer=True, include_hint=True) for q in questions],
    }), 200


# ── POST /api/exams/<exam>/worlds/<world_key>/levels/<level_number>/submit ────

@exams_bp.route(
    "/<exam>/worlds/<world_key>/levels/<level_number>/submit",
    methods=["POST"]
)
@require_auth
def submit_level(exam: str, world_key: str, level_number: str):
    """
    Submits answers for a level attempt.

    Body:
    {
        "answers":          { "<question_id>": "a"|"b"|"c"|"d", ... },
        "duration_seconds": 42   // optional — M1 leaderboard tiebreaker
    }

    Response includes:
    - Standard grading fields
    - M2: predicted_score object (see _compute_predicted_score)
    """
    _, err = _validate_exam_param(exam)
    if err:
        return err

    err = _validate_world_key_param(world_key, exam)
    if err:
        return err

    level_number, err = _validate_level_number(level_number)
    if err:
        return err

    user   = _get_current_user()
    access = resolve_level_access(user, exam, world_key, level_number)
    if not access["allowed"]:
        return forbidden(
            access["lock_reason"],
            f"Access denied: {access['lock_reason']}",
            {"lock_reason": access["lock_reason"]}
        )

    data             = request.get_json(silent=True) or {}
    answers          = data.get("answers")
    duration_seconds = _parse_duration_seconds(data.get("duration_seconds"))

    if not isinstance(answers, dict):
        return bad_request(
            "validation_error",
            "answers must be an object mapping question_id (string) to answer (a/b/c/d)."
        )

    valid_choices = {"a", "b", "c", "d"}
    for qid, ans in answers.items():
        if ans not in valid_choices:
            return bad_request(
                "validation_error",
                f"Answer for question {qid!r} must be one of a/b/c/d, got {ans!r}."
            )

    start_index, end_index = get_level_question_range(world_key, level_number)
    questions = (
        Question.query
        .filter(
            Question.exam       == exam,
            Question.world_key  == world_key,
            Question.index      >= start_index,
            Question.index      <= end_index,
            Question.is_active  == True,
            Question.deleted_at == None,
        )
        .order_by(Question.index.asc())
        .all()
    )

    if not questions:
        return error_response(
            "no_questions",
            "No questions found for this level. Ensure the question bank has been imported.",
            422,
        )

    pass_threshold_pct = current_app.config["PASS_THRESHOLD_PCT"]
    correct_count      = 0
    results            = []

    for q in questions:
        submitted  = answers.get(str(q.id))
        is_correct = submitted == q.correct_answer
        if is_correct:
            correct_count += 1

        result_entry = {
            "question_id":    q.id,
            "qid":            str(q.qid) if q.qid else None,
            "your_answer":    submitted,
            "correct_answer": q.correct_answer,
            "is_correct":     is_correct,
        }
        if not is_correct and q.hint:
            result_entry["hint"] = q.hint
        results.append(result_entry)

    total_questions = len(questions)
    score_pct       = (correct_count / total_questions * 100) if total_questions else 0
    passed          = score_pct >= pass_threshold_pct

    now = datetime.now(timezone.utc)
    lp  = LevelProgress.query.filter_by(
        user_id=user.id, exam=exam, world_key=world_key, level_number=level_number,
    ).first()

    if lp:
        lp.attempts         += 1
        lp.score             = correct_count
        lp.total_questions   = total_questions
        lp.last_attempted_at = now
        if passed:
            lp.passed = True
            if lp.duration_seconds is None:
                lp.duration_seconds = duration_seconds
    else:
        lp = LevelProgress(
            user_id=user.id, exam=exam, world_key=world_key,
            level_number=level_number, passed=passed,
            score=correct_count, total_questions=total_questions,
            attempts=1, last_attempted_at=now,
            duration_seconds=(duration_seconds if passed else None),
        )
        db.session.add(lp)

    db.session.flush()

    world_completed = False
    if passed:
        all_level_progress = (
            LevelProgress.query
            .filter_by(user_id=user.id, exam=exam, world_key=world_key)
            .all()
        )
        passed_levels = {lp2.level_number for lp2 in all_level_progress if lp2.passed}

        if len(passed_levels) == LEVELS_PER_WORLD:
            wp = WorldProgress.query.filter_by(
                user_id=user.id, exam=exam, world_key=world_key,
            ).first()
            if wp:
                if not wp.fully_completed:
                    wp.fully_completed = True
                    wp.completed_at    = now
                    world_completed    = True
            else:
                wp = WorldProgress(
                    user_id=user.id, exam=exam, world_key=world_key,
                    fully_completed=True, completed_at=now,
                )
                db.session.add(wp)
                world_completed = True

    db.session.commit()

    # ── M2: Predicted score (computed after commit so this attempt is included) ──
    all_passed = LevelProgress.query.filter_by(
        user_id=user.id, exam=exam, passed=True,
    ).all()
    predicted = _compute_predicted_score(all_passed)

    return jsonify({
        "exam":               exam,
        "world_key":          world_key,
        "level_number":       level_number,
        "score":              correct_count,
        "total":              total_questions,
        "score_pct":          round(score_pct, 1),
        "passed":             passed,
        "pass_threshold_pct": pass_threshold_pct,
        "world_completed":    world_completed,
        "results":            results,
        # M2: predicted score — used by Level.jsx results screen directly.
        # Shape: { score, sections, based_on_levels, confidence }
        "predicted_score":    predicted,
    }), 200


# ── GET /api/exams/<exam>/progress ────────────────────────────────────────────

@exams_bp.route("/<exam>/progress", methods=["GET"])
@require_auth
def get_progress(exam: str):
    _, err = _validate_exam_param(exam)
    if err:
        return err

    user = _get_current_user()
    world_progress_map = _preload_world_progress(user.id, exam)
    level_progress_map = _preload_level_progress(user.id, exam)

    worlds_output = []
    for world_key in EXAM_WORLD_ORDER[exam]:
        world_index = get_world_index(exam, world_key)
        wp          = world_progress_map.get(world_key)

        levels_passed = sum(
            1 for level_number in range(1, LEVELS_PER_WORLD + 1)
            if level_progress_map.get((world_key, level_number)) and
               level_progress_map[(world_key, level_number)].passed
        )

        worlds_output.append({
            "world_key":       world_key,
            "world_name":      world_name(world_key),
            "world_name_ar":   world_name_ar(world_key),
            "index":           world_index,
            "fully_completed": bool(wp and wp.fully_completed),
            "completed_at":    wp.completed_at.isoformat() if (wp and wp.completed_at) else None,
            "levels_passed":   levels_passed,
            "levels_total":    LEVELS_PER_WORLD,
        })

    return jsonify({"exam": exam, "worlds": worlds_output}), 200


# ── GET /api/exams/<exam>/leaderboard ─────────────────────────────────────────

@exams_bp.route("/<exam>/leaderboard", methods=["GET"])
@require_auth
def get_leaderboard(exam: str):
    _, err = _validate_exam_param(exam)
    if err:
        return err

    user = _get_current_user()

    levels_passed_expr = func.count(LevelProgress.id)
    avg_seconds_expr   = func.avg(LevelProgress.duration_seconds)

    all_ranked = (
        db.session.query(
            LevelProgress.user_id,
            User.username,
            levels_passed_expr.label("levels_passed"),
            avg_seconds_expr.label("avg_seconds"),
        )
        .join(User, User.id == LevelProgress.user_id)
        .filter(
            LevelProgress.exam   == exam,
            LevelProgress.passed == True,
            User.is_active       == True,
            User.role            == UserRole.STUDENT,
        )
        .group_by(LevelProgress.user_id, User.username)
        .order_by(
            desc(levels_passed_expr),
            asc(func.coalesce(avg_seconds_expr, 999999)),
        )
        .all()
    )

    ranked = [
        {
            "rank":          i + 1,
            "user_id":       row.user_id,
            "username":      row.username,
            "levels_passed": int(row.levels_passed),
            "avg_seconds":   float(row.avg_seconds) if row.avg_seconds is not None else None,
        }
        for i, row in enumerate(all_ranked)
    ]

    top_n         = ranked[:_LEADERBOARD_TOP_N]
    current_entry = next((r for r in ranked if r["user_id"] == user.id), None)

    def _serialise(entry: dict) -> dict:
        return {
            "rank":                  entry["rank"],
            "username":              entry["username"],
            "levels_passed":         entry["levels_passed"],
            "avg_seconds_per_level": (
                round(entry["avg_seconds"], 1) if entry["avg_seconds"] is not None else None
            ),
            "is_current_user": entry["user_id"] == user.id,
        }

    return jsonify({
        "exam":         exam,
        "top":          [_serialise(r) for r in top_n],
        "current_user": _serialise(current_entry) if current_entry else None,
    }), 200


# ── GET /api/exams/<exam>/predicted-score  (M2) ───────────────────────────────

@exams_bp.route("/<exam>/predicted-score", methods=["GET"])
@require_auth
def get_predicted_score(exam: str):
    """
    Returns the predicted exam score for the current user.

    Uses the same _compute_predicted_score() helper as submit_level,
    so the algorithm is guaranteed to be consistent between the two.

    Response:
    {
        "exam":            "qudurat",
        "score":           74,         // null if no levels passed yet
        "sections":        { "math": 82, "verbal": 65 },
        "based_on_levels": 25,
        "confidence":      "medium"    // "none"|"low"|"medium"|"high"
    }
    """
    _, err = _validate_exam_param(exam)
    if err:
        return err

    user = _get_current_user()
    passed_records = LevelProgress.query.filter_by(
        user_id=user.id, exam=exam, passed=True,
    ).all()
    result = _compute_predicted_score(passed_records)

    return jsonify({"exam": exam, **result}), 200