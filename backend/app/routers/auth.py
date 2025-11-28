from datetime import timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..core import security, database, config
from ..models import user as models
from ..schemas import user as schemas

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

ALLOWED_DOMAINS = ["mystiqueai.com", "konsultera.in"]

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def is_allowed_domain(email: str) -> bool:
    domain = email.split('@')[1] if '@' in email else ''
    return domain in ALLOWED_DOMAINS

@router.post("/token", response_model=dict)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    email = form_data.username
    password = form_data.password
    
    # Check if domain is allowed
    if not is_allowed_domain(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only {', '.join(ALLOWED_DOMAINS)} email addresses are allowed",
        )
    
    user = get_user_by_email(db, email)
    
    # Auto-register if user doesn't exist
    if not user:
        hashed_password = security.get_password_hash(password)
        user = models.User(
            email=email,
            hashed_password=hashed_password,
            full_name=""
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not security.verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=config.settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    print(f"[AUTH DEBUG] Token received: {token[:20]}..." if token and len(token) > 20 else f"[AUTH DEBUG] Token: {token}")
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, config.settings.SECRET_KEY, algorithms=[config.settings.ALGORITHM])
        email: str = payload.get("sub")
        print(f"[AUTH DEBUG] Decoded email: {email}")
        if email is None:
            print("[AUTH DEBUG] Email is None in token payload")
            raise credentials_exception
    except JWTError as e:
        print(f"[AUTH DEBUG] JWT decode error: {e}")
        raise credentials_exception
    except Exception as e:
        print(f"[AUTH DEBUG] Unexpected error: {e}")
        raise credentials_exception
    
    user = get_user_by_email(db, email=email)
    if user is None:
        print(f"[AUTH DEBUG] User not found for email: {email}")
        raise credentials_exception
    
    print(f"[AUTH DEBUG] User authenticated: {user.email}")
    return user
