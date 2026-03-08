# database.py
import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean  # ✅ Добавлен Boolean
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

# 🎯 Используем SQLite локально, PostgreSQL на Railway
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and "railway" in DATABASE_URL:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args={"sslmode": "require"})
else:
    engine = create_engine("sqlite:///./docubot_local.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==================== МОДЕЛЬ AnalysisHistory ====================
class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    document_type = Column(String, nullable=False)
    parties = Column(String, nullable=True)
    total_amount = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    risk_count = Column(Integer, default=0)
    full_result = Column(Text, nullable=True)
    user_id = Column(String, default="web")
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== МОДЕЛЬ User ====================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

# ==================== ФУНКЦИИ ====================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized")