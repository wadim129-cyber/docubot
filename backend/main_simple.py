import sys
import os
import json
import time
import jwt
import requests
import logging
import hashlib
from io import BytesIO
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from enum import Enum
from functools import lru_cache

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import get_db, AnalysisHistory, init_db, User
from sqlalchemy import desc, func

from auth import (
    UserCreate, UserLogin, Token, UserResponse,
    create_user, get_user, verify_password,
    create_access_token, get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

# PDF генерация
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

# === ПОДДЕРЖКА КИРИЛЛИЦЫ В PDF (ГЛОБАЛЬНО) ===
def setup_fonts():
    """Используем Arial (Windows) или DejaVuSans (кроссплатформенный)"""
    import sys
    
    if sys.platform == 'win32':
        # Windows: используем Arial (есть везде)
        font_paths = [
            (os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arial.ttf'), 'Arial'),
            (os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'arialbd.ttf'), 'Arial-Bold'),
        ]
    else:
        # Linux/Mac: DejaVuSans
        font_dir = os.path.join(os.path.dirname(__file__), "fonts")
        font_paths = [
            (os.path.join(font_dir, "DejaVuSans.ttf"), "DejaVuSans"),
            (os.path.join(font_dir, "DejaVuSans-Bold.ttf"), "DejaVuSans-Bold"),
        ]
    
    default_font = "Helvetica"
    bold_font = "Helvetica-Bold"
    
    for font_path, font_name in font_paths:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont(font_name, font_path))
                if 'Bold' in font_name or 'bd' in font_path.lower():
                    bold_font = font_name
                else:
                    default_font = font_name
                logging.info(f"✅ Шрифт загружен: {font_name} из {font_path}")
            except Exception as e:
                logging.warning(f"⚠️ Ошибка загрузки {font_name}: {e}")
    
    logging.info(f"📝 Используем шрифты: {default_font}, {bold_font}")
    return default_font, bold_font

DEFAULT_FONT, BOLD_FONT = setup_fonts()

load_dotenv()

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf"}
ALLOWED_MIME_TYPES = {"application/pdf"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ==================== БАЗА ДАННЫХ ====================
from database import get_db, AnalysisHistory, init_db

# ==================== КЭШИРОВАНИЕ ====================
@lru_cache(maxsize=50)
def get_text_hash(text: str) -> str:
    return hashlib.md5(text[:2000].encode()).hexdigest()

_analysis_cache: Dict[str, 'AnalysisResult'] = {}

# ==================== МОДЕЛИ ====================
class DocumentType(str, Enum):
    CONTRACT = "contract"
    AGREEMENT = "agreement" 
    INVOICE = "invoice"
    ACT = "act"
    APPLICATION = "application"
    OTHER = "other"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RiskFlag(BaseModel):
    level: RiskLevel
    category: str
    title: Optional[str] = None
    description: str
    legal_basis: Optional[str] = None
    suggestion: str
    impact: Optional[str] = None

class Party(BaseModel):
    name: str
    role: str = "other"
    inn: Optional[str] = None
    address: Optional[str] = None

class FinancialTerms(BaseModel):
    total_amount: Optional[float] = None
    currency: str = "RUB"
    interest_rate: Optional[str] = None
    interest_rate_numeric: Optional[float] = None
    payment_schedule: Optional[str] = None
    loan_term_days: Optional[int] = None
    late_fee_percent: Optional[float] = None
    late_fee_description: Optional[str] = None

class DatesData(BaseModel):
    signature: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    payment_due: Optional[str] = None

class ExtractedData(BaseModel):
    document_type: DocumentType
    document_subtype: str = "other"
    document_number: Optional[str] = None
    document_date: Optional[str] = None
    parties: List[Party] = Field(default_factory=list)
    financial_terms: FinancialTerms = Field(default_factory=FinancialTerms)
    dates: DatesData = Field(default_factory=DatesData)
    obligations: List[str] = Field(default_factory=list)
    penalties: Optional[str] = None
    termination_conditions: Optional[str] = None
    dispute_resolution: Optional[str] = None
    missing_requisites: List[str] = Field(default_factory=list)

class ActionItem(BaseModel):
    priority: Optional[str] = "medium"
    action: str
    deadline: Optional[str] = None

class AnalysisResult(BaseModel):
    extracted_data: ExtractedData
    risk_flags: List[RiskFlag] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    summary: str
    confidence_score: float = Field(ge=0, le=1)
    analysis_notes: Optional[str] = None

class DocumentUploadResponse(BaseModel):
    status: str
    result: Optional[AnalysisResult] = None
    error: Optional[str] = None

# ==================== YANDEX GPT SERVICE ====================
class YandexGPTService:
    def __init__(self, folder_id: str, key_path: str = None):
        self.folder_id = folder_id
        self.iam_token = None
        self.token_expires_at = 0
        
        key_content = os.getenv('AUTHORIZED_KEY_CONTENT')
        if key_content:
            self.key_data = json.loads(key_content)
            logger.info("Ключ загружен из ENV")
        elif os.path.isfile('authorized_key.json'):
            with open('authorized_key.json', 'r', encoding='utf-8') as f:
                self.key_data = json.load(f)
            logger.info("Ключ загружен из файла")
        elif key_path and os.path.isfile(key_path):
            with open(key_path, 'r', encoding='utf-8') as f:
                self.key_data = json.load(f)
            logger.info(f"Ключ загружен из {key_path}")
        else:
            raise RuntimeError("Не найден ключ Yandex GPT!")
        
        self.service_account_id = self.key_data['service_account_id']
        self.private_key = self.key_data['private_key']
        self.key_id = self.key_data['id']
    
    def get_iam_token(self) -> str:
        now = time.time()
        if self.iam_token and now < self.token_expires_at:
            return self.iam_token
        
        payload = {
            'aud': "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            'iss': self.service_account_id,
            'iat': int(now),
            'exp': int(now) + 3600
        }
        headers = {'kid': self.key_id, 'alg': 'PS256', 'typ': 'JWT'}
        encoded_token = jwt.encode(payload, self.private_key, algorithm='PS256', headers=headers)
        
        resp = requests.post(
            "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            headers={"Content-Type": "application/json"},
            json={"jwt": encoded_token}
        )
        if resp.status_code != 200:
            raise Exception(f"Failed to get IAM token: {resp.text}")
        
        self.iam_token = resp.json()["iamToken"]
        self.token_expires_at = now + 3600
        return self.iam_token
    
    def call_gpt(self, prompt: str, max_tokens: int = 1200) -> str:
        iam_token = self.get_iam_token()
        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {iam_token}",
            "x-folder-id": self.folder_id
        }
        data = {
            "modelUri": f"gpt://{self.folder_id}/yandexgpt-lite",
            "completionOptions": {
                "stream": False,
                "temperature": 0.1,
                "maxTokens": max_tokens,
                "preset": "balanced"
            },
            "messages": [{"role": "user", "text": prompt}]
        }
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            raise Exception(f"GPT error: {response.text}")
        return response.json()['result']['alternatives'][0]['message']['text']

# ==================== DOCUMENT AGENT ====================
class DocumentAgent:
    def __init__(self, gpt_service: YandexGPTService):
        self.gpt = gpt_service
    
    def extract_text_from_pdf(self, file_content: bytes) -> str:
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in reader.pages[:10]:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                if len(text) > 5000:
                    break
            return text.strip()
        except Exception as e:
            logger.error(f"PDF parse error: {e}")
            return "[Ошибка чтения PDF]"
    
    def analyze_document(self, text: str) -> AnalysisResult:
        text_hash = get_text_hash(text)
        if text_hash in _analysis_cache:
            logger.info("Результат из кэша")
            return _analysis_cache[text_hash]
        
        combined_prompt = f"""
Ты — профессиональный юрист-эксперт. Проанализируй документ и верни ТОЛЬКО валидный JSON.

ТЕКСТ:
{text[:4500]}

ФОРМАТ ОТВЕТА (строгий JSON):
{{
  "extracted_data": {{
    "document_type": "contract|invoice|act|application|agreement|other",
    "document_subtype": "loan|rental|service|other",
    "document_number": "string or null",
    "document_date": "YYYY-MM-DD or null",
    "parties": [{{"name": "str", "role": "str", "inn": "str or null", "address": "str or null"}}],
    "financial_terms": {{"total_amount": number or null, "currency": "RUB", "interest_rate": "str", "interest_rate_numeric": number or null}},
    "dates": {{"signature": "YYYY-MM-DD or null", "start_date": "YYYY-MM-DD or null", "end_date": "YYYY-MM-DD or null"}},
    "obligations": ["str"],
    "penalties": "str or null",
    "termination_conditions": "str or null",
    "dispute_resolution": "str or null",
    "missing_requisites": ["str"]
  }},
  "risk_flags": [{{"level": "critical|high|medium|low", "category": "str", "title": "str", "description": "str", "legal_basis": "str or null", "suggestion": "str", "impact": "str or null"}}],
  "action_items": [{{"priority": "high|medium|low", "action": "str", "deadline": "str or null"}}],
  "summary": "str",
  "confidence_score": 0.0-1.0,
  "analysis_notes": "str or null"
}}
"""
        response = self.gpt.call_gpt(combined_prompt, max_tokens=1200)
        
        try:
            start = response.find('{')
            end = response.rfind('}') + 1
            data = json.loads(response[start:end])
        except Exception as e:
            logger.warning(f"JSON parse error: {e}")
            data = {"extracted_data": {"document_type": "other", "parties": [], "financial_terms": {}, "dates": {}, "obligations": []}, "risk_flags": [], "action_items": [], "summary": "Ошибка анализа", "confidence_score": 0.3}
        
        ext = data.get("extracted_data", {})
        financial_raw = ext.get("financial_terms", {}) or {}
        dates_raw = ext.get("dates", {}) or {}
        parties_raw = ext.get("parties") or []
        
        parties_list = []
        for p in parties_raw:
            if isinstance(p, dict):
                try:
                    parties_list.append(Party(**p))
                except:
                    parties_list.append(Party(name=str(p.get("name", "Unknown")), role=p.get("role", "other")))
            else:
                parties_list.append(Party(name=str(p), role="other"))
        
        risk_flags_list = []
        for f in (data.get("risk_flags") or []):
            try:
                level_str = f.get("level", "low").lower()
                if level_str not in ["low", "medium", "high", "critical"]:
                    level_str = "low"
                risk_flags_list.append(RiskFlag(
                    level=RiskLevel(level_str), category=f.get("category", "other"),
                    title=f.get("title"), description=f.get("description", ""),
                    legal_basis=f.get("legal_basis"), suggestion=f.get("suggestion", ""),
                    impact=f.get("impact")
                ))
            except:
                pass
        
        action_items_list = []
        for a in (data.get("action_items") or []):
            if isinstance(a, dict):
                try:
                    action_items_list.append(ActionItem(**a))
                except:
                    action_items_list.append(ActionItem(action=str(a.get("action", "Check"))))
            else:
                action_items_list.append(ActionItem(action=str(a)))
        
        result = AnalysisResult(
            extracted_data=ExtractedData(
                document_type=DocumentType(ext.get("document_type", "other")),
                document_subtype=ext.get("document_subtype", "other"),
                document_number=ext.get("document_number"),
                document_date=ext.get("document_date"),
                parties=parties_list,
                financial_terms=FinancialTerms(
                    total_amount=financial_raw.get("total_amount"),
                    currency=financial_raw.get("currency", "RUB"),
                    interest_rate=financial_raw.get("interest_rate"),
                    interest_rate_numeric=financial_raw.get("interest_rate_numeric"),
                ),
                dates=DatesData(
                    signature=dates_raw.get("signature"),
                    start_date=dates_raw.get("start_date"),
                    end_date=dates_raw.get("end_date"),
                    payment_due=dates_raw.get("payment_due"),
                ),
                obligations=ext.get("obligations") or [],
                penalties=ext.get("penalties"),
                termination_conditions=ext.get("termination_conditions"),
                dispute_resolution=ext.get("dispute_resolution"),
                missing_requisites=ext.get("missing_requisites", []),
            ),
            risk_flags=risk_flags_list,
            action_items=action_items_list,
            summary=data.get("summary", "Анализ завершён"),
            confidence_score=min(1.0, max(0.0, data.get("confidence_score", 0.5))),
            analysis_notes=data.get("analysis_notes")
        )
        
        _analysis_cache[text_hash] = result
        return result

# ==================== FASTAPI APP ====================
app = FastAPI(title="DocuBot API", description="AI-агент для анализа документов", version="0.3.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://docubot-three.vercel.app",  # Твой фронтенд
        "http://localhost:3000",              # Локальная разработка
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Все методы (GET, POST, etc.)
    allow_headers=["*"],  # Все заголовки
)
# ==================== ПРИМЕНЕНИЕ МИГРАЦИЙ ====================
import subprocess
import sys

try:
    print("🔄 Applying Alembic migrations...")
    subprocess.check_call([sys.executable, "-m", "alembic", "upgrade", "head"])
    print("✅ Migrations applied successfully!")
except Exception as e:
    print(f"⚠️ Migration error (continuing anyway): {e}")
# =============================================================

init_db()
logger.info("Database initialized with indexes")

FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "b1gdcuaq0il54iojm93b")
gpt_service = YandexGPTService(FOLDER_ID)
agent = DocumentAgent(gpt_service)

# ==================== PUBLIC ENDPOINTS ====================
@app.get("/")
async def root():
    return {"message": "DocuBot API работает!", "version": "0.3.2"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# ==================== AUTH ENDPOINTS ====================
@app.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email уже зарегистрирован")
    new_user = create_user(db=db, user=user)
    logger.info(f"Новый пользователь: {new_user.email}")
    return new_user

@app.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = get_user(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль", headers={"WWW-Authenticate": "Bearer"})
    access_token = create_access_token(data={"sub": user.id}, expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    logger.info(f"Вход: {user.email}")
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "email": user.email}
    
@app.get("/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== PROTECTED ENDPOINTS ====================
@app.post("/api/analyze", response_model=DocumentUploadResponse)
async def analyze_document(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    logger.info(f"Анализ: {current_user.email}, файл: {file.filename}")
    
    file_ext = os.path.splitext(file.filename.lower())[1]
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Только PDF. Получено: {file_ext}")
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Неверный тип: {file.content_type}")
    
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(400, "Файл пустой")
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"Файл > 10MB")
        
        text = agent.extract_text_from_pdf(content)
        if not text or len(text.strip()) < 10:
            raise HTTPException(400, "Не удалось извлечь текст")
        
        result = agent.analyze_document(text)
        
        try:
            history = AnalysisHistory(
                filename=file.filename,
                document_type=result.extracted_data.document_type.value,
                parties=json.dumps([p.model_dump() for p in result.extracted_data.parties], ensure_ascii=False),
                total_amount=result.extracted_data.financial_terms.total_amount,
                currency=result.extracted_data.financial_terms.currency,
                summary=result.summary,
                confidence_score=result.confidence_score,
                risk_count=len(result.risk_flags),
                full_result=json.dumps(result.model_dump(), ensure_ascii=False),
                user_id=str(current_user.id)
            )
            db.add(history)
            db.commit()
        except Exception as e:
            logger.error(f"Ошибка БД: {e}")
            db.rollback()
        
        return DocumentUploadResponse(status="success", result=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка: {str(e)}")
        return DocumentUploadResponse(status="error", error=str(e))

@app.get("/api/history")
async def get_history(limit: int = 10, skip: int = 0, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        analyses = db.query(AnalysisHistory).filter(AnalysisHistory.user_id == str(current_user.id)).order_by(desc(AnalysisHistory.created_at)).offset(skip).limit(limit).all()
        return {"status": "success", "count": len(analyses), "analyses": [{"id": a.id, "filename": a.filename, "document_type": a.document_type, "created_at": a.created_at.isoformat(), "confidence_score": a.confidence_score, "risk_count": a.risk_count} for a in analyses]}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {"status": "error", "error": str(e)}

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        base = db.query(AnalysisHistory).filter(AnalysisHistory.user_id == str(current_user.id))
        total = base.count()
        contracts = base.filter(AnalysisHistory.document_type == "contract").count()
        avg_conf = db.query(func.avg(AnalysisHistory.confidence_score)).filter(AnalysisHistory.user_id == str(current_user.id)).scalar() or 0
        total_risks = db.query(func.sum(AnalysisHistory.risk_count)).filter(AnalysisHistory.user_id == str(current_user.id)).scalar() or 0
        return {"status": "success", "total_documents": total, "by_type": {"contract": contracts, "invoice": 0, "act": 0, "other": total - contracts}, "avg_confidence": round(avg_conf, 2), "total_risks": total_risks}
    except Exception as e:
        logger.error(f"Stats error: {e}")
        return {"status": "error", "error": str(e)}

# ==================== PDF GENERATION (ИСПРАВЛЕННАЯ ВЕРСИЯ) ====================
@app.get("/api/generate-pdf/{analysis_id}")
async def generate_pdf(analysis_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Генерация PDF отчёта с кириллицей и улучшенным дизайном"""
    
    analysis = db.query(AnalysisHistory).filter(
        AnalysisHistory.id == analysis_id,
        AnalysisHistory.user_id == str(current_user.id)
    ).first()
    if not analysis:
        raise HTTPException(404, "Analysis not found")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=40)
    story = []
    
    # === 🎨 СТИЛИ (СНАЧАЛА!) ===
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='MainRu', fontName=DEFAULT_FONT, fontSize=11, leading=14, textColor=colors.HexColor('#1e293b'), encoding='utf-8'))
    styles.add(ParagraphStyle(name='BoldRu', fontName=BOLD_FONT, fontSize=14, leading=18, spaceAfter=10, textColor=colors.HexColor('#0f172a'), encoding='utf-8'))
    styles.add(ParagraphStyle(name='SmallRu', fontName=DEFAULT_FONT, fontSize=9, leading=12, textColor=colors.HexColor('#64748b'), encoding='utf-8'))
    styles.add(ParagraphStyle(name='TitleRu', fontName=BOLD_FONT, fontSize=20, leading=24, spaceAfter=8, alignment=1, encoding='utf-8'))
    
    # Цвета для рисков
    RISK_COLORS = {
        'critical': {'bg': '#fef2f2', 'border': '#dc2626', 'text': '#b91c1c'},
        'high': {'bg': '#fff7ed', 'border': '#ea580c', 'text': '#c2410c'},
        'medium': {'bg': '#fffbeb', 'border': '#ca8a04', 'text': '#a16207'},
        'low': {'bg': '#f0fdf4', 'border': '#16a34a', 'text': '#15803d'},
    }
    
    # === 🖼️ ЛОГОТИП ===
    story.append(Paragraph(f"<font name='{BOLD_FONT}' size=22 color='#2563eb'>DocuBot</font><font name='{DEFAULT_FONT}' size=22 color='#64748b'> AI</font>", styles['TitleRu']))
    story.append(Paragraph(f"<font name='{DEFAULT_FONT}' size=9 color='#94a3b8'>Отчёт: {datetime.now().strftime('%d.%m.%Y %H:%M')}</font>", styles['SmallRu']))
    story.append(Spacer(1, 15))
    story.append(Paragraph("<para align='center'><font color='#e2e8f0'>{'─' * 60}</font></para>", styles['SmallRu']))
    story.append(Spacer(1, 20))
    
    # Парсинг данных
    try:
        full_result = json.loads(analysis.full_result) if isinstance(analysis.full_result, str) else analysis.full_result
    except:
        full_result = {}
    ext = full_result.get('extracted_data', {})
    
    # === 📋 ОСНОВНАЯ ИНФОРМАЦИЯ ===
    story.append(Paragraph("Основная информация", styles['BoldRu']))
    
    parties = ext.get('parties', [])
    party_names = [p.get('name', 'Unknown') if isinstance(p, dict) else str(p) for p in parties] if isinstance(parties, list) else ['N/A']
    
    table_data = [
        [Paragraph("Тип документа", styles['BoldRu']), Paragraph(ext.get('document_type', 'N/A'), styles['MainRu'])],
        [Paragraph("Стороны", styles['BoldRu']), Paragraph(', '.join(party_names), styles['MainRu'])],
        [Paragraph("Сумма", styles['BoldRu']), Paragraph(f"{ext.get('financial_terms', {}).get('total_amount', 'N/A')} {ext.get('financial_terms', {}).get('currency', '')}", styles['MainRu'])],
        [Paragraph("Дата документа", styles['BoldRu']), Paragraph(ext.get('document_date', 'N/A'), styles['MainRu'])],
    ]
    
    table = Table(table_data, colWidths=[150, 300])
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), DEFAULT_FONT),
        ('FONTNAME', (0, 0), (0, -1), BOLD_FONT),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('LEADING', (0, 0), (-1, -1), 14),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 0), (-1, 0), BOLD_FONT),
    ]))
    story.append(table)
    story.append(Spacer(1, 20))
    
    # === ⚠️ РИСКИ ===
    risks = full_result.get('risk_flags', [])
    if risks:
        story.append(Paragraph(f"Риски ({len(risks)})", styles['BoldRu']))
        for flag in risks:
            level = flag.get('level', 'low').lower() if isinstance(flag, dict) else 'low'
            colors_cfg = RISK_COLORS.get(level, RISK_COLORS['low'])
            
            story.append(Paragraph(
                f"<para backColor='{colors_cfg['bg']}' borderPadding='5' borderColor='{colors_cfg['border']}' borderWidth='1' borderPadding='3'>"
                f"<font name='{BOLD_FONT}' color='{colors_cfg['text']}'>[{level.upper()}]</font> "
                f"<font name='{BOLD_FONT}'>{flag.get('title') or flag.get('category', 'Риск')}</font>"
                f"</para>",
                styles['MainRu']
            ))
            
            story.append(Paragraph(f"<font name='{DEFAULT_FONT}'>{flag.get('description', '')}</font>", styles['MainRu']))
            
            if flag.get('suggestion'):
                story.append(Paragraph(f"<font name='{DEFAULT_FONT}' color='#059669'>💡 {flag.get('suggestion')}</font>", styles['SmallRu']))
            
            story.append(Spacer(1, 12))
    
    # === ✅ РЕКОМЕНДАЦИИ ===
    actions = full_result.get('action_items', [])
    if actions:
        story.append(Paragraph("Рекомендации", styles['BoldRu']))
        for i, item in enumerate(actions[:5], 1):
            action_text = item.get('action', str(item)) if isinstance(item, dict) else str(item)
            story.append(Paragraph(f"{i}. <font name='{DEFAULT_FONT}'>{action_text}</font>", styles['MainRu']))
        story.append(Spacer(1, 15))
    
    # === 📝 РЕЗЮМЕ ===
    story.append(Paragraph("Резюме", styles['BoldRu']))
    summary = full_result.get('summary', 'Нет данных')
    story.append(Paragraph(f"<font name='{DEFAULT_FONT}'>{summary}</font>", styles['MainRu']))
    
    # Футер с уверенностью
    conf = full_result.get('confidence_score', 0)
    conf_color = '#22c55e' if conf >= 0.7 else '#eab308' if conf >= 0.4 else '#ef4444'
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"<font name='{DEFAULT_FONT}' size=9 color='{conf_color}'>Уверенность анализа: {conf*100:.0f}%</font>", styles['SmallRu']))
    
    # Нумерация страниц
    def add_page_number(canvas, doc):
        canvas.setFont(DEFAULT_FONT, 8)
        canvas.setFillColor(colors.gray)
        canvas.drawString(doc.pagesize[0]/2 - 30, 20, f"Стр. {canvas.getPageNumber()}")
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    buffer.seek(0)
    
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=docubot-report-{analysis_id}.pdf"})

# ==================== ЗАПУСК ====================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main_simple:app", host="0.0.0.0", port=10000, reload=True)