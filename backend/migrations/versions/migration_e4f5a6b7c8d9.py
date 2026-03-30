"""L1 billing schema: stripe_events, PlanType enum values, entitlement cols

Revision ID: e4f5a6b7c8d9
Revises: migration_d3e4f5a6b7c8
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5a6b7c8d9'
down_revision = 'migration_d3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Add new PlanType enum values to Postgres ───────────────────────────
    # Postgres ALTER TYPE ... ADD VALUE is safe and irreversible.
    # We check existence first so reruns don't fail.
    existing_plan_types = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT enumlabel FROM pg_enum e "
                "JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname = 'plantype'"
            )
        )
    }

    new_plan_type_values = [
        'org_basic',
        'org_premium',
        'org_standard',
        'org_volume',
    ]
    for val in new_plan_type_values:
        if val not in existing_plan_types:
            op.execute(sa.text(f"ALTER TYPE plantype ADD VALUE '{val}'"))

    # ── 2. Add stripe_session_id to entitlements (if not already present) ─────
    existing_ent_cols = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'entitlements'"
            )
        )
    }

    if 'stripe_session_id' not in existing_ent_cols:
        op.add_column(
            'entitlements',
            sa.Column('stripe_session_id', sa.String(255), nullable=True),
        )
        op.create_unique_constraint(
            'uq_entitlements_stripe_session_id',
            'entitlements',
            ['stripe_session_id'],
        )

    # ── 3. Add student_count to entitlements (school payments) ────────────────
    if 'student_count' not in existing_ent_cols:
        op.add_column(
            'entitlements',
            sa.Column('student_count', sa.Integer(), nullable=True),
        )

    # ── 4. Add granted_by_admin_id to entitlements ────────────────────────────
    if 'granted_by_admin_id' not in existing_ent_cols:
        op.add_column(
            'entitlements',
            sa.Column(
                'granted_by_admin_id',
                sa.Integer(),
                sa.ForeignKey('users.id'),
                nullable=True,
            ),
        )

    # ── 5. Create stripe_events table ─────────────────────────────────────────
    existing_tables = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public'"
            )
        )
    }

    if 'stripe_events' not in existing_tables:
        op.create_table(
            'stripe_events',
            sa.Column('id',              sa.Integer(),     primary_key=True),
            sa.Column('stripe_event_id', sa.String(255),   nullable=False),
            sa.Column('event_type',      sa.String(100),   nullable=False),
            sa.Column('status',          sa.String(20),    nullable=False,
                      server_default='pending'),
            sa.Column('payload',         sa.Text(),        nullable=True),
            sa.Column('error_message',   sa.Text(),        nullable=True),
            sa.Column('received_at',     sa.DateTime(timezone=True), nullable=False,
                      server_default=sa.func.now()),
            sa.Column('processed_at',    sa.DateTime(timezone=True), nullable=True),
        )
        op.create_unique_constraint(
            'uq_stripe_events_event_id',
            'stripe_events',
            ['stripe_event_id'],
        )
        op.create_index(
            'ix_stripe_events_stripe_event_id',
            'stripe_events',
            ['stripe_event_id'],
        )


def downgrade():
    # stripe_events is safe to drop; enum value removal requires manual Postgres work
    conn = op.get_bind()
    existing_tables = {
        row[0] for row in conn.execute(
            sa.text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
        )
    }
    if 'stripe_events' in existing_tables:
        op.drop_table('stripe_events')

    # Note: Postgres does not support removing enum values.
    # PlanType values added in upgrade() cannot be reversed without dropping the type.
    # Downgrade is intentionally partial — safe for development, not for production rollback.
