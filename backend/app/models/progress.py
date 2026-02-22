from datetime import datetime, timezone
from ..extensions import db


class LevelProgress(db.Model):
    """
    Tracks a student's result per (exam, world_key, level_number).
    A level is "passed" when the student achieves the required score (enforced at API layer).
    UNIQUE on (user_id, exam, world_key, level_number).
    """
    __tablename__ = "level_progress"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id",
                                 ondelete="CASCADE"), nullable=False, index=True)
    exam             = db.Column(db.String(20), nullable=False)
    world_key        = db.Column(db.String(30), nullable=False)
    level_number     = db.Column(db.Integer, nullable=False)   # 1–10

    passed           = db.Column(db.Boolean, nullable=False, default=False)
    score            = db.Column(db.Integer, nullable=True)    # raw correct count
    total_questions  = db.Column(db.Integer, nullable=True)    # questions in this level attempt
    attempts         = db.Column(db.Integer, nullable=False, default=0)
    last_attempted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "exam", "world_key", "level_number",
                            name="uq_level_progress_user_exam_world_level"),
    )

    # Relationship
    user = db.relationship("User", back_populates="level_progress")

    def to_dict(self):
        return {
            "level_number":     self.level_number,
            "passed":           self.passed,
            "score":            self.score,
            "total_questions":  self.total_questions,
            "attempts":         self.attempts,
            "last_attempted_at": self.last_attempted_at.isoformat() if self.last_attempted_at else None,
        }


class WorldProgress(db.Model):
    """
    Summary record: is a world fully completed (all 10 levels passed)?
    Written by the submit endpoint after every level pass check.
    UNIQUE on (user_id, exam, world_key).
    """
    __tablename__ = "world_progress"

    id               = db.Column(db.Integer, primary_key=True)
    user_id          = db.Column(db.Integer, db.ForeignKey("users.id",
                                 ondelete="CASCADE"), nullable=False, index=True)
    exam             = db.Column(db.String(20), nullable=False)
    world_key        = db.Column(db.String(30), nullable=False)
    fully_completed  = db.Column(db.Boolean, nullable=False, default=False)
    completed_at     = db.Column(db.DateTime(timezone=True), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("user_id", "exam", "world_key",
                            name="uq_world_progress_user_exam_world"),
    )

    # Relationship
    user = db.relationship("User", back_populates="world_progress")

    def to_dict(self):
        return {
            "world_key":       self.world_key,
            "fully_completed": self.fully_completed,
            "completed_at":    self.completed_at.isoformat() if self.completed_at else None,
        }