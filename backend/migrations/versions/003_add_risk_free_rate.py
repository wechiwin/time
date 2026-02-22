"""add risk_free_rate column to user_setting table

Revision ID: 003_add_risk_free_rate
Revises: 002_async_task_log_nullable
Create Date: 2026-02-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_add_risk_free_rate'
down_revision: Union[str, Sequence[str], None] = '002_async_task_log_nullable'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add risk_free_rate column to user_setting table."""
    with op.batch_alter_table('user_setting') as batch:
        batch.add_column(
            sa.Column('risk_free_rate', sa.Numeric(6, 5), nullable=False, server_default='0.02000')
        )


def downgrade() -> None:
    """Remove risk_free_rate column from user_setting table."""
    with op.batch_alter_table('user_setting') as batch:
        batch.drop_column('risk_free_rate')
