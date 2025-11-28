from functools import wraps
from fastapi import HTTPException, status
from ..models.user import UserRole

# Define permissions for each action
PERMISSIONS = {
    # Feature actions
    "create_feature": [UserRole.REQUESTER, UserRole.PM, UserRole.ADMIN],
    "view_feature": [UserRole.REQUESTER, UserRole.PM, UserRole.DEVELOPER, UserRole.QA, UserRole.ADMIN, UserRole.APPROVER],
    "update_feature": [UserRole.PM, UserRole.ADMIN],
    "delete_feature": [UserRole.ADMIN],
    
    # Status transitions
    "transition_to_under_review": [UserRole.PM, UserRole.ADMIN, UserRole.APPROVER],
    "transition_to_approved": [UserRole.PM, UserRole.ADMIN, UserRole.APPROVER],
    "transition_to_rejected": [UserRole.PM, UserRole.ADMIN, UserRole.APPROVER],
    "transition_to_in_development": [UserRole.PM, UserRole.DEVELOPER, UserRole.ADMIN],
    "transition_to_in_qa": [UserRole.DEVELOPER, UserRole.PM, UserRole.ADMIN],
    "transition_to_completed": [UserRole.QA, UserRole.PM, UserRole.ADMIN],
    "transition_to_deployed": [UserRole.PM, UserRole.ADMIN],
    
    # Assignment
    "assign_feature": [UserRole.PM, UserRole.ADMIN],
    
    # Comments
    "add_comment": [UserRole.REQUESTER, UserRole.PM, UserRole.DEVELOPER, UserRole.QA, UserRole.ADMIN, UserRole.APPROVER],
    
    # Attachments
    "upload_attachment": [UserRole.REQUESTER, UserRole.PM, UserRole.DEVELOPER, UserRole.QA, UserRole.ADMIN],
    "delete_attachment": [UserRole.PM, UserRole.ADMIN],
    
    # AI
    "use_ai": [UserRole.PM, UserRole.DEVELOPER, UserRole.ADMIN],
    
    # User management (admins from env can grant approver role)
    "manage_users": [UserRole.ADMIN],
    "grant_approver": [],  # Controlled by ADMIN_EMAILS in config
}

def check_permission(user, action: str) -> bool:
    """Check if user has permission to perform action"""
    allowed_roles = PERMISSIONS.get(action, [])
    return user.role in [r.value for r in allowed_roles]

def require_permission(action: str):
    """Dependency to require permission for an action"""
    def permission_checker(current_user):
        if not check_permission(current_user, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to {action.replace('_', ' ')}"
            )
        return current_user
    return permission_checker

def require_role(*roles: UserRole):
    """Dependency to require specific role(s)"""
    def role_checker(current_user):
        if current_user.role not in [r.value for r in roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker
