"""
Stripe configuration and plan resolution.

All plan → price / duration / world limit mappings live here.
Backend never trusts amounts or durations from the frontend.
"""

from datetime import datetime, timedelta, timezone
from flask import current_app

from ..models.entitlement import PlanId, PlanType
from ..utils.world_config import PLAN_WORLD_LIMIT, VALID_EXAMS


# ── Plan config ───────────────────────────────────────────────────────────────
# Keyed by plan_id. Everything backend needs to build a checkout session
# and grant an entitlement is derived from here + env vars.

def get_plan_config(plan_id: str) -> dict:
    """
    Returns config dict for a given plan_id.
    Raises ValueError for unknown or non-Stripe plan_ids.

    {
        "plan_id":         PlanId,
        "plan_type":       PlanType,
        "stripe_price_id": str,           # from env
        "duration_days":   int,
        "max_world_index": int,
    }
    """
    if plan_id == PlanId.FREE:
        raise ValueError(
            "Free plan does not use Stripe checkout. "
            "Trial is started via the exam world map request."
        )

    configs = {
        PlanId.BASIC: {
            "plan_id":         PlanId.BASIC,
            "plan_type":       PlanType.INDIVIDUAL_BASIC_3M,
            "stripe_price_id": current_app.config["STRIPE_PRICE_BASIC_3M"],
            "duration_days":   90,    # 3 months
            "max_world_index": PLAN_WORLD_LIMIT["basic"],   # 5
        },
        PlanId.PREMIUM: {
            "plan_id":         PlanId.PREMIUM,
            "plan_type":       PlanType.INDIVIDUAL_PREMIUM_1Y,
            "stripe_price_id": current_app.config["STRIPE_PRICE_PREMIUM_1Y"],
            "duration_days":   365,   # 12 months
            "max_world_index": PLAN_WORLD_LIMIT["premium"],  # 10
        },
    }

    config = configs.get(plan_id)
    if not config:
        raise ValueError(f"Unknown plan_id: {plan_id!r}")
    return config


def compute_expiry(duration_days: int) -> datetime:
    """Returns UTC expiry datetime from now + duration_days."""
    return datetime.now(timezone.utc) + timedelta(days=duration_days)


def validate_exam(exam: str):
    """Raises ValueError if exam is not valid."""
    if exam not in VALID_EXAMS:
        raise ValueError(
            f"Invalid exam: {exam!r}. Must be one of {sorted(VALID_EXAMS)}."
        )