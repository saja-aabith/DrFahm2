"""
Single source of truth for world structure, level structure, and exam ordering.
All other modules must import from here — never hardcode world_keys elsewhere.
"""

# ── Valid world keys ───────────────────────────────────────────────────────────
VALID_WORLD_KEYS = {
    "math_100", "math_150", "math_200", "math_250", "math_300",
    "verbal_100", "verbal_150", "verbal_200", "verbal_250", "verbal_300",
    "biology_100", "biology_150",
    "chemistry_100", "chemistry_150",
    "physics_100", "physics_150",
}

# ── Fixed exam → world order ───────────────────────────────────────────────────
EXAM_WORLD_ORDER = {
    "qudurat": [
        "math_100", "math_150", "math_200", "math_250", "math_300",
        "verbal_100", "verbal_150", "verbal_200", "verbal_250", "verbal_300",
    ],
    "tahsili": [
        "math_100", "math_150", "math_200", "math_250",
        "biology_100", "biology_150",
        "chemistry_100", "chemistry_150",
        "physics_100", "physics_150",
    ],
}

VALID_EXAMS = set(EXAM_WORLD_ORDER.keys())  # {"qudurat", "tahsili"}

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

# ── Plan → max world index (1-based, inclusive) ───────────────────────────────
PLAN_WORLD_LIMIT: dict[str, int] = {
    "free":    2,
    "basic":   5,
    "premium": 10,
}

# ── Lock reason enum — stable API values (never rename without frontend update) ─
class LockReason:
    NO_ENTITLEMENT         = "no_entitlement"
    TRIAL_EXPIRED          = "trial_expired"
    BEYOND_WORLD2_TRIAL    = "beyond_world2_trial_cap"
    PREREQ_INCOMPLETE      = "prereq_incomplete"
    LEVEL_LOCKED           = "level_locked"
    SEAT_NO_COVERAGE       = "seat_no_coverage"


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_world_index(exam: str, world_key: str) -> int:
    """
    Returns 1-based world index for the given exam.
    Raises ValueError if exam or world_key is invalid for that exam.
    """
    if exam not in EXAM_WORLD_ORDER:
        raise ValueError(f"Invalid exam: {exam!r}")
    order = EXAM_WORLD_ORDER[exam]
    try:
        return order.index(world_key) + 1  # 1-based
    except ValueError:
        raise ValueError(f"world_key {world_key!r} not in exam {exam!r}")


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

    Level N covers indices 1 .. N * questions_per_level.
    Level 1 → 1 .. qpl
    Level 2 → 1 .. 2*qpl
    Level N → 1 .. N*qpl
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
    """Raises ValueError if world_key is not in VALID_WORLD_KEYS."""
    if world_key not in VALID_WORLD_KEYS:
        raise ValueError(f"Invalid world_key: {world_key!r}")


def validate_exam(exam: str):
    """Raises ValueError if exam is not a valid exam identifier."""
    if exam not in VALID_EXAMS:
        raise ValueError(f"Invalid exam: {exam!r}. Must be one of {sorted(VALID_EXAMS)}")