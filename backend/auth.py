# auth.py
import os
import jwt
import secrets
from datetime import datetime, timedelta
import loggingЫ
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# 🔧 Импортируем User и get_db из database.py (не определяем User заново!)
from database import get_db, User

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ==================== PYDANTIC МОДЕЛИ ====================
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    email: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str        

# ❌ НЕ определяйте class User(Base) здесь - он уже в database.py!

# ==================== ФУНКЦИИ ====================
def send_password_reset_email(email: str, reset_link: str):
    # Здесь можно интегрировать реальную рассылку.
    logger.info(f"Password reset link for {email}: {reset_link}")
def generate_password_reset_token(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    db.add(user)
    db.commit()
    db.refresh(user)
    return token    
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password[:72])

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def create_user(db: Session, user: UserCreate) -> User:
    db_user = User(
        email=user.email,
        hashed_password=get_password_hash(user.password),
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = get_user_by_id(db, user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    return user
    # Эндпоинт: запросить сброс пароля
@app.post("/auth/request-reset")
async def request_password_reset(req: PasswordResetRequest, db: Session = Depends(get_db)):
    user = get_user(db, req.email)
    if not user or not user.is_active:
        # Не возвращаем подробностей, чтобы не утечь информацию
        raise HTTPException(status_code=404, detail="User not found")

    token = generate_password_reset_token(db, user)
    reset_link = f"{BASE_URL}/reset-password?token={token}"
    send_password_reset_email(user.email, reset_link)
    return {"message": "Password reset link has been sent to your email"}

# Эндпоинт: сбросить пароль по токену
@app.post("/auth/reset-password")
async def reset_password(req: PasswordResetConfirm, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == req.token).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid token")

    if user.reset_token_expiry is None or user.reset_token_expiry < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    user.hashed_password = get_password_hash(req.new_password)
    # Очистить токен после успешного сброса
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()

    return {"message": "Password has been reset successfully"}