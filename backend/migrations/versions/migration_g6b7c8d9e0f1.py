"""add duration_seconds to level_progress

Revision ID: g6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-04-03

Adds duration_seconds (nullable int) to level_progress.
Records the elapsed seconds of the first passing attempt.
Used as the tiebreaker in the M1 leaderboard.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision      = 'g6b7c8d9e0f1'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on    = None


def upgrade():
    # ADD COLUMN IF NOT EXISTS — idempotent.
    # Column was applied manually on 2026-04-04 before this migration ran.
    # DB was stamped to this revision directly via:
    #   UPDATE alembic_version SET version_num = 'g6b7c8d9e0f1'
    op.execute(
        "ALTER TABLE level_progress ADD COLUMN IF NOT EXISTS duration_seconds INTEGER"
    )


def downgrade():
    op.drop_column('level_progress', 'duration_seconds')
