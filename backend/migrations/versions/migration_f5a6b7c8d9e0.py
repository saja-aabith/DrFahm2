"""Hotfix: add student_count and granted_by_admin_id to entitlements

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'f5a6b7c8d9e0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    existing_cols = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'entitlements'"
            )
        )
    }

    if 'student_count' not in existing_cols:
        op.add_column(
            'entitlements',
            sa.Column('student_count', sa.Integer(), nullable=True),
        )

    if 'granted_by_admin_id' not in existing_cols:
        op.add_column(
            'entitlements',
            sa.Column('granted_by_admin_id', sa.Integer(), nullable=True),
        )


def downgrade():
    conn = op.get_bind()
    existing_cols = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'entitlements'"
            )
        )
    }
    if 'student_count' in existing_cols:
        op.drop_column('entitlements', 'student_count')
    if 'granted_by_admin_id' in existing_cols:
        op.drop_column('entitlements', 'granted_by_admin_id')
