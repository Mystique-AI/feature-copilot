from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from ..models.feature import FeatureStatus, Priority

# Comment Schemas
class CommentBase(BaseModel):
    content: str

class CommentCreate(CommentBase):
    pass

class Comment(CommentBase):
    id: int
    created_at: datetime
    feature_id: int
    user_id: int
    user_name: Optional[str] = None

    class Config:
        from_attributes = True

# Feature Request Schemas
class FeatureRequestBase(BaseModel):
    title: str
    description: str
    use_case: Optional[str] = None
    priority: Priority = Priority.MEDIUM
    tags: Optional[List[str]] = []

class FeatureRequestCreate(FeatureRequestBase):
    pass

class FeatureRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    use_case: Optional[str] = None
    priority: Optional[Priority] = None
    status: Optional[FeatureStatus] = None
    assigned_to_id: Optional[int] = None
    tags: Optional[List[str]] = None
    rejection_reason: Optional[str] = None
    approval_notes: Optional[str] = None
    acceptance_criteria: Optional[str] = None

class StatusTransition(BaseModel):
    status: FeatureStatus
    reason: Optional[str] = None  # For rejection reason or approval notes

class FeatureRequest(FeatureRequestBase):
    id: int
    status: FeatureStatus
    created_at: datetime
    updated_at: datetime
    requester_id: int
    assigned_to_id: Optional[int] = None
    rejection_reason: Optional[str] = None
    approval_notes: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    requester_name: Optional[str] = None
    assigned_to_name: Optional[str] = None

    class Config:
        from_attributes = True

class FeatureRequestWithComments(FeatureRequest):
    comments: List[Comment] = []
