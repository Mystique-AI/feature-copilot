"""Update embedding column to 1024 dimensions

Revision ID: g7b0c4d5e6f3
Revises: f6a9b3c4d5e2
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = 'g7b0c4d5e6f3'
down_revision = 'f6a9b3c4d5e2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop existing embeddings (they need to be regenerated with new dimensions)
    op.execute('DELETE FROM knowledge_embeddings')
    
    # Drop old vector index
    op.execute('DROP INDEX IF EXISTS ix_knowledge_embeddings_vector')
    
    # Alter column to new dimensions
    op.execute('ALTER TABLE knowledge_embeddings ALTER COLUMN embedding TYPE vector(1024)')
    
    # Recreate HNSW index for 1024 dimensions
    op.execute('''
        CREATE INDEX ix_knowledge_embeddings_vector 
        ON knowledge_embeddings 
        USING hnsw (embedding vector_cosine_ops)
    ''')


def downgrade() -> None:
    # Drop existing embeddings
    op.execute('DELETE FROM knowledge_embeddings')
    
    # Drop vector index
    op.execute('DROP INDEX IF EXISTS ix_knowledge_embeddings_vector')
    
    # Alter column back to 1536 dimensions
    op.execute('ALTER TABLE knowledge_embeddings ALTER COLUMN embedding TYPE vector(1536)')
    
    # Recreate index
    op.execute('''
        CREATE INDEX ix_knowledge_embeddings_vector 
        ON knowledge_embeddings 
        USING hnsw (embedding vector_cosine_ops)
    ''')
