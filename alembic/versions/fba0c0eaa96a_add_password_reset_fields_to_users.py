"""Add password reset fields to users

Revision ID: fba0c0eaa96a
Revises: 
Create Date: 2026-03-24 16:55:41.860994

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fba0c0eaa96a'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('reset_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('reset_token_expiry', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'reset_token_expiry')
    op.drop_column('users', 'reset_token')
