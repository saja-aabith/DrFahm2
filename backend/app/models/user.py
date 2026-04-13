import enum
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from ..extensions import db


class UserRole(str, enum.Enum):
    STUDENT       = "student"
    SCHOOL_LEADER = "school_leader"
    DRFAHM_ADMIN  = "drfahm_admin"


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email         = db.Column(db.String(255), unique=True, nullable=True)  # nullable for bulk-generated school accounts
    password_hash = db.Column(db.String(255), nullable=False)
    role          = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.STUDENT)
    is_active     = db.Column(db.Boolean, nullable=False, default=True)
    phone_number  = db.Column(db.String(30), nullable=True)

    # Org membership — null for direct (B2C) students and admins
    org_id        = db.Column(db.Integer, db.ForeignKey("orgs.id",
                              ondelete="SET NULL"), nullable=True, index=True)

    # Audit
    created_at    = db.Column(db.DateTime(timezone=True), nullable=False,
                              default=lambda: datetime.now(timezone.utc))
    updated_at    = db.Column(db.DateTime(timezone=True), nullable=False,
                              default=lambda: datetime.now(timezone.utc),
                              onupdate=lambda: datetime.now(timezone.utc))
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey("users.id",
                                    ondelete="SET NULL"), nullable=True)

    # Relationships
    org          = db.relationship("Org", foreign_keys=[org_id],
                                   back_populates="users")
    trials       = db.relationship("ExamTrial", back_populates="user",
                                   lazy="dynamic")
    entitlements = db.relationship("Entitlement",
                                   foreign_keys="Entitlement.user_id",
                                   back_populates="user", lazy="dynamic")
    level_progress = db.relationship("LevelProgress", back_populates="user",
                                     lazy="dynamic")
    world_progress = db.relationship("WorldProgress", back_populates="user",
                                     lazy="dynamic")

    # ── Password helpers ──────────────────────────────────
    def set_password(self, plaintext: str):
        self.password_hash = generate_password_hash(plaintext)

    def check_password(self, plaintext: str) -> bool:
        return check_password_hash(self.password_hash, plaintext)

    def to_dict(self):
        return {
            "id":           self.id,
            "username":     self.username,
            "email":        self.email,
            "role":         self.role.value,
            "is_active":    self.is_active,
            "org_id":       self.org_id,
            "phone_number": self.phone_number,
            "created_at":   self.created_at.isoformat(),
        }