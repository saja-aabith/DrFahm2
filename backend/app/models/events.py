from datetime import datetime, timezone
from ..extensions import db

# Stable enum values — do not rename without updating any consumers
VALID_EVENT_TYPES = {"pricing_viewed", "checkout_started", "trial_started"}


class AppEvent(db.Model):
    """
    Lightweight analytics event log.
    Backend-only in MVP — no analytics UI.
    user_id nullable to capture pre-auth events.
    """
    __tablename__ = "app_events"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id",
                           ondelete="SET NULL"), nullable=True, index=True)
    event_type = db.Column(db.String(50), nullable=False)   # pricing_viewed | checkout_started | trial_started
    exam       = db.Column(db.String(20), nullable=True)
    plan_id    = db.Column(db.String(20), nullable=True)
    meta       = db.Column(db.JSON, nullable=True)          # arbitrary extra context
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))