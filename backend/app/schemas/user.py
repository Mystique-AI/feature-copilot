from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from ..models.user import UserRole

ALLOWED_DOMAINS = ["mystiqueai.com", "konsultera.in"]

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.REQUESTER
    is_active: Optional[bool] = True

    @field_validator('email')
    @classmethod
    def validate_email_domain(cls, v):
        domain = v.split('@')[1]
        if domain not in ALLOWED_DOMAINS:
            raise ValueError(f'Email domain must be one of: {", ".join(ALLOWED_DOMAINS)}')
        return v

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None

class User(UserBase):
    id: int
    is_env_admin: Optional[bool] = False  # True if user email is in ADMIN_EMAILS

    class Config:
        from_attributes = True
