"""
Stripe configuration and plan resolution.

All plan → price / duration / world limit mappings live here.
Backend NEVER trusts amounts or durations from the frontend.
"""

from datetime import datetime, timedelta, timezone
from flask import current_app

from ..models.entitlement import PlanId, PlanType
from ..utils.world_config import PLAN_WORLD_LIMIT, VALID_EXAMS

# ── Individual plan config ────────────────────────────────────────────────────

# All paid individual plans unlock all 5 worlds per track.
# Differentiation is duration only.
_INDIVIDUAL_PLAN_DURATION = {
    PlanId.BASIC:   90,   # 3 months
    PlanId.PREMIUM: 365,  # 12 months
}

_INDIVIDUAL_PLAN_TYPE = {
    PlanId.BASIC:   PlanType.INDIVIDUAL_BASIC_3M,
    PlanId.PREMIUM: PlanType.INDIVIDUAL_PREMIUM_1Y,
}


def get_individual_plan_config(plan_id: str, exam: str) -> dict:
    """
    Returns full config for an individual checkout session.

    Both Basic and Premium unlock all 5 worlds (max_world_index=5).
    Duration differs: Basic=90d, Premium=365d.

    Price IDs are exam-specific — 4 total in Stripe:
      basic_qudurat, basic_tahsili, premium_qudurat, premium_tahsili

    Raises ValueError for unknown plan_id, free plan, or invalid exam.
    """
    if plan_id == PlanId.FREE or plan_id == "free":
        raise ValueError(
            "Free plan does not use Stripe checkout. "
            "Trial is started via the exam world map request."
        )

    pid = PlanId(plan_id) if isinstance(plan_id, str) else plan_id

    if pid not in _INDIVIDUAL_PLAN_DURATION:
        raise ValueError(f"Unknown plan_id: {plan_id!r}. Must be 'basic' or 'premium'.")

    if exam not in VALID_EXAMS:
        raise ValueError(f"Invalid exam: {exam!r}. Must be one of {sorted(VALID_EXAMS)}.")

    # Resolve exam-specific Stripe Price ID from config
    price_id_key = f"STRIPE_PRICE_{pid.value.upper()}_{exam.upper()}"
    stripe_price_id = current_app.config.get(price_id_key)
    if not stripe_price_id or stripe_price_id == "price_placeholder":
        raise ValueError(
            f"Stripe Price ID not configured for {pid.value}/{exam}. "
            f"Set env var {price_id_key}."
        )

    return {
        "plan_id":         pid,
        "plan_type":       _INDIVIDUAL_PLAN_TYPE[pid],
        "stripe_price_id": stripe_price_id,
        "duration_days":   _INDIVIDUAL_PLAN_DURATION[pid],
        "max_world_index": PLAN_WORLD_LIMIT["basic"],  # 5 — same for both plans
    }


# ── School plan config ────────────────────────────────────────────────────────

# School checkout sessions use price_data (dynamic amount per student count),
# not pre-created Stripe Price IDs.

SCHOOL_PLAN_TYPE = {
    "standard": PlanType.ORG_STANDARD,
    "volume":   PlanType.ORG_VOLUME,
}

SCHOOL_DURATION_DAYS = 365  # all school plans are 1 year


def get_school_plan_config(plan_tier: str, student_count: int) -> dict:
    """
    Returns school checkout config for a given tier and student count.

    plan_tier: 'standard' (SAR 99/student, min 30)
               'volume'   (SAR 75/student, min 100)

    Returns:
        price_per_student_halalas: int   (Stripe uses smallest currency unit)
        total_halalas:             int
        plan_type:                 PlanType
        duration_days:             int
        max_world_index:           int
    """
    plan_tier = (plan_tier or "").strip().lower()
    if plan_tier not in ("standard", "volume"):
        raise ValueError(f"Invalid plan_tier: {plan_tier!r}. Must be 'standard' or 'volume'.")

    min_students = current_app.config["SCHOOL_VOLUME_MIN_STUDENTS"]  # default 100

    if plan_tier == "standard" and student_count < 30:
        raise ValueError("Standard plan requires a minimum of 30 students.")
    if plan_tier == "volume" and student_count < min_students:
        raise ValueError(
            f"Volume plan requires a minimum of {min_students} students."
        )

    price_key = (
        "SCHOOL_PRICE_VOLUME_HALALAS"
        if plan_tier == "volume"
        else "SCHOOL_PRICE_STANDARD_HALALAS"
    )
    price_per_student = current_app.config[price_key]
    total_halalas = price_per_student * student_count

    return {
        "plan_tier":                plan_tier,
        "plan_type":                SCHOOL_PLAN_TYPE[plan_tier],
        "price_per_student_halalas": price_per_student,
        "price_per_student_sar":    price_per_student / 100,
        "total_halalas":            total_halalas,
        "total_sar":                total_halalas / 100,
        "student_count":            student_count,
        "duration_days":            SCHOOL_DURATION_DAYS,
        "max_world_index":          PLAN_WORLD_LIMIT["basic"],  # 5
    }


# ── Shared helpers ────────────────────────────────────────────────────────────

def compute_expiry(duration_days: int) -> datetime:
    """Returns UTC expiry datetime from now + duration_days."""
    return datetime.now(timezone.utc) + timedelta(days=duration_days)


def validate_exam(exam: str):
    """Raises ValueError if exam is not a valid exam key."""
    if exam not in VALID_EXAMS:
        raise ValueError(
            f"Invalid exam: {exam!r}. Must be one of {sorted(VALID_EXAMS)}."
        )