"""add llm_predicted_topic

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-03-27

Adds llm_predicted_topic to questions table (Chunk K1).
The LLM proposes a topic key; it is staged here and copied to
the topic column only when admin explicitly approves.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision    = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on    = None


def upgrade():
    op.add_column(
        'questions',
        sa.Column('llm_predicted_topic', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column('questions', 'llm_predicted_topic')
