import enum
from datetime import datetime, timezone
from ..extensions import db


class PlanId(str, enum.Enum):
    FREE    = "free"
    BASIC   = "basic"
    PREMIUM = "premium"


class PlanType(str, enum.Enum):
    # ── Individual plans ──────────────────────────────────────────────────────
    INDIVIDUAL_BASIC_3M   = "individual_basic_3m"    # SAR 199 / 90 days
    INDIVIDUAL_PREMIUM_1Y = "individual_premium_1y"  # SAR 299 / 365 days

    # ── Org/school plans ─────────────────────────────────────────────────────
    # Used by admin manual grants (existing admin.py references these)
    ORG_BASIC   = "org_basic"
    ORG_PREMIUM = "org_premium"

    # Used by school Stripe Payment Link webhook (L1)
    ORG_STANDARD = "org_standard"   # SAR 99/student, min 30
    ORG_VOLUME   = "org_volume"     # SAR 75/student, min 100

    # Legacy — kept so existing DB rows remain valid; do not use for new grants
    SCHOOL_PREMIUM_1Y = "school_premium_1y"


class Entitlement(db.Model):
    """
    Active paid entitlement for a user OR an org (never both).

    Rules:
    - user_id XOR org_id must be set (enforced at API layer).
    - Stripe webhooks are the ONLY writer for individual entitlements.
    - Admin creates org entitlements — either manually or via school checkout webhook.
    - max_world_index is the ceiling; progression still applies within it.
    """
    __tablename__ = "entitlements"

    id      = db.Column(db.Integer, primary_key=True)

    # Owner — exactly one must be non-null (enforced at API layer)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id",
                         ondelete="CASCADE"), nullable=True, index=True)
    org_id  = db.Column(db.Integer, db.ForeignKey("orgs.id",
                         ondelete="CASCADE"), nullable=True, index=True)

    exam             = db.Column(db.String(20),  nullable=False)  # qudurat | tahsili
    plan_id          = db.Column(
        db.Enum(PlanId, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    plan_type        = db.Column(
        db.Enum(PlanType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    max_world_index  = db.Column(db.Integer, nullable=False)  # 5 for all paid plans

    entitlement_starts_at  = db.Column(db.DateTime(timezone=True), nullable=False,
                                       default=lambda: datetime.now(timezone.utc))
    entitlement_expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    # Idempotency — prevents double-grant on Stripe webhook retry
    stripe_session_id = db.Column(db.String(255), nullable=True, unique=True)

    # School metadata — stored for reporting; not used for access control
    student_count    = db.Column(db.Integer, nullable=True)   # school payments only

    # Audit
    granted_by_admin_id = db.Column(db.Integer, db.ForeignKey("users.id"),
                                    nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship("User", foreign_keys=[user_id], back_populates="entitlements")
    org  = db.relationship("Org",  back_populates="entitlements")

    def is_active(self) -> bool:
        return datetime.now(timezone.utc) < self.entitlement_expires_at

    def to_dict(self):
        return {
            "id":                     self.id,
            "user_id":                self.user_id,
            "org_id":                 self.org_id,
            "exam":                   self.exam,
            "plan_id":                self.plan_id.value,
            "plan_type":              self.plan_type.value,
            "max_world_index":        self.max_world_index,
            "entitlement_starts_at":  self.entitlement_starts_at.isoformat(),
            "entitlement_expires_at": self.entitlement_expires_at.isoformat(),
            "is_active":              self.is_active(),
            "student_count":          self.student_count,
        }


class ExamTrial(db.Model):
    """
    Per-user, per-exam 7-day trial.

    - Created on first World Map / Questions request for that exam.
    - UNIQUE on (user_id, exam) — one trial per exam, ever. No resets.
    - Grants access to world index 1 only while active.
    - After expiry, world 1 is also locked until paid plan purchased.
    """
    __tablename__ = "exam_trials"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id",
                                 ondelete="CASCADE"), nullable=False, index=True)
    exam             = db.Column(db.String(20), nullable=False)
    trial_started_at = db.Column(db.DateTime(timezone=True), nullable=False,
                                 default=lambda: datetime.now(timezone.utc))
    trial_expires_at = db.Column(db.DateTime(timezone=True), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "exam", name="uq_exam_trial_user_exam"),
    )

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