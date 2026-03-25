import secrets
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import User, PasswordResetToken
from .email_utils import send_email
from .hashing import hash_password

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/auth/request-password-reset")
async def request_password_reset(email: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    # Не выдаём, существует ли пользователь
    if user is None:
        return {"ok": True}
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=30)
    prt = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at, used=False)
    db.add(prt)
    db.commit()
    reset_url = f"{os.getenv('FRONTEND_BASE_URL','http://localhost:3000')}/reset-password?token={token}"
    html = f"<p>Чтобы сбросить пароль, перейдите по ссылке: <a href='{reset_url}'>{reset_url}</a></p>"
    text = f"Сброс пароля: {reset_url}"
    await send_email(user.email, "DocuBot: сброс пароля", html=html, text=text)
    return {"ok": True}

@router.post("/auth/reset-password")
async def reset_password(token: str, new_password: str, confirm_password: str, db: Session = Depends(get_db)):
    if new_password != confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    prt = db.query(PasswordResetToken).filter(PasswordResetToken.token == token, PasswordResetToken.used == False).first()
    if prt is None or prt.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == prt.user_id).first()
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    user.password_hash = hash_password(new_password)
    prt.used = True
    db.add(user)
    db.add(prt)
    db.commit()
    return {"ok": True}