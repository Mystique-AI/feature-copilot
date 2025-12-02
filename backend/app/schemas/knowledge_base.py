"""
Knowledge Base Schemas

Pydantic schemas for Knowledge Base API requests and responses.
"""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


# Domain options for knowledge bases
VALID_DOMAINS = ["backend", "frontend", "database", "devops", "api", "mobile", "infrastructure", "ai", "general"]


class KnowledgeSection(BaseModel):
    """Individual section in the knowledge base structure"""
    id: str  # e.g., "1", "1.2", "1.2.3"
    title: str
    content: str
    subsections: Optional[List["KnowledgeSection"]] = []


class KnowledgeStructure(BaseModel):
    """Full knowledge base structure stored in JSON file"""
    domain: str
    name: str
    description: Optional[str] = None
    sections: List[KnowledgeSection]
    metadata: Optional[dict] = {}


class KnowledgeBaseCreate(BaseModel):
    """Schema for creating a new knowledge base (metadata only, file uploaded separately)"""
    name: str
    domain: str
    description: Optional[str] = None


class KnowledgeBaseUpdate(BaseModel):
    """Schema for updating knowledge base metadata"""
    name: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None


class KnowledgeBaseResponse(BaseModel):
    """Response schema for knowledge base metadata"""
    id: int
    name: str
    domain: str
    description: Optional[str]
    original_filename: str
    version: int
    created_at: datetime
    updated_at: datetime
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class KnowledgeBaseWithContent(KnowledgeBaseResponse):
    """Response schema including full content"""
    markdown_content: str
    structure: Optional[KnowledgeStructure] = None  # None for KBs without JSON structure


class SectionQuery(BaseModel):
    """Query for retrieving a specific section by address"""
    address: str  # e.g., "1.2.3"


class SectionResponse(BaseModel):
    """Response for a specific section"""
    address: str
    title: str
    content: str
    parent_address: Optional[str] = None
    children: Optional[List[str]] = []  # List of child addresses


# Allow recursive model
KnowledgeSection.model_rebuild()
