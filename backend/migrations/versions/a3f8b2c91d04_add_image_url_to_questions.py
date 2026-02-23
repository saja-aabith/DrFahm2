"""add image_url to questions

Revision ID: a3f8b2c91d04
Revises: 716822b92783
Create Date: 2026-02-23 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a3f8b2c91d04'
down_revision = '716822b92783'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('questions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('image_url', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('questions', schema=None) as batch_op:
        batch_op.drop_column('image_url')
