from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..core import database, security
from ..core.config import settings
from ..core.permissions import require_role
from ..models import user as models
from ..models.user import UserRole
from ..schemas import user as schemas
from .auth import get_current_user

router = APIRouter()

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/", response_model=List[schemas.User])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all users, optionally filtered by role"""
    query = db.query(models.User).filter(models.User.is_active == True)
    if role:
        query = query.filter(models.User.role == role)
    return query.all()

@router.get("/developers", response_model=List[schemas.User])
def list_developers(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """List all developers (for assignment dropdown)"""
    return db.query(models.User).filter(
        models.User.is_active == True,
        models.User.role.in_([UserRole.DEVELOPER.value, UserRole.PM.value, UserRole.ADMIN.value])
    ).all()

@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_user)):
    # Add is_env_admin flag to response
    user_data = schemas.User.model_validate(current_user)
    user_data.is_env_admin = settings.is_admin_email(current_user.email)
    return user_data

@router.put("/me", response_model=schemas.User)
def update_users_me(
    user_update: schemas.UserUpdate, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    
    db.commit()
    db.refresh(current_user)
    return current_user

@router.put("/{user_id}/role", response_model=schemas.User)
def update_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Update a user's role.
    
    - ADMIN role users can change any role except APPROVER
    - Only users with email in ADMIN_EMAILS env can grant APPROVER role
    """
    is_env_admin = settings.is_admin_email(current_user.email)
    is_role_admin = current_user.role == UserRole.ADMIN.value
    
    # Check if user has any admin privileges
    if not is_env_admin and not is_role_admin:
        raise HTTPException(status_code=403, detail="Only admins can change user roles")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if role not in [r.value for r in UserRole]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Only env admins can grant/revoke APPROVER role
    if role == UserRole.APPROVER.value and not is_env_admin:
        raise HTTPException(
            status_code=403, 
            detail="Only designated admins (from ADMIN_EMAILS) can grant the approver role"
        )
    
    # Prevent removing approver role unless env admin
    if user.role == UserRole.APPROVER.value and role != UserRole.APPROVER.value and not is_env_admin:
        raise HTTPException(
            status_code=403,
            detail="Only designated admins (from ADMIN_EMAILS) can revoke the approver role"
        )
    
    user.role = role
    db.commit()
    db.refresh(user)
    return user
