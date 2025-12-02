"""
Knowledge Base Model

Stores metadata for knowledge base documents.
Actual JSON/Markdown files are stored in /uploads/knowledge/ directory.
Embeddings are stored separately with just the vector and reference path.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from ..core.database import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Display name, e.g., "Backend Architecture"
    domain = Column(String, nullable=False)  # e.g., "backend", "frontend", "devops", "database"
    description = Column(Text, nullable=True)  # Brief description of what this KB covers
    
    # File references (stored in /uploads/knowledge/)
    json_filename = Column(String, nullable=True)  # Structured JSON file (optional, for AI-processed uploads)
    markdown_filename = Column(String, nullable=False)  # Markdown file (primary content storage)
    original_filename = Column(String, nullable=False)  # Original uploaded file name
    
    # Metadata
    version = Column(Integer, default=1)  # Version number for tracking updates
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # User who created/last updated
    created_by_id = Column(Integer, ForeignKey("users.id"))
    updated_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
    embeddings = relationship("KnowledgeEmbedding", back_populates="knowledge_base", cascade="all, delete-orphan")


class KnowledgeEmbedding(Base):
    """
    Stores embeddings for knowledge base sections.
    Only stores: embedding vector + reference path to JSON content.
    Actual text content is retrieved from JSON file when needed.
    """
    __tablename__ = "knowledge_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Reference to knowledge base
    kb_id = Column(Integer, ForeignKey("knowledge_bases.id", ondelete="CASCADE"), nullable=False)
    
    # Section reference (path in JSON structure, e.g., "1.2.3")
    section_address = Column(String, nullable=False)
    
    # Section title for quick display without loading JSON
    section_title = Column(String, nullable=False)
    
    # The embedding vector (1024 dimensions - both OpenAI and GenAI support custom dims)
    embedding = Column(Vector(1024), nullable=False)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    knowledge_base = relationship("KnowledgeBase", back_populates="embeddings")
    
    # Index for vector similarity search
    __table_args__ = (
        Index('ix_knowledge_embeddings_kb_id', 'kb_id'),
    )
