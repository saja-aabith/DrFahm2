"""
Single source of truth for world structure, level structure, exam ordering,
and track progression.

All other modules must import from here — never hardcode world_keys elsewhere.

TRACKS:
  Qudurat has two independent tracks (Math, Verbal).
  Tahsili has one track (Science — covers math, bio, chem, physics).
  Within a track, worlds progress linearly (must complete W1 before W2).
  Tracks are independent (can do Math and Verbal simultaneously).

PLAN LIMITS:
  max_world_index in entitlements applies PER-TRACK.
  free=2 means first 2 worlds in EACH track.
  basic=5 means first 5 worlds in each track.
  premium=10 means all worlds (any track length).
"""

from collections import OrderedDict


# ── Track structure ────────────────────────────────────────────────────────────
# OrderedDict preserves display order. Each track is an ordered list of world_keys.

EXAM_TRACKS: dict[str, OrderedDict] = {
    "qudurat": OrderedDict([
        ("math", {
            "name": "Math",
            "worlds": ["math_100", "math_150", "math_200", "math_250", "math_300"],
        }),
        ("verbal", {
            "name": "Verbal",
            "worlds": ["verbal_100", "verbal_150", "verbal_200", "verbal_250", "verbal_300"],
        }),
    ]),
    "tahsili": OrderedDict([
        ("science", {
            "name": "Science",
            "worlds": [
                "math_100", "math_150", "math_200", "math_250",
                "biology_100", "biology_150",
                "chemistry_100", "chemistry_150",
                "physics_100", "physics_150",
            ],
        }),
    ]),
}


# ── Derived constants (computed once at import time) ───────────────────────────

# Flat world order per exam (backward compat — used by admin, progress, etc.)
EXAM_WORLD_ORDER: dict[str, list[str]] = {}
for _exam, _tracks in EXAM_TRACKS.items():
    _flat = []
    for _track_data in _tracks.values():
        _flat.extend(_track_data["worlds"])
    EXAM_WORLD_ORDER[_exam] = _flat

# All valid exams and world keys
VALID_EXAMS = set(EXAM_WORLD_ORDER.keys())

VALID_WORLD_KEYS = set()
for _worlds in EXAM_WORLD_ORDER.values():
    VALID_WORLD_KEYS.update(_worlds)


# ── Band number per world key ─────────────────────────────────────────────────
WORLD_BAND: dict[str, int] = {
    "math_100": 100,    "math_150": 150,    "math_200": 200,
    "math_250": 250,    "math_300": 300,
    "verbal_100": 100,  "verbal_150": 150,  "verbal_200": 200,
    "verbal_250": 250,  "verbal_300": 300,
    "biology_100": 100, "biology_150": 150,
    "chemistry_100": 100, "chemistry_150": 150,
    "physics_100": 100, "physics_150": 150,
}

LEVELS_PER_WORLD = 10

# ── Plan → max world index (1-based, inclusive, PER-TRACK) ────────────────────
PLAN_WORLD_LIMIT: dict[str, int] = {
    "free":    2,    # first 2 worlds in each track
    "basic":   5,    # first 5 worlds in each track
    "premium": 10,   # all worlds (any track length)
}


# ── Lock reason enum ──────────────────────────────────────────────────────────
class LockReason:
    NO_ENTITLEMENT         = "no_entitlement"
    TRIAL_EXPIRED          = "trial_expired"
    BEYOND_WORLD2_TRIAL    = "beyond_world2_trial_cap"
    PREREQ_INCOMPLETE      = "prereq_incomplete"
    LEVEL_LOCKED           = "level_locked"
    SEAT_NO_COVERAGE       = "seat_no_coverage"


# ── Track-aware helpers ───────────────────────────────────────────────────────

def get_track_for_world(exam: str, world_key: str) -> str:
    """
    Returns the track key for a world_key within an exam.
    E.g. get_track_for_world("qudurat", "verbal_200") → "verbal"
    Raises ValueError if not found.
    """
    if exam not in EXAM_TRACKS:
        raise ValueError(f"Invalid exam: {exam!r}")
    for track_key, track_data in EXAM_TRACKS[exam].items():
        if world_key in track_data["worlds"]:
            return track_key
    raise ValueError(f"world_key {world_key!r} not in exam {exam!r}")


def get_track_world_index(exam: str, world_key: str) -> int:
    """
    Returns 1-based position of world_key WITHIN its track.
    E.g. get_track_world_index("qudurat", "verbal_150") → 2
         get_track_world_index("qudurat", "math_300") → 5
    """
    track_key = get_track_for_world(exam, world_key)
    worlds = EXAM_TRACKS[exam][track_key]["worlds"]
    return worlds.index(world_key) + 1


def get_prev_world_in_track(exam: str, world_key: str) -> str | None:
    """
    Returns the previous world_key within the same track, or None if first.
    E.g. get_prev_world_in_track("qudurat", "math_200") → "math_150"
         get_prev_world_in_track("qudurat", "math_100") → None
    """
    track_key = get_track_for_world(exam, world_key)
    worlds = EXAM_TRACKS[exam][track_key]["worlds"]
    idx = worlds.index(world_key)
    if idx == 0:
        return None
    return worlds[idx - 1]


def get_track_info(exam: str) -> list[dict]:
    """
    Returns track info for frontend rendering.
    [
        {"track_key": "math", "track_name": "Math", "worlds": ["math_100", ...]},
        {"track_key": "verbal", "track_name": "Verbal", "worlds": [...]},
    ]
    """
    if exam not in EXAM_TRACKS:
        raise ValueError(f"Invalid exam: {exam!r}")
    result = []
    for track_key, track_data in EXAM_TRACKS[exam].items():
        result.append({
            "track_key": track_key,
            "track_name": track_data["name"],
            "worlds": track_data["worlds"],
        })
    return result


# ── Backward-compatible helpers (still used by admin, imports, etc.) ───────────

def get_world_index(exam: str, world_key: str) -> int:
    """
    Returns 1-based TRACK-RELATIVE world index.
    This is the same as get_track_world_index.
    Used for entitlement/plan limit checks (which are per-track).
    """
    return get_track_world_index(exam, world_key)


def get_total_questions(world_key: str) -> int:
    """Total questions in a world = its band number."""
    if world_key not in WORLD_BAND:
        raise ValueError(f"Invalid world_key: {world_key!r}")
    return WORLD_BAND[world_key]


def get_questions_per_level(world_key: str) -> int:
    """Questions per level = band / 10. Always an integer per spec."""
    return get_total_questions(world_key) // LEVELS_PER_WORLD


def get_level_question_range(world_key: str, level_number: int) -> tuple[int, int]:
    """
    Returns (start_index, end_index) inclusive, 1-based, for the given level.
    """
    if not (1 <= level_number <= LEVELS_PER_WORLD):
        raise ValueError(f"level_number must be 1–{LEVELS_PER_WORLD}, got {level_number}")
    qpl = get_questions_per_level(world_key)
    return (1, level_number * qpl)


def world_name(world_key: str) -> str:
    """Human-readable world name, e.g. 'Math 100'."""
    parts = world_key.split("_")
    return f"{parts[0].capitalize()} {parts[1]}"


def validate_world_key(world_key: str):
    if world_key not in VALID_WORLD_KEYS:
        raise ValueError(f"Invalid world_key: {world_key!r}")


def validate_exam(exam: str):
    if exam not in VALID_EXAMS:
        raise ValueError(f"Invalid exam: {exam!r}. Must be one of {sorted(VALID_EXAMS)}")