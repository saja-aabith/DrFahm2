from datetime import datetime, timezone
from ..extensions import db


class StripeEvent(db.Model):
    """
    Idempotency table for Stripe webhook events.

    Workflow:
    1. Webhook arrives.
    2. Attempt INSERT of stripe_event_id (UNIQUE).
    3. If conflict → already processed → return 200 immediately.
    4. If inserted → process → update status to 'processed' or 'failed'.

    This guarantees each Stripe event is processed exactly once.
    """
    __tablename__ = "stripe_events"

    id              = db.Column(db.Integer, primary_key=True)
    stripe_event_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    event_type      = db.Column(db.String(100), nullable=False)
    status          = db.Column(db.String(20), nullable=False, default="pending")
                      # pending | processed | failed | skipped

    payload         = db.Column(db.Text, nullable=True)     # raw JSON string
    error_message   = db.Column(db.Text, nullable=True)

    received_at     = db.Column(db.DateTime(timezone=True), nullable=False,
                                default=lambda: datetime.now(timezone.utc))
    processed_at    = db.Column(db.DateTime(timezone=True), nullable=True)

    def to_dict(self):
        return {
            "id":              self.id,
            "stripe_event_id": self.stripe_event_id,
            "event_type":      self.event_type,
            "status":          self.status,
            "received_at":     self.received_at.isoformat(),
            "processed_at":    self.processed_at.isoformat() if self.processed_at else None,
        }