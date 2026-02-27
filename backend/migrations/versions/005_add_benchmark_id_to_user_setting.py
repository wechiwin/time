"""add benchmark_id column to user_setting table

Revision ID: 005_benchmark_id_user
Revises: 004_hos_reinvest_dividend
Create Date: 2026-02-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_benchmark_id_user'
down_revision: Union[str, Sequence[str], None] = '004_hos_reinvest_dividend'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add benchmark_id column to user_setting table."""
    with op.batch_alter_table('user_setting') as batch:
        batch.add_column(
            sa.Column('benchmark_id', sa.Integer, sa.ForeignKey('benchmark.id'), nullable=True)
        )


def downgrade() -> None:
    """Remove benchmark_id column from user_setting table."""
    with op.batch_alter_table('user_setting') as batch:
        batch.drop_column('benchmark_id')
