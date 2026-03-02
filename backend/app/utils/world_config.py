"""
Single source of truth for world structure, level structure, exam ordering,
and track progression.

All other modules must import from here — never hardcode world_keys elsewhere.

TRACKS:
  Qudurat has two independent tracks (Math, Verbal).
  Tahsili has four independent tracks (Math, Biology, Chemistry, Physics).
  Within a track, worlds progress linearly (must complete W1 before W2).
  Tracks are independent (can do any track simultaneously).

QUESTION DISTRIBUTION (per section / per track):
  World 1 → 100 questions (10 levels × 10 new questions each)
  World 2 → 150 questions (10 levels × 15 new questions each)
  World 3 → 200 questions (10 levels × 20 new questions each)
  World 4 → 250 questions (10 levels × 25 new questions each)
  World 5 → 300 questions (10 levels × 30 new questions each)
  Total per section = 1,000 questions

TOTALS:
  Qudurat:  2 sections × 1,000 = 2,000 questions
  Tahsili:  4 sections × 1,000 = 4,000 questions
  Grand total = 6,000 questions

PLAN LIMITS:
  max_world_index in entitlements applies PER-TRACK.
  trial=1 means first world in EACH track only.
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
        ("math", {
            "name": "Math",
            "worlds": ["math_100", "math_150", "math_200", "math_250", "math_300"],
        }),
        ("biology", {
            "name": "Biology",
            "worlds": ["biology_100", "biology_150", "biology_200", "biology_250", "biology_300"],
        }),
        ("chemistry", {
            "name": "Chemistry",
            "worlds": ["chemistry_100", "chemistry_150", "chemistry_200", "chemistry_250", "chemistry_300"],
        }),
        ("physics", {
            "name": "Physics",
            "worlds": ["physics_100", "physics_150", "physics_200", "physics_250", "physics_300"],
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
    "math_100": 100,       "math_150": 150,       "math_200": 200,
    "math_250": 250,       "math_300": 300,
    "verbal_100": 100,     "verbal_150": 150,     "verbal_200": 200,
    "verbal_250": 250,     "verbal_300": 300,
    "biology_100": 100,    "biology_150": 150,    "biology_200": 200,
    "biology_250": 250,    "biology_300": 300,
    "chemistry_100": 100,  "chemistry_150": 150,  "chemistry_200": 200,
    "chemistry_250": 250,  "chemistry_300": 300,
    "physics_100": 100,    "physics_150": 150,    "physics_200": 200,
    "physics_250": 250,    "physics_300": 300,
}

LEVELS_PER_WORLD = 10

# ── Trial limit (per-track, 1-based) ─────────────────────────────────────────
# During 7-day trial, users get access to world 1 in EACH track only.
TRIAL_WORLD_LIMIT = 1

# ── Plan → max world index (1-based, inclusive, PER-TRACK) ────────────────────
PLAN_WORLD_LIMIT: dict[str, int] = {
    "basic":   5,    # first 5 worlds in each track (all current worlds)
    "premium": 10,   # all worlds (future-proof for expansion)
}


# ── Lock reason enum ──────────────────────────────────────────────────────────
class LockReason:
    NO_ENTITLEMENT         = "no_entitlement"
    TRIAL_EXPIRED          = "trial_expired"
    BEYOND_TRIAL_CAP       = "beyond_trial_cap"
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