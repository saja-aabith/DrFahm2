import enum
from datetime import datetime, timezone
from ..extensions import db


class Difficulty(str, enum.Enum):
    EASY   = "easy"
    MEDIUM = "medium"
    HARD   = "hard"


class Question(db.Model):
    """
    A single MCQ question.

    Optimistic locking via `version` integer.
    Any UPDATE must supply the current version; mismatch → 409.

    Soft-delete via deleted_at (never hard-delete questions).
    UNIQUE constraint on (exam, world_key, index) — upsert key for imports.
    """
    __tablename__ = "questions"

    id          = db.Column(db.Integer, primary_key=True)
    exam        = db.Column(db.String(20), nullable=False, index=True)
    world_key   = db.Column(db.String(30), nullable=False, index=True)
    index       = db.Column(db.Integer, nullable=False)        # 1-based, deterministic order

    # Content
    question_text = db.Column(db.Text, nullable=False)
    option_a      = db.Column(db.Text, nullable=False)
    option_b      = db.Column(db.Text, nullable=False)
    option_c      = db.Column(db.Text, nullable=False)
    option_d      = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)   # 'a' | 'b' | 'c' | 'd'

    # Supporting image (base64 data URL or external URL)
    # Stored as data:image/png;base64,... for uploaded images
    # Max ~500KB encoded. POST-MVP: migrate to S3/Cloudinary.
    image_url     = db.Column(db.Text, nullable=True)

    # Metadata
    topic       = db.Column(db.String(100), nullable=True)
    difficulty  = db.Column(db.Enum(Difficulty), nullable=True)
    is_active   = db.Column(db.Boolean, nullable=False, default=True)
    deleted_at  = db.Column(db.DateTime(timezone=True), nullable=True)

    # Review audit
    last_reviewed_at         = db.Column(db.DateTime(timezone=True), nullable=True)
    last_reviewed_by_admin_id = db.Column(db.Integer,
                                db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Write audit
    created_by_admin_id  = db.Column(db.Integer,
                           db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by_admin_id  = db.Column(db.Integer,
                           db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Optimistic locking
    version     = db.Column(db.Integer, nullable=False, default=1)

    # Advisory concurrency (not a hard lock — optimistic locking is the real guard)
    currently_editing_admin_id = db.Column(db.Integer,
                                  db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    editing_since = db.Column(db.DateTime(timezone=True), nullable=True)

    created_at  = db.Column(db.DateTime(timezone=True), nullable=False,
                            default=lambda: datetime.now(timezone.utc))
    updated_at  = db.Column(db.DateTime(timezone=True), nullable=False,
                            default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("exam", "world_key", "index",
                            name="uq_question_exam_world_index"),
    )

    def to_dict(self, include_answer: bool = False):
        d = {
            "id":            self.id,
            "exam":          self.exam,
            "world_key":     self.world_key,
            "index":         self.index,
            "question_text": self.question_text,
            "option_a":      self.option_a,
            "option_b":      self.option_b,
            "option_c":      self.option_c,
            "option_d":      self.option_d,
            "image_url":     self.image_url,
            "topic":         self.topic,
            "difficulty":    self.difficulty.value if self.difficulty else None,
            "is_active":     self.is_active,
            "version":       self.version,
            "created_at":    self.created_at.isoformat(),
            "updated_at":    self.updated_at.isoformat(),
        }
        if include_answer:
            d["correct_answer"] = self.correct_answer
        return d