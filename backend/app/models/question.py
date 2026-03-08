import enum
import uuid
from datetime import datetime, timezone
from ..extensions import db


class Difficulty(str, enum.Enum):
    EASY   = "easy"
    MEDIUM = "medium"
    HARD   = "hard"


class Question(db.Model):
    """
    A single MCQ question in the central question bank.

    KEY DESIGN DECISIONS:
      - `qid` (UUID) is the permanent external identity — never changes, never reused.
        Use qid in any external references (student attempts, exports, URLs).
      - `id` (integer PK) is internal only — never expose to students.
      - `section` (e.g. 'math', 'verbal', 'biology') is set at creation and
        determines which topic list is valid. Derived from world_key if assigned,
        or set directly on upload for unassigned questions.
      - `world_key` and `index` are NULLABLE — questions live in the bank first,
        world/level assignment happens later via admin bulk tools.
      - Soft-delete via `deleted_at` — questions are NEVER hard-deleted.
        This protects referential integrity with student attempt data.
      - Optimistic locking via `version` integer.
        Any UPDATE must supply the current version; mismatch → 409.
    """
    __tablename__ = "questions"

    # ── Identity ──────────────────────────────────────────────────────────────
    id  = db.Column(db.Integer, primary_key=True)

    # Permanent external ID — globally unique, immutable, never reused
    qid = db.Column(
        db.dialects.postgresql.UUID(as_uuid=True),
        nullable=False,
        default=uuid.uuid4,
        unique=True,
        index=True,
    )

    # ── Exam routing ──────────────────────────────────────────────────────────
    exam    = db.Column(db.String(20), nullable=False, index=True)  # 'qudurat' | 'tahsili'
    section = db.Column(db.String(30), nullable=True,  index=True)  # 'math' | 'verbal' | 'biology' | ...

    # World assignment — nullable until assigned via admin bulk tools
    world_key = db.Column(db.String(30), nullable=True, index=True)
    index     = db.Column(db.Integer,    nullable=True)   # 1-based within world

    # ── Content ───────────────────────────────────────────────────────────────
    question_text  = db.Column(db.Text, nullable=False)
    option_a       = db.Column(db.Text, nullable=False)
    option_b       = db.Column(db.Text, nullable=False)
    option_c       = db.Column(db.Text, nullable=False)
    option_d       = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)  # 'a' | 'b' | 'c' | 'd'

    # hint: shown to student ONLY after a wrong answer.
    # Must guide reasoning — must NOT directly reveal the correct answer.
    hint = db.Column(db.Text, nullable=True)

    # Supporting image (base64 data URL or external URL).
    # POST-MVP: migrate to S3/Cloudinary. Max ~500KB encoded.
    image_url = db.Column(db.Text, nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    topic      = db.Column(db.String(100), nullable=True)
    difficulty = db.Column(db.Enum(Difficulty), nullable=True)
    is_active  = db.Column(db.Boolean, nullable=False, default=False)

    # ── Soft delete ───────────────────────────────────────────────────────────
    # Never hard-delete — preserve referential integrity with attempt data.
    deleted_at            = db.Column(db.DateTime(timezone=True), nullable=True)
    deleted_by_admin_id   = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Review audit ──────────────────────────────────────────────────────────
    last_reviewed_at          = db.Column(db.DateTime(timezone=True), nullable=True)
    last_reviewed_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Write audit ───────────────────────────────────────────────────────────
    created_by_admin_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by_admin_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # ── Optimistic locking ────────────────────────────────────────────────────
    version = db.Column(db.Integer, nullable=False, default=1)

    # Advisory concurrency (not a hard lock — optimistic locking is the real guard)
    currently_editing_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    editing_since = db.Column(db.DateTime(timezone=True), nullable=True)

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # ── Constraints ───────────────────────────────────────────────────────────
    # NOTE: The hard UNIQUE constraint on (exam, world_key, index) has been
    # replaced with a PARTIAL unique index in the migration:
    #   CREATE UNIQUE INDEX uq_question_exam_world_index_partial
    #   ON questions(exam, world_key, index)
    #   WHERE world_key IS NOT NULL AND index IS NOT NULL AND deleted_at IS NULL
    #
    # SQLAlchemy __table_args__ cannot express partial indexes cleanly —
    # the index is managed purely at the DB level via migration.
    __table_args__ = ()

    # ── Helpers ───────────────────────────────────────────────────────────────

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    @property
    def is_assigned(self) -> bool:
        """True if this question has been placed into a world."""
        return self.world_key is not None and self.index is not None

    def to_dict(self, include_answer: bool = False) -> dict:
        """
        Serialize for API responses.

        `include_answer=True` is ONLY for admin endpoints.
        Student-facing endpoints must NEVER pass include_answer=True.
        hint is included with include_answer=True (shown after wrong answer only —
        the frontend controls when to reveal it, not the serializer).
        """
        d = {
            "id":            self.id,
            "qid":           str(self.qid) if self.qid else None,
            "exam":          self.exam,
            "section":       self.section,
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
            "is_assigned":   self.is_assigned,
            "version":       self.version,
            "last_reviewed_at": (
                self.last_reviewed_at.isoformat() if self.last_reviewed_at else None
            ),
            "created_at":    self.created_at.isoformat(),
            "updated_at":    self.updated_at.isoformat(),
        }
        if include_answer:
            d["correct_answer"] = self.correct_answer
            d["hint"]           = self.hint
        return d