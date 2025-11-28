from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from ..core.database import Base
import enum
from datetime import datetime

class FeatureStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_DEVELOPMENT = "in_development"
    IN_QA = "in_qa"
    COMPLETED = "completed"
    DEPLOYED = "deployed"

class Priority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class FeatureRequest(Base):
    __tablename__ = "feature_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text)
    use_case = Column(Text, nullable=True)
    status = Column(String, default=FeatureStatus.SUBMITTED)
    priority = Column(String, default=Priority.MEDIUM)
    tags = Column(JSON, default=list)  # Store as JSON array
    
    # PM fields
    rejection_reason = Column(Text, nullable=True)
    approval_notes = Column(Text, nullable=True)
    acceptance_criteria = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requester_id = Column(Integer, ForeignKey("users.id"))
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    comments = relationship("Comment", back_populates="feature", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="feature", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    feature_id = Column(Integer, ForeignKey("feature_requests.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    feature = relationship("FeatureRequest", back_populates="comments")
    user = relationship("User")


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    original_filename = Column(String)
    content_type = Column(String)
    size = Column(Integer)  # Size in bytes
    created_at = Column(DateTime, default=datetime.utcnow)
    
    feature_id = Column(Integer, ForeignKey("feature_requests.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    feature = relationship("FeatureRequest", back_populates="attachments")
    user = relationship("User")
