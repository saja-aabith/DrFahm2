from datetime import datetime, timezone
from ..extensions import db

# Allowed duration values for school leads
VALID_DURATIONS = {"7days", "3months", "1year"}

# Pricing bands (per-student/year in SAR) — informational
PRICING_BANDS = [
    (50,  100, 180),
    (101, 300, 150),
    (301, 600, 120),
]


def compute_estimated_band(total_students: int) -> str:
    for low, high, price in PRICING_BANDS:
        if low <= total_students <= high:
            return f"SAR {price}/student/year"
    if total_students > 600:
        return "Custom"
    return "Unknown"


class Lead(db.Model):
    """
    Stores school contact form submissions.
    Email sending may be 501 if not configured (MVP).
    """
    __tablename__ = "leads"

    id                  = db.Column(db.Integer, primary_key=True)

    # Common fields
    name                = db.Column(db.String(255), nullable=False)
    email               = db.Column(db.String(255), nullable=False)
    role                = db.Column(db.String(20), nullable=False)    # student | parent | school
    message             = db.Column(db.Text, nullable=True)
    context             = db.Column(db.String(100), nullable=True)    # e.g. "pricing_page"

    # School-specific fields
    school_name         = db.Column(db.String(255), nullable=True)
    qudurat_students    = db.Column(db.Integer, nullable=True)
    tahsili_students    = db.Column(db.Integer, nullable=True)
    total_students      = db.Column(db.Integer, nullable=True)        # computed on write
    preferred_duration  = db.Column(db.String(20), nullable=True)     # 7days | 3months | 1year
    estimated_band      = db.Column(db.String(50), nullable=True)     # e.g. "SAR 150/student/year"

    created_at          = db.Column(db.DateTime(timezone=True), nullable=False,
                                    default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id":                 self.id,
            "name":               self.name,
            "email":              self.email,
            "role":               self.role,
            "school_name":        self.school_name,
            "qudurat_students":   self.qudurat_students,
            "tahsili_students":   self.tahsili_students,
            "total_students":     self.total_students,
            "preferred_duration": self.preferred_duration,
            "estimated_band":     self.estimated_band,
            "created_at":         self.created_at.isoformat(),
        }