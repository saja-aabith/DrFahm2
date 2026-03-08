"""
Exam APIs — world map, questions, submission, progress.

Key invariants enforced here:
- Trial started on first world-map or questions request (get_or_create_trial).
- Frontend renders exactly what backend returns — no lock logic on client.
- Questions returned in index ASC order, no shuffling.
- Correct answers NEVER returned in questions endpoint.
- Pass threshold from config (PASS_THRESHOLD_PCT, default 70%).
- WorldProgress updated automatically when all 10 levels pass.

TRACK-AWARE:
  world_map returns tracks grouped structure.
  Progression is within-track only.
"""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, current_app

from ..extensions import db
from ..models.question import Question
from ..models.progress import LevelProgress, WorldProgress
from ..api.auth import require_auth, _get_current_user
from ..api.errors import bad_request, forbidden, error_response
from ..utils.world_config import (
    EXAM_WORLD_ORDER,
    EXAM_TRACKS,
    LEVELS_PER_WORLD,
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
    """Validates world_key exists and belongs to exam. Returns error or None."""
    if world_key not in VALID_WORLD_KEYS:
        return bad_request(
            "invalid_world_key",
            f"Invalid world_key: {world_key!r}."
        )
    if world_key not in EXAM_WORLD_ORDER.get(exam, []):
        return bad_request(
            "world_not_in_exam",
            f"world_key {world_key!r} does not belong to exam {exam!r}."
        )
    return None


def _validate_level_number(level_number_str: str):
    """Parses and validates level_number. Returns (int, error | None)."""
    try:
        level_number = int(level_number_str)
    except (ValueError, TypeError):
        return None, bad_request("invalid_level_number",
                                 "level_number must be an integer.")
    if not (1 <= level_number <= LEVELS_PER_WORLD):
        return None, bad_request(
            "invalid_level_number",
            f"level_number must be between 1 and {LEVELS_PER_WORLD}."
        )
    return level_number, None


def _preload_world_progress(user_id: int, exam: str) -> dict[str, WorldProgress]:
    """Returns {world_key: WorldProgress} for all worlds the user has touched."""
    rows = WorldProgress.query.filter_by(user_id=user_id, exam=exam).all()
    return {r.world_key: r for r in rows}


def _preload_level_progress(user_id: int, exam: str) -> dict[tuple, LevelProgress]:
    """Returns {(world_key, level_number): LevelProgress}."""
    rows = LevelProgress.query.filter_by(user_id=user_id, exam=exam).all()
    return {(r.world_key, r.level_number): r for r in rows}


# ── GET /api/exams/<exam>/world-map ───────────────────────────────────────────

@exams_bp.route("/<exam>/world-map", methods=["GET"])
@require_auth
def world_map(exam: str):
    """
    Returns the full world map for an exam, grouped by tracks.

    - Starts the per-exam trial on first call (if no trial + no entitlement).
    - Frontend must render exactly what this returns.
    - All lock logic lives here — never on the client.
    - Tracks are independent: math and verbal progress separately.

    Response shape:
    {
        "exam": "qudurat",
        "tracks": [
            {
                "track_key": "math",
                "track_name": "Math",
                "worlds": [
                    {
                        "world_key":  "math_100",
                        "world_name": "Math 100",
                        "index":      1,
                        "locked":     false,
                        "lock_reason": null,
                        "levels": [
                            {"level_number": 1, "locked": false, "lock_reason": null, "passed": false}
                        ]
                    }
                ]
            },
            {
                "track_key": "verbal",
                "track_name": "Verbal",
                "worlds": [...]
            }
        ]
    }
    """
    _, err = _validate_exam_param(exam)
    if err:
        return err

    user       = _get_current_user()
    trial_days = current_app.config["TRIAL_DAYS"]

    # ── Start trial on first world-map request ──
    get_or_create_trial(user, exam, trial_days)
    db.session.commit()

    # ── Preload progress in two queries (avoid N+1) ──
    world_progress_map = _preload_world_progress(user.id, exam)
    level_progress_map = _preload_level_progress(user.id, exam)

    # ── Build track-grouped output ──
    tracks_info = get_track_info(exam)
    tracks_output = []

    for track in tracks_info:
        worlds_in_track = []

        for world_key in track["worlds"]:
            track_world_index = get_track_world_index(exam, world_key)

            # ── Access check (track-aware) ──
            world_result    = resolve_world_access(user, exam, world_key)
            world_locked    = not world_result["allowed"]
            world_lock_reason = world_result["lock_reason"]

            # ── Build level states ──
            levels = []
            for level_number in range(1, LEVELS_PER_WORLD + 1):
                lp = level_progress_map.get((world_key, level_number))
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
                "world_key":    world_key,
                "world_name":   world_name(world_key),
                "world_name_ar": world_name_ar(world_key),
                "index":        track_world_index,
                "locked":      world_locked,
                "lock_reason": world_lock_reason,
                "levels":      levels,
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
    """
    Returns questions for a specific level.

    - Validates entitlement + progression before returning questions.
    - Starts trial on first call (same as world-map).
    - Returns questions sorted by index ASC (deterministic, no shuffle).
    - correct_answer is NEVER included in this response.
    - Cumulative: Level N returns questions 1..N*questions_per_level.
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

    user       = _get_current_user()
    trial_days = current_app.config["TRIAL_DAYS"]

    # ── Start trial on first questions request ──
    get_or_create_trial(user, exam, trial_days)
    db.session.commit()

    # ── Access check (track-aware — no world_index param needed) ──
    access = resolve_level_access(user, exam, world_key, level_number)

    if not access["allowed"]:
        return forbidden(
            access["lock_reason"],
            f"Access denied: {access['lock_reason']}",
            {"lock_reason": access["lock_reason"]}
        )

    # ── Fetch questions (cumulative range, index ASC) ──
    start_index, end_index = get_level_question_range(world_key, level_number)

    questions = (
        Question.query
        .filter(
            Question.exam      == exam,
            Question.world_key == world_key,
            Question.index     >= start_index,
            Question.index     <= end_index,
            Question.is_active == True,
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
        # hint included — frontend shows it after a wrong answer.
        # correct_answer NOT included — never sent before submission.
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
        "answers": {
            "<question_id>": "a" | "b" | "c" | "d",
            ...
        }
    }
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

    user = _get_current_user()

    # ── Access check (track-aware) ──
    access = resolve_level_access(user, exam, world_key, level_number)

    if not access["allowed"]:
        return forbidden(
            access["lock_reason"],
            f"Access denied: {access['lock_reason']}",
            {"lock_reason": access["lock_reason"]}
        )

    # ── Parse answers ──
    data    = request.get_json(silent=True) or {}
    answers = data.get("answers")

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

    # ── Fetch questions for this level ──
    start_index, end_index = get_level_question_range(world_key, level_number)

    questions = (
        Question.query
        .filter(
            Question.exam      == exam,
            Question.world_key == world_key,
            Question.index     >= start_index,
            Question.index     <= end_index,
            Question.is_active == True,
            Question.deleted_at == None,
        )
        .order_by(Question.index.asc())
        .all()
    )

    if not questions:
        return error_response(
            "no_questions",
            "No questions found for this level. "
            "Ensure the question bank has been imported.",
            422,
        )

    # ── Grade ──
    pass_threshold_pct = current_app.config["PASS_THRESHOLD_PCT"]
    correct_count = 0
    results       = []

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
        # Include hint only for wrong answers — correct answers don't need it.
        # Frontend displays the hint in the hint panel after the student picks wrong.
        if not is_correct and q.hint:
            result_entry["hint"] = q.hint

        results.append(result_entry)

    total_questions = len(questions)
    score_pct       = (correct_count / total_questions * 100) if total_questions else 0
    passed          = score_pct >= pass_threshold_pct

    # ── Upsert LevelProgress ──
    now = datetime.now(timezone.utc)
    lp  = LevelProgress.query.filter_by(
        user_id=user.id,
        exam=exam,
        world_key=world_key,
        level_number=level_number,
    ).first()

    if lp:
        lp.attempts        += 1
        lp.score            = correct_count
        lp.total_questions  = total_questions
        lp.last_attempted_at = now
        if passed:
            lp.passed = True
    else:
        lp = LevelProgress(
            user_id=user.id,
            exam=exam,
            world_key=world_key,
            level_number=level_number,
            passed=passed,
            score=correct_count,
            total_questions=total_questions,
            attempts=1,
            last_attempted_at=now,
        )
        db.session.add(lp)

    db.session.flush()

    # ── Check if all 10 levels in this world are now passed ──
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
                user_id=user.id,
                exam=exam,
                world_key=world_key,
            ).first()
            if wp:
                if not wp.fully_completed:
                    wp.fully_completed = True
                    wp.completed_at    = now
                    world_completed    = True
            else:
                wp = WorldProgress(
                    user_id=user.id,
                    exam=exam,
                    world_key=world_key,
                    fully_completed=True,
                    completed_at=now,
                )
                db.session.add(wp)
                world_completed = True

    db.session.commit()

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
        # Per-question breakdown. For wrong answers, `hint` is included when present.
        # Frontend uses this to drive the review screen / hint panel.
        "results":            results,
    }), 200


# ── GET /api/exams/<exam>/progress ────────────────────────────────────────────

@exams_bp.route("/<exam>/progress", methods=["GET"])
@require_auth
def get_progress(exam: str):
    """
    Returns a summary of the user's progress across all worlds for an exam.
    Still returns a flat list (used by Dashboard) — tracks grouping is done
    in the world-map endpoint.
    """
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
            1
            for level_number in range(1, LEVELS_PER_WORLD + 1)
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