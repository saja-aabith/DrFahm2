import enum
from datetime import datetime, timezone
from ..extensions import db


class PlanId(str, enum.Enum):
    FREE    = "free"
    BASIC   = "basic"
    PREMIUM = "premium"


class PlanType(str, enum.Enum):
    INDIVIDUAL_BASIC_3M   = "individual_basic_3m"
    INDIVIDUAL_PREMIUM_1Y = "individual_premium_1y"
    SCHOOL_PREMIUM_1Y     = "school_premium_1y"     # POST-MVP Stripe; stored for lead-based grants


class Entitlement(db.Model):
    """
    Active paid entitlement for a user OR an org (never both).

    Rules:
    - user_id XOR org_id must be set (enforced at API layer).
    - Stripe webhooks are the ONLY writer for individual entitlements.
    - DrFahm Admin creates org entitlements after manual school deal.
    - max_world_index is the ceiling; progression still applies within it.
    """
    __tablename__ = "entitlements"

    id                   = db.Column(db.Integer, primary_key=True)

    # Owner — exactly one must be non-null (enforced at API layer)
    user_id              = db.Column(db.Integer, db.ForeignKey("users.id",
                                     ondelete="CASCADE"), nullable=True, index=True)
    org_id               = db.Column(db.Integer, db.ForeignKey("orgs.id",
                                     ondelete="CASCADE"), nullable=True, index=True)

    exam                 = db.Column(db.String(20), nullable=False)   # qudurat | tahsili
    plan_id              = db.Column(db.Enum(PlanId), nullable=False)
    plan_type            = db.Column(db.Enum(PlanType), nullable=False)
    max_world_index      = db.Column(db.Integer, nullable=False)       # 5 for basic, 10 for premium

    entitlement_starts_at  = db.Column(db.DateTime(timezone=True), nullable=False,
                                       default=lambda: datetime.now(timezone.utc))
    entitlement_expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    stripe_session_id    = db.Column(db.String(255), nullable=True, unique=True)

    created_at           = db.Column(db.DateTime(timezone=True), nullable=False,
                                     default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship("User", foreign_keys=[user_id], back_populates="entitlements")
    org  = db.relationship("Org", back_populates="entitlements")

    # ── Helper ────────────────────────────────────────────
    def is_active(self) -> bool:
        return datetime.now(timezone.utc) < self.entitlement_expires_at

    def to_dict(self):
        return {
            "id":                    self.id,
            "user_id":               self.user_id,
            "org_id":                self.org_id,
            "exam":                  self.exam,
            "plan_id":               self.plan_id.value,
            "plan_type":             self.plan_type.value,
            "max_world_index":       self.max_world_index,
            "entitlement_starts_at": self.entitlement_starts_at.isoformat(),
            "entitlement_expires_at": self.entitlement_expires_at.isoformat(),
            "is_active":             self.is_active(),
        }


class ExamTrial(db.Model):
    """
    Per-user, per-exam 7-day trial.

    - Created on first World Map / Questions request for that exam.
    - UNIQUE on (user_id, exam) — one trial per exam, ever. No resets.
    - Grants access to worlds 1–2 only while active.
    - After expiry, even worlds 1–2 are locked until paid plan purchased.
    """
    __tablename__ = "exam_trials"

    id                = db.Column(db.Integer, primary_key=True)
    user_id           = db.Column(db.Integer, db.ForeignKey("users.id",
                                  ondelete="CASCADE"), nullable=False, index=True)
    exam              = db.Column(db.String(20), nullable=False)
    trial_started_at  = db.Column(db.DateTime(timezone=True), nullable=False,
                                  default=lambda: datetime.now(timezone.utc))
    trial_expires_at  = db.Column(db.DateTime(timezone=True), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "exam", name="uq_exam_trial_user_exam"),
    )

    # Relationship
    user = db.relationship("User", back_populates="trials")

    def is_active(self) -> bool:
        return datetime.now(timezone.utc) < self.trial_expires_at

    def to_dict(self):
        return {
            "id":               self.id,
            "user_id":          self.user_id,
            "exam":             self.exam,
            "trial_started_at": self.trial_started_at.isoformat(),
            "trial_expires_at": self.trial_expires_at.isoformat(),
            "is_active":        self.is_active(),
        }