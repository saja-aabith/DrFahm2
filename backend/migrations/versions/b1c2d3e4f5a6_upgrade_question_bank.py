"""Upgrade question bank — hint, qid, section, soft-delete, nullable world

Revision ID: b1c2d3e4f5a6
Revises: a3f1c2d4e5b6
Create Date: 2026-03-08

WHAT THIS MIGRATION DOES (in safe order):
  1.  Add `hint` column (nullable TEXT)
  2.  Copy existing `explanation` → `hint` (zero data loss)
  3.  Drop `explanation` column
  4.  Add `section` column (nullable VARCHAR 30) — e.g. 'math', 'verbal'
  5.  Backfill `section` from `world_key` for all existing rows
  6.  Enable pgcrypto (needed for gen_random_uuid on older PG versions)
  7.  Add `qid` UUID column, backfill all rows, make NOT NULL, add unique index
  8.  Add `deleted_by_admin_id` FK column
  9.  Drop old unique constraint on (exam, world_key, index)
  10. Make `world_key` and `index` nullable (unassigned questions)
  11. Add partial unique index — only enforces uniqueness when both are set
  12. Add performance indexes for scale (6k–100k questions)

ROLLBACK:
  downgrade() reverses every step in reverse order.
  No data is lost — hint is copied back to explanation before hint is dropped.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers
revision      = 'b1c2d3e4f5a6'
down_revision = 'a3f1c2d4e5b6'
branch_labels = None
depends_on    = None


def upgrade():
    # ── 1. Add hint column ────────────────────────────────────────────────────
    op.add_column('questions', sa.Column('hint', sa.Text(), nullable=True))

    # ── 2. Copy explanation → hint (zero data loss) ───────────────────────────
    op.execute('UPDATE questions SET hint = explanation WHERE explanation IS NOT NULL')

    # ── 3. Drop explanation ───────────────────────────────────────────────────
    op.drop_column('questions', 'explanation')

    # ── 4. Add section column (nullable — backfilled next) ────────────────────
    op.add_column('questions',
        sa.Column('section', sa.String(30), nullable=True, index=True))

    # ── 5. Backfill section from world_key (e.g. 'math_100' → 'math') ─────────
    op.execute("""
        UPDATE questions
        SET section = SPLIT_PART(world_key, '_', 1)
        WHERE world_key IS NOT NULL AND section IS NULL
    """)

    # ── 6. Enable pgcrypto (safe no-op if already enabled) ────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    # ── 7. Add qid UUID — backfill existing rows, then enforce NOT NULL ────────
    op.add_column('questions',
        sa.Column('qid', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute('UPDATE questions SET qid = gen_random_uuid() WHERE qid IS NULL')
    op.alter_column('questions', 'qid', nullable=False)
    op.create_index('questions_qid_unique_idx', 'questions', ['qid'], unique=True)

    # ── 8. Add deleted_by_admin_id ─────────────────────────────────────────────
    op.add_column('questions',
        sa.Column('deleted_by_admin_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))

    # ── 9. Drop old hard unique constraint (world_key & index becoming nullable)
    op.drop_constraint('uq_question_exam_world_index', 'questions', type_='unique')

    # ── 10. Make world_key and index nullable ─────────────────────────────────
    op.alter_column('questions', 'world_key', nullable=True)
    op.alter_column('questions', 'index',     nullable=True)

    # ── 11. Partial unique index — only when world_key + index are both set ───
    # This preserves the original safety guarantee for assigned questions
    # while allowing NULL world_key/index for unassigned bank questions.
    op.execute("""
        CREATE UNIQUE INDEX uq_question_exam_world_index_partial
        ON questions(exam, world_key, index)
        WHERE world_key IS NOT NULL
          AND index IS NOT NULL
          AND deleted_at IS NULL
    """)

    # ── 12. Performance indexes (WHERE deleted_at IS NULL = partial indexes) ──
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_exam_active
        ON questions(exam) WHERE deleted_at IS NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_section_active
        ON questions(section) WHERE deleted_at IS NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_topic_active
        ON questions(topic) WHERE deleted_at IS NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_difficulty_active
        ON questions(difficulty) WHERE deleted_at IS NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_world_key_active
        ON questions(world_key) WHERE deleted_at IS NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_is_active
        ON questions(is_active) WHERE deleted_at IS NULL
    """)
    # Full-text search index on question_text
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_questions_fts
        ON questions USING gin(to_tsvector('english', question_text))
        WHERE deleted_at IS NULL
    """)


def downgrade():
    # Reverse in reverse order

    # Drop performance indexes
    op.execute('DROP INDEX IF EXISTS idx_questions_fts')
    op.execute('DROP INDEX IF EXISTS idx_questions_is_active')
    op.execute('DROP INDEX IF EXISTS idx_questions_world_key_active')
    op.execute('DROP INDEX IF EXISTS idx_questions_difficulty_active')
    op.execute('DROP INDEX IF EXISTS idx_questions_topic_active')
    op.execute('DROP INDEX IF EXISTS idx_questions_section_active')
    op.execute('DROP INDEX IF EXISTS idx_questions_exam_active')

    # Drop partial unique index
    op.execute('DROP INDEX IF EXISTS uq_question_exam_world_index_partial')

    # Restore world_key and index as NOT NULL
    # (rows with NULL world_key would block this — downgrade assumes clean state)
    op.alter_column('questions', 'index',     nullable=False)
    op.alter_column('questions', 'world_key', nullable=False)

    # Restore original unique constraint
    op.create_unique_constraint(
        'uq_question_exam_world_index',
        'questions',
        ['exam', 'world_key', 'index']
    )

    # Drop deleted_by_admin_id
    op.drop_column('questions', 'deleted_by_admin_id')

    # Drop qid
    op.drop_index('questions_qid_unique_idx', table_name='questions')
    op.drop_column('questions', 'qid')

    # Drop section
    op.drop_column('questions', 'section')

    # Restore explanation from hint
    op.add_column('questions', sa.Column('explanation', sa.Text(), nullable=True))
    op.execute('UPDATE questions SET explanation = hint WHERE hint IS NOT NULL')
    op.drop_column('questions', 'hint')
