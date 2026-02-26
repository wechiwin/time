"""fix unique constraint to include user_id in HoldingAnalyticsSnapshot

Revision ID: 006_fix_has_unique
Revises: 005_benchmark_id_user
Create Date: 2026-02-26

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '006_fix_has_unique'
down_revision: Union[str, Sequence[str], None] = '005_benchmark_id_user'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Fix unique constraint to include user_id."""
    # Drop old constraint
    op.drop_constraint('uq_ho_date_window', 'holding_analytics_snapshot', type_='unique')
    # Create new constraint with user_id
    op.create_unique_constraint(
        'uq_user_ho_date_window',
        'holding_analytics_snapshot',
        ['user_id', 'ho_id', 'snapshot_date', 'window_key']
    )


def downgrade() -> None:
    """Revert to old unique constraint."""
    op.drop_constraint('uq_user_ho_date_window', 'holding_analytics_snapshot', type_='unique')
    op.create_unique_constraint(
        'uq_ho_date_window',
        'holding_analytics_snapshot',
        ['ho_id', 'snapshot_date', 'window_key']
    )
