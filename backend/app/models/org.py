from datetime import datetime, timezone
from ..extensions import db


class Org(db.Model):
    """
    A school organization.
    Each org has exactly ONE school_leader (enforced at API layer).
    Students belong to at most ONE org.
    """
    __tablename__ = "orgs"

    id               = db.Column(db.Integer, primary_key=True)
    name             = db.Column(db.String(255), nullable=False)
    slug             = db.Column(db.String(100), unique=True, nullable=False)
    is_active        = db.Column(db.Boolean, nullable=False, default=True)

    # Informational — final pricing is manual in MVP
    estimated_student_count = db.Column(db.Integer, nullable=True)

    created_at       = db.Column(db.DateTime(timezone=True), nullable=False,
                                 default=lambda: datetime.now(timezone.utc))
    updated_at       = db.Column(db.DateTime(timezone=True), nullable=False,
                                 default=lambda: datetime.now(timezone.utc),
                                 onupdate=lambda: datetime.now(timezone.utc))
    created_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            name="fk_orgs_created_by_admin_id_users",
            ondelete="SET NULL",
            use_alter=True,   # key: create FK via ALTER TABLE later
        ),
        nullable=True,
    )

    # Relationships
    users        = db.relationship("User", foreign_keys="User.org_id",
                                   back_populates="org", lazy="dynamic")
    entitlements = db.relationship("Entitlement", back_populates="org",
                                   lazy="dynamic")

    def to_dict(self):
        return {
            "id":            self.id,
            "name":          self.name,
            "slug":          self.slug,
            "is_active":     self.is_active,
            "estimated_student_count": self.estimated_student_count,
            "created_at":    self.created_at.isoformat(),
        }