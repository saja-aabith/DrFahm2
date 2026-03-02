"""add explanation column to questions

Revision ID: a3f1c2d4e5b6
Revises: 61ba8c4b73f2
Create Date: 2026-03-03

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a3f1c2d4e5b6'
down_revision = '61ba8c4b73f2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('questions', sa.Column('explanation', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('questions', 'explanation')