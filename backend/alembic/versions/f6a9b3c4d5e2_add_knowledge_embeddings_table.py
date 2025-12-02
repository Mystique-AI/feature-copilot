"""Add knowledge_embeddings table with pgvector

Revision ID: f6a9b3c4d5e2
Revises: e5f8a2c3d4b1
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = 'f6a9b3c4d5e2'
down_revision = 'e5f8a2c3d4b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension (Neon DB has this pre-installed)
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')
    
    # Create knowledge_embeddings table
    op.create_table(
        'knowledge_embeddings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('kb_id', sa.Integer(), nullable=False),
        sa.Column('section_address', sa.String(), nullable=False),
        sa.Column('section_title', sa.String(), nullable=False),
        sa.Column('embedding', Vector(1024), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['kb_id'], ['knowledge_bases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_knowledge_embeddings_id'), 'knowledge_embeddings', ['id'], unique=False)
    op.create_index(op.f('ix_knowledge_embeddings_kb_id'), 'knowledge_embeddings', ['kb_id'], unique=False)
    
    # Create HNSW index for fast vector similarity search
    op.execute('''
        CREATE INDEX ix_knowledge_embeddings_vector 
        ON knowledge_embeddings 
        USING hnsw (embedding vector_cosine_ops)
    ''')


def downgrade() -> None:
    op.drop_index('ix_knowledge_embeddings_vector', table_name='knowledge_embeddings')
    op.drop_index(op.f('ix_knowledge_embeddings_kb_id'), table_name='knowledge_embeddings')
    op.drop_index(op.f('ix_knowledge_embeddings_id'), table_name='knowledge_embeddings')
    op.drop_table('knowledge_embeddings')
