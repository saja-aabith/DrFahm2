"""
Question model.

Key design decisions:
- `id`  (integer PK) — internal only, never expose to students in gameplay URLs.
- `qid` (UUID)       — permanent external identifier. Safe to expose everywhere.
                       Never changes, never reused, survives soft-delete.
- `hint`             — shown to student only AFTER a wrong answer.
                       Backend sends it in the questions payload; client controls
                       reveal timing. It is NOT the correct answer.
- `section`          — subject within exam (math / verbal / biology / chemistry /
                       physics). Derived from world_key on assignment but stored
                       independently so unassigned questions are still filterable
                       by subject.
- `world_key`        — nullable. NULL = question lives in the bank, not yet placed
                       in a world. Set via bulk-assign workflow.
- `index`            — nullable. NULL when world_key is NULL (unassigned).
                       Deterministic question order within a level.
- Soft-delete        — deleted_at IS NOT NULL. Never hard-delete. Student attempt
                       data retains FK integrity forever.
- Optimistic locking — `version` integer. Any UPDATE must supply the current
                       version; mismatch → 409 Conflict.

AI review fields (added Chunk J):
- `review_status`        — workflow state machine (see ReviewStatus enum).
- `llm_predicted_answer` — GPT-proposed answer. NOT used in gameplay until admin
                           explicitly approves (copies to correct_answer).
- `llm_confidence`       — 0.0–1.0, LLM self-reported certainty.
- `llm_review_note`      — 1-sentence internal justification for admin verification.
                           NEVER included in any student-facing serialisation.
- `llm_proposed_hint`    — AI-drafted hint. Staged here until admin approves;
                           copied to hint column on approval.
- `llm_reviewed_at`      — timestamp of the most recent LLM call for this question.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from ..extensions import db


class Difficulty(str, enum.Enum):
    EASY   = "easy"
    MEDIUM = "medium"
    HARD   = "hard"


class ReviewStatus(str, enum.Enum):
    """
    AI review workflow states.

    Transitions:
      unreviewed  ──► ai_pending   (admin triggers AI review)
      ai_pending  ──► ai_reviewed  (LLM call succeeded)
      ai_pending  ──► unreviewed   (LLM call failed — reset so it can be retried)
      ai_reviewed ──► approved     (admin accepts prediction)
      ai_reviewed ──► rejected     (admin rejects prediction — manual edit needed)
      rejected    ──► approved     (admin edits and saves manually)
      approved    ──► ai_reviewed  (overwrite=true re-review)
    """
    UNREVIEWED  = "unreviewed"
    AI_PENDING  = "ai_pending"
    AI_REVIEWED = "ai_reviewed"
    APPROVED    = "approved"
    REJECTED    = "rejected"


class Question(db.Model):
    __tablename__ = "questions"

    # ── Primary key ──────────────────────────────────────────────────────────
    id  = db.Column(db.Integer, primary_key=True)

    # Permanent external ID — expose to students / exports / URLs.
    # Never changes on edit. Retained forever (even after soft-delete).
    qid = db.Column(
        PG_UUID(as_uuid=True),
        nullable=False,
        unique=True,
        default=uuid.uuid4,
        index=True,
    )

    # ── Classification ────────────────────────────────────────────────────────
    exam = db.Column(db.String(20), nullable=False, index=True)

    # Subject section (math / verbal / biology / chemistry / physics).
    # Stored independently of world_key so unassigned questions are
    # filterable. Set from world_key when assigned, or from CSV on upload.
    section = db.Column(db.String(30), nullable=True, index=True)

    # NULL = unassigned (question is in the bank, not yet placed in a world).
    world_key = db.Column(db.String(30), nullable=True, index=True)

    # 1-based position within world. NULL when world_key is NULL.
    index = db.Column(db.Integer, nullable=True)

    # ── Content ───────────────────────────────────────────────────────────────
    question_text  = db.Column(db.Text, nullable=False)
    option_a       = db.Column(db.Text, nullable=False)
    option_b       = db.Column(db.Text, nullable=False)
    option_c       = db.Column(db.Text, nullable=False)
    option_d       = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.String(1), nullable=False)   # 'a' | 'b' | 'c' | 'd'

    # Shown to student AFTER a wrong answer. Frontend controls reveal timing.
    # Never reveals the correct answer directly. Supports LaTeX ($...$).
    # Populated manually by admin OR copied from llm_proposed_hint on approval.
    hint = db.Column(db.Text, nullable=True)

    # Supporting image (data URI or HTTP URL). POST-MVP: migrate to S3.
    image_url = db.Column(db.Text, nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    topic      = db.Column(db.String(100), nullable=True, index=True)
    difficulty = db.Column(db.Enum(Difficulty), nullable=True, index=True)
    is_active  = db.Column(db.Boolean, nullable=False, default=False, index=True)

    # ── AI review fields ──────────────────────────────────────────────────────
    # These fields are INTERNAL to the admin workflow.
    # None of them are ever included in student-facing serialisation.
    # correct_answer is the single source of truth for gameplay — it is only
    # updated when an admin explicitly approves an llm_predicted_answer.

    # Workflow state — see ReviewStatus enum for valid transitions.
    review_status = db.Column(
        db.Enum(ReviewStatus),
        nullable=False,
        default=ReviewStatus.UNREVIEWED,
        server_default=ReviewStatus.UNREVIEWED.value,
        index=True,
    )

    # GPT-proposed answer (a/b/c/d). Staged — does NOT affect gameplay until
    # admin copies it to correct_answer via the approve-review endpoint.
    llm_predicted_answer = db.Column(db.String(1), nullable=True)

    # LLM self-reported certainty. Surfaced in admin panel to help prioritise
    # manual review (low confidence → check carefully).
    llm_confidence = db.Column(db.Float, nullable=True)

    # 1-sentence internal note from the LLM explaining its predicted answer.
    # Shown only in admin panel to help verify quickly.
    # INVARIANT: never included in any serialisation path that reaches students.
    llm_review_note = db.Column(db.Text, nullable=True)

    # AI-drafted student hint. Staged here until admin approves.
    # Copied to hint column only on explicit approval (accept_hint=True).
    # Preserves any existing human-written hint until overwritten.
    llm_proposed_hint = db.Column(db.Text, nullable=True)

    # Timestamp of the most recent LLM review call for this question.
    llm_reviewed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # ── Soft delete ───────────────────────────────────────────────────────────
    deleted_at          = db.Column(db.DateTime(timezone=True), nullable=True)
    deleted_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Review audit ─────────────────────────────────────────────────────────
    last_reviewed_at          = db.Column(db.DateTime(timezone=True), nullable=True)
    last_reviewed_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Write audit ───────────────────────────────────────────────────────────
    created_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_admin_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Optimistic locking ────────────────────────────────────────────────────
    version = db.Column(db.Integer, nullable=False, default=1)

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

    # Partial unique index (world_key, index) is managed in the migration —
    # only enforced when both are non-null and row is not soft-deleted.
    __table_args__ = ()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def is_assigned(self) -> bool:
        """True if the question has been placed into a world."""
        return self.world_key is not None

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    # ── Serialisation ─────────────────────────────────────────────────────────

    def to_dict(
        self,
        include_answer: bool = False,
        include_hint:   bool = False,
    ) -> dict:
        """
        Serialise question to a dict.

        include_answer=True  → admin view: adds correct_answer, hint, AND all
                               llm_* review fields (predicted_answer, confidence,
                               review_note, proposed_hint, review_status).
        include_hint=True    → gameplay view: adds hint only. No answer,
                               no llm_* fields ever reach students.

        INVARIANT: llm_review_note and llm_* fields are NEVER included unless
        include_answer=True. They are internal admin-only fields.
        """
        d = {
            "id":            self.id,
            "qid":           str(self.qid) if self.qid else None,
            "exam":          self.exam,
            "section":       self.section,
            "world_key":     self.world_key,
            "index":         self.index,
            "is_assigned":   self.is_assigned,
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
            "last_reviewed_at": (
                self.last_reviewed_at.isoformat() if self.last_reviewed_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_answer:
            # ── Admin view ────────────────────────────────────────────────────
            # Full content + all AI review fields.
            d["correct_answer"] = self.correct_answer
            d["hint"]           = self.hint

            # AI review workflow fields — admin panel only
            d["review_status"]        = self.review_status.value if self.review_status else ReviewStatus.UNREVIEWED.value
            d["llm_predicted_answer"] = self.llm_predicted_answer
            d["llm_confidence"]       = self.llm_confidence
            d["llm_review_note"]      = self.llm_review_note        # INTERNAL ONLY
            d["llm_proposed_hint"]    = self.llm_proposed_hint
            d["llm_reviewed_at"]      = (
                self.llm_reviewed_at.isoformat() if self.llm_reviewed_at else None
            )

        elif include_hint:
            # ── Gameplay view ─────────────────────────────────────────────────
            # Hint only. No answer, no llm_* fields.
            d["hint"] = self.hint

        return d