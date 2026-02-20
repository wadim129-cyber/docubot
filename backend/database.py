import os
import logging
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    engine = create_engine(DATABASE_URL)
    logger.info(f"✅ PostgreSQL подключен")
else:
    logger.warning("⚠️ DATABASE_URL не задан, используем SQLite")
    engine = create_engine("sqlite:///./docubot.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    document_type = Column(String, nullable=True)
    parties = Column(Text, nullable=True)
    total_amount = Column(Float, nullable=True)
    currency = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    risk_count = Column(Integer, default=0)
    full_result = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(String, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()