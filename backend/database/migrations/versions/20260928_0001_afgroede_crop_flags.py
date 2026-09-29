"""Add main crop and six-percent flags to afgroede.

Revision ID: 20260928_0001
Revises: 20260925_0001
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260928_0001"
down_revision: str | None = "20260925_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "afgroede",
        sa.Column(
            "er_hovedafgrode", sa.Boolean(), nullable=False, server_default=sa.false(),
        ),
    )
    op.add_column(
        "afgroede",
        sa.Column(
            "grund6procent", sa.Boolean(), nullable=False, server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("afgroede", "grund6procent")
    op.drop_column("afgroede", "er_hovedafgrode")
