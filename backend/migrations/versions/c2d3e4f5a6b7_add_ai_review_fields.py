"""add_ai_review_fields

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-03-26 00:00:00.000000

Adds AI-assisted review columns to questions table.

New columns:
  review_status        — workflow state: unreviewed → ai_pending → ai_reviewed → approved/rejected
  llm_predicted_answer — GPT-proposed answer (a/b/c/d). NOT used in gameplay until admin approves.
  llm_confidence       — float 0.0–1.0 returned by LLM
  llm_review_note      — 1-sentence internal justification for admins. NEVER shown to students.
  llm_proposed_hint    — AI-drafted hint. Copied to hint column only on admin approval.
  llm_reviewed_at      — timestamp of last LLM call for this question

Safe to apply on live DB — all new nullable columns with server_default where needed.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision      = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on    = None

# Define the enum once so upgrade/downgrade share the same object
_REVIEW_STATUS_ENUM = sa.Enum(
    'unreviewed',
    'ai_pending',
    'ai_reviewed',
    'approved',
    'rejected',
    name='reviewstatus',
)


def upgrade():
    # Create the Postgres enum type first (checkfirst=True is idempotent)
    _REVIEW_STATUS_ENUM.create(op.get_bind(), checkfirst=True)

    op.add_column('questions', sa.Column(
        'review_status',
        _REVIEW_STATUS_ENUM,
        nullable=False,
        server_default='unreviewed',
    ))
    op.add_column('questions', sa.Column(
        'llm_predicted_answer', sa.String(1), nullable=True,
    ))
    op.add_column('questions', sa.Column(
        'llm_confidence', sa.Float, nullable=True,
    ))
    op.add_column('questions', sa.Column(
        'llm_review_note', sa.Text, nullable=True,
    ))
    op.add_column('questions', sa.Column(
        'llm_proposed_hint', sa.Text, nullable=True,
    ))
    op.add_column('questions', sa.Column(
        'llm_reviewed_at', sa.DateTime(timezone=True), nullable=True,
    ))

    # Index for admin panel filter: "show only ai_reviewed questions"
    op.create_index('ix_questions_review_status', 'questions', ['review_status'])


def downgrade():
    op.drop_index('ix_questions_review_status', table_name='questions')
    op.drop_column('questions', 'llm_reviewed_at')
    op.drop_column('questions', 'llm_proposed_hint')
    op.drop_column('questions', 'llm_review_note')
    op.drop_column('questions', 'llm_confidence')
    op.drop_column('questions', 'llm_predicted_answer')
    op.drop_column('questions', 'review_status')
    _REVIEW_STATUS_ENUM.drop(op.get_bind(), checkfirst=True)
