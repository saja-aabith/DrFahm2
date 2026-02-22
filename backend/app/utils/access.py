"""
Single source of truth for access resolution.

resolve_world_access(user, exam, world_index, db_session)
  → {"allowed": bool, "lock_reason": str | None}

get_or_create_trial(user, exam, trial_days)
  → ExamTrial (created or existing)

All lock_reason values are the stable enum from world_config.LockReason.
Frontend must render exactly what this returns — no lock logic on client.
"""

from datetime import datetime, timedelta, timezone

from ..models.entitlement import Entitlement, ExamTrial
from ..models.progress import LevelProgress, WorldProgress
from ..utils.world_config import LockReason, LEVELS_PER_WORLD
from ..extensions import db


# ── Trial ─────────────────────────────────────────────────────────────────────

def get_or_create_trial(user, exam: str, trial_days: int) -> ExamTrial:
    """
    Fetch existing trial for (user, exam).
    If none exists, create one starting NOW.
    A trial, once created, is never reset — UNIQUE(user_id, exam) enforces this.
    """
    trial = ExamTrial.query.filter_by(user_id=user.id, exam=exam).first()
    if trial:
        return trial

    now = datetime.now(timezone.utc)
    trial = ExamTrial(
        user_id=user.id,
        exam=exam,
        trial_started_at=now,
        trial_expires_at=now + timedelta(days=trial_days),
    )
    db.session.add(trial)
    db.session.flush()   # get id without full commit; caller commits
    return trial


# ── Entitlement resolution ────────────────────────────────────────────────────

def _get_active_org_entitlement(user, exam: str, world_index: int):
    """
    Returns an active org-level Entitlement covering this exam+world_index,
    or None if the user has no org / no active org entitlement.
    """
    if not user.org_id:
        return None

    now = datetime.now(timezone.utc)
    return (
        Entitlement.query
        .filter(
            Entitlement.org_id == user.org_id,
            Entitlement.exam == exam,
            Entitlement.max_world_index >= world_index,
            Entitlement.entitlement_expires_at > now,
        )
        .first()
    )


def _get_active_individual_entitlement(user, exam: str, world_index: int):
    """
    Returns an active individual Entitlement for this user covering
    exam+world_index, or None.
    """
    now = datetime.now(timezone.utc)
    return (
        Entitlement.query
        .filter(
            Entitlement.user_id == user.id,
            Entitlement.exam == exam,
            Entitlement.max_world_index >= world_index,
            Entitlement.entitlement_expires_at > now,
        )
        .first()
    )


def _get_trial(user, exam: str):
    return ExamTrial.query.filter_by(user_id=user.id, exam=exam).first()


# ── Progression checks ────────────────────────────────────────────────────────

def _prev_world_completed(user_id: int, exam: str, world_index: int) -> bool:
    """
    Returns True if the previous world (world_index - 1) is fully completed,
    or if world_index == 1 (no prerequisite).
    """
    if world_index == 1:
        return True

    from ..utils.world_config import EXAM_WORLD_ORDER
    order = EXAM_WORLD_ORDER[exam]
    prev_world_key = order[world_index - 2]   # world_index is 1-based

    wp = WorldProgress.query.filter_by(
        user_id=user_id,
        exam=exam,
        world_key=prev_world_key,
    ).first()
    return bool(wp and wp.fully_completed)


def _prev_level_passed(user_id: int, exam: str, world_key: str,
                       level_number: int) -> bool:
    """
    Returns True if level_number - 1 is passed (or level_number == 1).
    """
    if level_number == 1:
        return True

    lp = LevelProgress.query.filter_by(
        user_id=user_id,
        exam=exam,
        world_key=world_key,
        level_number=level_number - 1,
    ).first()
    return bool(lp and lp.passed)


# ── Master resolution ─────────────────────────────────────────────────────────

def resolve_world_access(user, exam: str, world_index: int) -> dict:
    """
    Determine whether user can access a world.

    Returns:
        {
            "allowed": bool,
            "lock_reason": LockReason value | None
        }

    Precedence (strict):
    1. Active org entitlement covering this world  → ALLOW (then progression)
    2. Active individual entitlement covering this world → ALLOW (then progression)
    3. Active trial + world_index <= 2             → ALLOW (then progression)
    4. Active trial + world_index > 2              → LOCKED beyond_world2_trial_cap
    5. Trial exists but expired                    → LOCKED trial_expired
    6. No org seat coverage (org user, no matching org entitlement) → seat_no_coverage
    7. No entitlement at all                       → LOCKED no_entitlement

    After any ALLOW, progression is checked:
    - Previous world not completed → prereq_incomplete
    """
    # 1. Org entitlement
    org_ent = _get_active_org_entitlement(user, exam, world_index)
    if org_ent:
        if not _prev_world_completed(user.id, exam, world_index):
            return {"allowed": False, "lock_reason": LockReason.PREREQ_INCOMPLETE}
        return {"allowed": True, "lock_reason": None}

    # 2. Individual paid entitlement
    ind_ent = _get_active_individual_entitlement(user, exam, world_index)
    if ind_ent:
        if not _prev_world_completed(user.id, exam, world_index):
            return {"allowed": False, "lock_reason": LockReason.PREREQ_INCOMPLETE}
        return {"allowed": True, "lock_reason": None}

    # 3 / 4 / 5. Trial
    trial = _get_trial(user, exam)
    if trial:
        if trial.is_active():
            if world_index <= 2:
                if not _prev_world_completed(user.id, exam, world_index):
                    return {"allowed": False, "lock_reason": LockReason.PREREQ_INCOMPLETE}
                return {"allowed": True, "lock_reason": None}
            else:
                return {"allowed": False, "lock_reason": LockReason.BEYOND_WORLD2_TRIAL}
        else:
            # Trial expired — even worlds 1-2 are locked
            return {"allowed": False, "lock_reason": LockReason.TRIAL_EXPIRED}

    # 6. Org user with no matching org entitlement
    if user.org_id:
        return {"allowed": False, "lock_reason": LockReason.SEAT_NO_COVERAGE}

    # 7. No entitlement whatsoever
    return {"allowed": False, "lock_reason": LockReason.NO_ENTITLEMENT}


def resolve_level_access(user, exam: str, world_key: str,
                         level_number: int, world_index: int) -> dict:
    """
    Determine whether a user can access a specific level.
    First checks world access, then level progression within the world.

    Returns:
        {
            "allowed": bool,
            "lock_reason": LockReason value | None
        }
    """
    world_result = resolve_world_access(user, exam, world_index)
    if not world_result["allowed"]:
        return world_result

    if not _prev_level_passed(user.id, exam, world_key, level_number):
        return {"allowed": False, "lock_reason": LockReason.LEVEL_LOCKED}

    return {"allowed": True, "lock_reason": None}


def build_level_states(user_id: int, exam: str, world_key: str) -> list[dict]:
    """
    Returns a list of 10 level state dicts for use in the World Map response.
    Reads all LevelProgress rows for this (user, exam, world_key) in one query.
    """
    rows = (
        LevelProgress.query
        .filter_by(user_id=user_id, exam=exam, world_key=world_key)
        .all()
    )
    progress_map = {r.level_number: r for r in rows}

    levels = []
    for n in range(1, LEVELS_PER_WORLD + 1):
        lp = progress_map.get(n)
        levels.append({
            "level_number": n,
            "passed":       bool(lp and lp.passed),
        })
    return levels