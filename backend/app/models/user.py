from sqlalchemy import Column, Integer, String, Boolean, Enum
from ..core.database import Base
import enum

class UserRole(str, enum.Enum):
    REQUESTER = "requester"
    PM = "pm"
    DEVELOPER = "developer"
    ADMIN = "admin"
    QA = "qa"
    APPROVER = "approver"  # Can only approve/reject requests

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    role = Column(String, default=UserRole.REQUESTER)
    is_active = Column(Boolean, default=True)
