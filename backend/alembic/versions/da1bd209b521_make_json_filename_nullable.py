"""make_json_filename_nullable

Revision ID: da1bd209b521
Revises: g7b0c4d5e6f3
Create Date: 2025-12-02 15:09:04.666258

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da1bd209b521'
down_revision: Union[str, None] = 'g7b0c4d5e6f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make json_filename nullable (no longer required for direct MD uploads)
    op.alter_column('knowledge_bases', 'json_filename',
               existing_type=sa.VARCHAR(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('knowledge_bases', 'json_filename',
               existing_type=sa.VARCHAR(),
               nullable=False)
