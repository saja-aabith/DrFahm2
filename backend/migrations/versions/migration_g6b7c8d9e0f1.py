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
down_revision = 'f5a6b7c8d9e0'
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column(
        'level_progress',
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column('level_progress', 'duration_seconds')
