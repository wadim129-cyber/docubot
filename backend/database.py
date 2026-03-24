import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, Boolean, Index
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

# 🎯 Подключение к БД: SQLite локально, PostgreSQL на Railway
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and "railway" in DATABASE_URL.lower():
    # PostgreSQL на Railway: SSL обязателен
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        connect_args={"sslmode": "require"}
    )
else:
    # SQLite для локальной разработки
    engine = create_engine(
        "sqlite:///./docubot_local.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==================== МОДЕЛЬ User ====================
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)  # ✅ Индекс для поиска по email
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, index=True)  # ✅ Индекс для фильтрации активных
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # ✅ Индекс для сортировки

# ==================== МОДЕЛЬ AnalysisHistory ====================
class AnalysisHistory(Base):
    __tablename__ = "analysis_history"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    document_type = Column(String, nullable=False, index=True)  # ✅ Индекс для фильтрации по типу
    parties = Column(Text, nullable=True)  # 🔧 Text вместо String для длинных данных
    total_amount = Column(Float, nullable=True, index=True)  # ✅ Индекс для статистики
    currency = Column(String, nullable=True)
    summary = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    risk_count = Column(Integer, default=0)
    full_result = Column(Text, nullable=True)
    user_id = Column(String, default="web", index=True)  # ✅ Индекс для поиска по пользователю
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # ✅ Индекс для сортировки по дате
    
    # ✅ Составной индекс: часто ищем историю пользователя по дате
    __table_args__ = (
        Index("idx_user_created", "user_id", "created_at"),
        Index("idx_type_user", "document_type", "user_id"),
    )

# ==================== ФУНКЦИИ ====================
def get_db():
    """Зависимость FastAPI для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Создание таблиц при старте приложения"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database initialized with indexes")