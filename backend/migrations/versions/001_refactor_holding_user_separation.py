"""refactor: separate holding and user_holding tables for multi-tenant architecture

Revision ID: 001_refactor_holding_user
Revises:
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_refactor_holding_user'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""

    # Step 1: Create user_holding table
    op.create_table(
        'user_holding',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('ho_id', sa.Integer(), nullable=False),
        sa.Column('ho_status', sa.String(length=50), nullable=False),
        sa.Column('ho_nickname', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('current_timestamp'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('current_timestamp'), onupdate=sa.text('current_timestamp'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user_setting.id']),
        sa.ForeignKeyConstraint(['ho_id'], ['holding.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'ho_id', name='uq_user_holding')
    )
    op.create_index('idx_user_holding_status', 'user_holding', ['user_id', 'ho_status'], unique=False)

    # Step 2: Migrate data from holding to user_holding
    op.execute("""
        INSERT INTO user_holding (user_id, ho_id, ho_status, ho_nickname, created_at, updated_at)
        SELECT user_id, id, ho_status, ho_nickname, created_at, updated_at
        FROM holding
        """)

    # Step 3: Add unique constraint on holding.ho_code
    # Note: Skip this step if there are duplicates (ho_code is not unique yet)
    # In a real migration, you would need to handle deduplication first

    # Step 4: Use batch operations to drop columns from holding
    # Note: Skipping deduplication for now - needs manual handling
    with op.batch_alter_table('holding') as batch:
        batch.drop_column('user_id')
        batch.drop_column('ho_status')
        batch.drop_column('ho_nickname')

    # Step 5: Drop user_id from fund_detail table using raw SQL
    # Use raw SQL to handle foreign key constraint
    op.execute("ALTER TABLE fund_detail DROP CONSTRAINT IF EXISTS fund_detail_user_id_fkey")
    op.execute("ALTER TABLE fund_detail DROP COLUMN IF EXISTS user_id")


def downgrade() -> None:
    """Downgrade schema."""

    # Step 1: Use raw SQL to add user_id back to fund_detail
    op.execute("""
        ALTER TABLE fund_detail ADD COLUMN IF NOT EXISTS user_id INTEGER NOT NULL
        ALTER TABLE fund_detail ADD CONSTRAINT IF NOT EXISTS fund_detail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES user_setting(id)
    """)

    # Step 2: Use batch operations for holding
    with op.batch_alter_table('holding') as batch:
        batch.add_column(sa.Column('user_id', sa.Integer(), nullable=False))
        batch.add_column(sa.Column('ho_status', sa.String(length=50), nullable=False))
        batch.add_column(sa.Column('ho_nickname', sa.String(length=100), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key('holding_user_id_fkey', 'holding', 'user_setting', ['user_id'], ['id'])

    # Step 3: Migrate data back from user_holding to holding
    op.execute("""
        UPDATE holding
        SET user_id = uh.user_id,
            ho_status = uh.ho_status,
            ho_nickname = uh.ho_nickname
        FROM user_holding uh
        WHERE holding.id = uh.ho_id
        """)

    # Step 4: Drop unique constraint from ho_code
    try:
        op.drop_constraint('uq_holding_ho_code', 'holding', type_='unique')
    except Exception:
        pass

    # Step 5: Drop user_holding table
    op.drop_index('idx_user_holding_status', table_name='user_holding')
    op.drop_table('user_holding')
