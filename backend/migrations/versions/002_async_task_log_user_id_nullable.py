"""make async_task_log user_id nullable for system tasks

Revision ID: 002_async_task_log_nullable
Revises: 001_refactor_holding_user
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_async_task_log_nullable'
down_revision: Union[str, Sequence[str], None] = '001_refactor_holding_user'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make async_task_log.user_id nullable for system tasks."""
    with op.batch_alter_table('async_task_log') as batch:
        batch.alter_column('user_id', nullable=True)


def downgrade() -> None:
    """Revert async_task_log.user_id to non-nullable."""
    # First, delete any system tasks (user_id is NULL) before making it non-nullable
    op.execute("DELETE FROM async_task_log WHERE user_id IS NULL")

    with op.batch_alter_table('async_task_log') as batch:
        batch.alter_column('user_id', nullable=False)
