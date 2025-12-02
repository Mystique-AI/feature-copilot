from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel
import os
import uuid
import aiofiles
from ..core import database
from ..core.prompts import FEATURE_PROMPTS, get_prompt
from ..models import feature as models
from ..models import user as user_models
from ..schemas import feature as schemas
from .auth import get_current_user
from ..services.ai_service import ai_service
from .knowledge_base import search_knowledge_base_internal

router = APIRouter()

# AI Request Schema
class AIRequest(BaseModel):
    action: str
    context: str
    complexity: str = "low"  # low, medium, high

@router.post("/ai-assist")
async def ai_assist(
    request: AIRequest, 
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """
    AI-assisted actions for feature requests.
    For task generation, automatically fetches relevant knowledge base documentation.
    """
    kb_context = ""
    
    # For task generation and feature creation, fetch relevant KB documentation first
    kb_enabled_actions = ["generate_tasks", "generate_feature"]
    kb_results = []
    
    if request.action in kb_enabled_actions:
        print(f"[AI Assist] Fetching KB context for {request.action}...")
        kb_results = await search_knowledge_base_internal(
            query=request.context,
            db=db,
            limit=5,
            min_score=0.20  # 70% similarity cutoff
        )
        
        if kb_results:
            print(f"[AI Assist] Found {len(kb_results)} relevant KB documents")
            kb_sections = []
            for kb in kb_results:
                kb_sections.append(
                    f"### {kb['kb_name']} (Domain: {kb['domain']}, Score: {kb['similarity_score']})\n"
                    f"{kb['content'][:2000]}"  # Limit content to avoid token overflow
                )
            
            if request.action == "generate_tasks":
                kb_context = (
                    "\n\n---\n"
                    "## Relevant System Documentation\n"
                    "The following documentation describes the existing system architecture and components. "
                    "Use this context to create tasks that align with the current implementation:\n\n"
                    + "\n\n".join(kb_sections)
                )
            else:  # generate_feature
                kb_context = (
                    "\n\n---\n"
                    "## Existing System Context\n"
                    "The following documentation describes the existing system. "
                    "Use this to ensure the feature description references relevant existing components and integrates well:\n\n"
                    + "\n\n".join(kb_sections)
                )
        else:
            print("[AI Assist] No KB documents found above 70% threshold")
    
    # Build the prompt
    if request.action in FEATURE_PROMPTS:
        base_prompt = FEATURE_PROMPTS[request.action].format(context=request.context)
        # Append KB context if available
        if kb_context:
            prompt = base_prompt + kb_context
        else:
            prompt = base_prompt
    else:
        # Fallback for custom actions (like 'generate' for feature creation)
        prompt = request.context
    
    response = await ai_service.generate_text(prompt, request.complexity)
    
    # Include KB metadata in response if context was used
    result = {"result": response}
    if kb_context and request.action in kb_enabled_actions:
        result["kb_context_used"] = [
            {"name": kb["kb_name"], "domain": kb["domain"], "score": kb["similarity_score"]}
            for kb in kb_results
        ]
    
    return result

@router.post("/", response_model=schemas.FeatureRequest)
def create_feature(
    feature: schemas.FeatureRequestCreate, 
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    feature_data = feature.model_dump()
    db_feature = models.FeatureRequest(**feature_data, requester_id=current_user.id)
    db.add(db_feature)
    db.commit()
    db.refresh(db_feature)
    return _enrich_feature(db_feature)

def _enrich_feature(feature: models.FeatureRequest) -> dict:
    """Add requester_name and assigned_to_name to feature"""
    data = {
        "id": feature.id,
        "title": feature.title,
        "description": feature.description,
        "use_case": feature.use_case,
        "status": feature.status,
        "priority": feature.priority,
        "tags": feature.tags or [],
        "rejection_reason": feature.rejection_reason,
        "approval_notes": feature.approval_notes,
        "acceptance_criteria": feature.acceptance_criteria,
        "created_at": feature.created_at,
        "updated_at": feature.updated_at,
        "requester_id": feature.requester_id,
        "assigned_to_id": feature.assigned_to_id,
        "requester_name": feature.requester.full_name if feature.requester else None,
        "assigned_to_name": feature.assigned_to.full_name if feature.assigned_to else None,
    }
    return data

@router.get("/", response_model=List[schemas.FeatureRequest])
def read_features(
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    query = db.query(models.FeatureRequest)
    
    # Apply filters
    if status:
        query = query.filter(models.FeatureRequest.status == status)
    if priority:
        query = query.filter(models.FeatureRequest.priority == priority)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                models.FeatureRequest.title.ilike(search_term),
                models.FeatureRequest.description.ilike(search_term)
            )
        )
    
    features = query.order_by(models.FeatureRequest.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich_feature(f) for f in features]

@router.get("/{feature_id}", response_model=schemas.FeatureRequestWithComments)
def read_feature(
    feature_id: int, 
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    enriched = _enrich_feature(feature)
    enriched["comments"] = [
        {
            "id": c.id,
            "content": c.content,
            "created_at": c.created_at,
            "feature_id": c.feature_id,
            "user_id": c.user_id,
            "user_name": c.user.full_name if c.user else None
        }
        for c in feature.comments
    ]
    return enriched

@router.put("/{feature_id}", response_model=schemas.FeatureRequest)
def update_feature(
    feature_id: int, 
    feature_update: schemas.FeatureRequestUpdate, 
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    db_feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if db_feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    update_data = feature_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_feature, key, value)

    db.commit()
    db.refresh(db_feature)
    return _enrich_feature(db_feature)

@router.post("/{feature_id}/transition", response_model=schemas.FeatureRequest)
def transition_status(
    feature_id: int,
    transition: schemas.StatusTransition,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Transition feature to a new status with optional reason"""
    db_feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if db_feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    db_feature.status = transition.status
    
    if transition.status == models.FeatureStatus.REJECTED and transition.reason:
        db_feature.rejection_reason = transition.reason
    elif transition.status == models.FeatureStatus.APPROVED and transition.reason:
        db_feature.approval_notes = transition.reason
    
    db.commit()
    db.refresh(db_feature)
    return _enrich_feature(db_feature)

@router.post("/{feature_id}/assign", response_model=schemas.FeatureRequest)
def assign_feature(
    feature_id: int,
    user_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    """Assign feature to a developer"""
    db_feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if db_feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    # Verify user exists
    user = db.query(user_models.User).filter(user_models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_feature.assigned_to_id = user_id
    db.commit()
    db.refresh(db_feature)
    return _enrich_feature(db_feature)

# Comments endpoints
@router.post("/{feature_id}/comments", response_model=schemas.Comment)
def add_comment(
    feature_id: int,
    comment: schemas.CommentCreate,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    db_feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if db_feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    db_comment = models.Comment(
        content=comment.content,
        feature_id=feature_id,
        user_id=current_user.id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    
    return {
        "id": db_comment.id,
        "content": db_comment.content,
        "created_at": db_comment.created_at,
        "feature_id": db_comment.feature_id,
        "user_id": db_comment.user_id,
        "user_name": current_user.full_name
    }

@router.get("/{feature_id}/comments", response_model=List[schemas.Comment])
def get_comments(
    feature_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    comments = db.query(models.Comment).filter(models.Comment.feature_id == feature_id).order_by(models.Comment.created_at.desc()).all()
    return [
        {
            "id": c.id,
            "content": c.content,
            "created_at": c.created_at,
            "feature_id": c.feature_id,
            "user_id": c.user_id,
            "user_name": c.user.full_name if c.user else None
        }
        for c in comments
    ]

# Attachments endpoints
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/{feature_id}/attachments")
async def upload_attachment(
    feature_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    db_feature = db.query(models.FeatureRequest).filter(models.FeatureRequest.id == feature_id).first()
    if db_feature is None:
        raise HTTPException(status_code=404, detail="Feature not found")
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    # Create attachment record
    db_attachment = models.Attachment(
        filename=unique_filename,
        original_filename=file.filename,
        content_type=file.content_type,
        size=len(content),
        feature_id=feature_id,
        user_id=current_user.id
    )
    db.add(db_attachment)
    db.commit()
    db.refresh(db_attachment)
    
    return {
        "id": db_attachment.id,
        "filename": db_attachment.original_filename,
        "content_type": db_attachment.content_type,
        "size": db_attachment.size,
        "created_at": db_attachment.created_at,
        "user_name": current_user.full_name
    }

@router.get("/{feature_id}/attachments")
def get_attachments(
    feature_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    attachments = db.query(models.Attachment).filter(models.Attachment.feature_id == feature_id).order_by(models.Attachment.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "filename": a.original_filename,
            "content_type": a.content_type,
            "size": a.size,
            "created_at": a.created_at,
            "user_name": a.user.full_name if a.user else None
        }
        for a in attachments
    ]

@router.get("/attachments/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    file_path = os.path.join(UPLOAD_DIR, attachment.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        file_path,
        filename=attachment.original_filename,
        media_type=attachment.content_type
    )

@router.delete("/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(database.get_db),
    current_user: user_models.User = Depends(get_current_user)
):
    attachment = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if attachment is None:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Delete file
    file_path = os.path.join(UPLOAD_DIR, attachment.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete record
    db.delete(attachment)
    db.commit()
    
    return {"message": "Attachment deleted"}
