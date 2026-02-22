import sys
import os
import json
import time
import jwt
import requests
import logging
import hashlib
from io import BytesIO
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum
from functools import lru_cache

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import func

# Для генерации PDF
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm

# Загружаем .env
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== БАЗА ДАННЫХ ====================

from database import get_db, AnalysisHistory, init_db
from sqlalchemy import desc

# ==================== КЭШИРОВАНИЕ ====================

@lru_cache(maxsize=50)
def get_text_hash(text: str) -> str:
    """Хэш для кэширования похожих документов"""
    return hashlib.md5(text[:2000].encode()).hexdigest()

# Глобальный кэш результатов
_analysis_cache: Dict[str, 'AnalysisResult'] = {}

# ==================== МОДЕЛИ ====================

class DocumentType(str, Enum):
    contract = "contract"
    invoice = "invoice"
    act = "act"
    application = "application"
    other = "other"

class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class RiskFlag(BaseModel):
    level: RiskLevel
    category: str
    description: str
    suggestion: str

class ExtractedData(BaseModel):
    document_type: DocumentType
    parties: List[str] = Field(default_factory=list)
    total_amount: Optional[float] = None
    currency: Optional[str] = "RUB"
    dates: Dict[str, Optional[str]] = Field(default_factory=dict)
    obligations: List[str] = Field(default_factory=list)
    penalties: Optional[str] = None

class AnalysisResult(BaseModel):
    extracted_data: ExtractedData
    risk_flags: List[RiskFlag] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)
    summary: str
    confidence_score: float = Field(ge=0, le=1)

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
        
        # 🔑 Читаем ключ из переменной окружения (приоритет)
        key_content = os.getenv('AUTHORIZED_KEY_CONTENT')
        if key_content:
            self.key_data = json.loads(key_content)
            logger.info("✅ Ключ загружен из переменной окружения")
        # 🔑 Читаем из файла authorized_key.json (локально)
        elif os.path.exists('authorized_key.json'):
            with open('authorized_key.json', 'r', encoding='utf-8') as f:
                self.key_data = json.load(f)
            logger.info("✅ Ключ загружен из файла authorized_key.json")
        # 🔑 Фолбэк: файл по пути (если указан)
        elif key_path and os.path.exists(key_path):
            with open(key_path, 'r', encoding='utf-8') as f:
                self.key_data = json.load(f)
            logger.info(f"✅ Ключ загружен из файла {key_path}")
        else:
            raise RuntimeError("❌ Не найден ключ Yandex GPT! Установите AUTHORIZED_KEY_CONTENT")
        
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
            logger.info("✅ Результат взят из кэша")
            return _analysis_cache[text_hash]
        
        combined_prompt = f"""
Ты — эксперт по анализу юридических документов. Определи тип документа и извлеки ВСЕ доступные данные. Верни ТОЛЬКО валидный JSON.

📄 ТЕКСТ ДОКУМЕНТА:
{text[:4000]}

📋 ФОРМАТ ОТВЕТА (строго JSON):
{{
  "extracted_data": {{
    "document_type": "contract|invoice|act|application|other",
    "document_subtype": "loan|rental|service|purchase|microloan_application|other",
    "parties": ["Сторона 1", "Сторона 2"],
    "total_amount": 5800,
    "currency": "RUB",
    "dates": {{"signature": "2024-01-01"}},
    "financial_terms": {{"interest_rate": "0.8% в день", "loan_term": "30 дней"}},
    "obligations": ["обязательство 1"],
    "penalties": "описание штрафов"
  }},
  "risk_flags": [
    {{"level": "high|medium|low", "category": "financial|legal|operational", "description": "...", "suggestion": "..."}}
  ],
  "action_items": ["действие 1", "действие 2"],
  "summary": "Краткое резюме 2-3 предложения",
  "confidence_score": 0.85
}}

⚠️ ПРАВИЛА:
• parties — СПИСОК строк
• ИЗВЛЕКАЙ ВСЁ что есть в тексте
• Если данных нет — ставь null
• Верни ТОЛЬКО JSON, без markdown
• confidence_score: 0.0-1.0
"""
        
        response = self.gpt.call_gpt(combined_prompt, max_tokens=1200)
        
        try:
            start = response.find('{')
            end = response.rfind('}') + 1
            data = json.loads(response[start:end])
        except Exception as e:
            logger.warning(f"JSON parse error: {e}")
            data = {
                "extracted_data": {
                    "document_type": "other",
                    "parties": [],
                    "total_amount": None,
                    "currency": "Не указана",
                    "dates": {},
                    "obligations": [],
                    "penalties": None
                },
                "risk_flags": [],
                "action_items": ["Проверить документ вручную"],
                "summary": "Не удалось проанализировать документ",
                "confidence_score": 0.3
            }
        
        ext = data.get("extracted_data", {})
        result = AnalysisResult(
            extracted_data=ExtractedData(
                document_type=DocumentType(ext.get("document_type", "other")),
                parties=ext.get("parties") or [],
                total_amount=ext.get("total_amount"),
                currency=ext.get("currency") or "Не указана",
                dates=ext.get("dates") or {},
                obligations=ext.get("obligations") or [],
                penalties=ext.get("penalties")
            ),
            risk_flags=[
                RiskFlag(
                    level=RiskLevel(f.get("level", "low")),
                    category=f.get("category", "other"),
                    description=f.get("description", ""),
                    suggestion=f.get("suggestion", "")
                ) for f in (data.get("risk_flags") or [])
            ],
            action_items=data.get("action_items") or ["Проверить вручную"],
            summary=data.get("summary", ""),
            confidence_score=min(1.0, max(0.0, data.get("confidence_score", 0.5)))
        )
        
        _analysis_cache[text_hash] = result
        logger.info(f"💾 Результат сохранён в кэш (всего: {len(_analysis_cache)})")
        
        return result

# ==================== FASTAPI APP ====================

app = FastAPI(title="DocuBot API", description="AI-агент для анализа документов", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Инициализация базы данных и сервисов
init_db()
logger.info("✅ Database initialized")

FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "b1gdcuaq0il54iojm93b")
gpt_service = YandexGPTService(FOLDER_ID)
agent = DocumentAgent(gpt_service)

@app.get("/")
async def root():
    return {"message": "DocuBot API работает!", "version": "0.2.0"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/cache/stats")
async def cache_stats():
    return {
        "cache_size": len(_analysis_cache),
        "cache_info": get_text_hash.cache_info()
    }

@app.post("/api/analyze", response_model=DocumentUploadResponse)
async def analyze_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    logger.info(f"Получен файл: {file.filename}")
    try:
        content = await file.read()
        text = agent.extract_text_from_pdf(content)
        if not text or len(text) < 10:
            raise HTTPException(400, "Не удалось извлечь текст")
        
        result = agent.analyze_document(text)
        
        try:
            history = AnalysisHistory(
                filename=file.filename,
                document_type=result.extracted_data.document_type.value,
                parties=str(result.extracted_data.parties),
                total_amount=result.extracted_data.total_amount,
                currency=result.extracted_data.currency,
                summary=result.summary,
                confidence_score=result.confidence_score,
                risk_count=len(result.risk_flags),
                full_result=result.dict(),
                user_id="web"
            )
            db.add(history)
            db.commit()
        except Exception as e:
            logger.error(f"❌ Ошибка сохранения в БД: {e}")
            db.rollback()
        
        return DocumentUploadResponse(status="success", result=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка: {str(e)}")
        return DocumentUploadResponse(status="error", error=str(e))

@app.get("/api/history")
async def get_history(limit: int = 10, skip: int = 0, db: Session = Depends(get_db)):
    try:
        analyses = db.query(AnalysisHistory).order_by(
            desc(AnalysisHistory.created_at)
        ).offset(skip).limit(limit).all()
        
        return {
            "status": "success",
            "count": len(analyses),
            "analyses": [
                {
                    "id": a.id,
                    "filename": a.filename,
                    "document_type": a.document_type,
                    "created_at": a.created_at.isoformat(),
                    "confidence_score": a.confidence_score,
                    "risk_count": a.risk_count
                }
                for a in analyses
            ]
        }
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return {"status": "error", "error": str(e)}

@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db)):
    try:
        total_documents = db.query(AnalysisHistory).count()
        
        contracts = db.query(AnalysisHistory).filter(
            AnalysisHistory.document_type == "contract"
        ).count()
        
        invoices = db.query(AnalysisHistory).filter(
            AnalysisHistory.document_type == "invoice"
        ).count()
        
        acts = db.query(AnalysisHistory).filter(
            AnalysisHistory.document_type == "act"
        ).count()
        
        avg_confidence = db.query(
          func.avg(AnalysisHistory.confidence_score)
        ).scalar() or 0
        
        total_risks = db.query(
            func.sum(AnalysisHistory.risk_count)
        ).scalar() or 0
        
        return {
            "status": "success",
            "total_documents": total_documents,
            "by_type": {
                "contract": contracts,
                "invoice": invoices,
                "act": acts,
                "other": total_documents - contracts - invoices - acts
            },
            "avg_confidence": round(avg_confidence, 2),
            "total_risks": total_risks
        }
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return {"status": "error", "error": str(e)}

# ==================== PDF GENERATION ENDPOINT ====================

@app.get("/api/generate-pdf/{analysis_id}")
async def generate_pdf(analysis_id: int, db: Session = Depends(get_db)):
    """Генерация PDF отчёта"""
    
    analysis = db.query(AnalysisHistory).filter(
        AnalysisHistory.id == analysis_id
    ).first()
    
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    
    # Регистрируем шрифт с поддержкой кириллицы
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    try:
        # Пробуем зарегистрировать шрифт DejaVu Sans (есть в Linux)
        pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
        pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
        main_font = 'DejaVuSans'
        bold_font = 'DejaVuSans-Bold'
    except:
        # Если шрифт не найден, используем стандартный (кириллица не будет работать)
        main_font = 'Helvetica'
        bold_font = 'Helvetica-Bold'
    
    # Создаём PDF
    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y_position = height - 50
    
    # Заголовок
    p.setFont(bold_font, 24)
    p.drawString(100, y_position, "DocuBot AI - Analysis Report")
    y_position -= 50
    
    # Основная информация
    p.setFont(bold_font, 14)
    p.drawString(50, y_position, "📋 Основная информация")
    y_position -= 30
    
    p.setFont(main_font, 11)
    full_result = analysis.full_result if isinstance(analysis.full_result, dict) else json.loads(analysis.full_result)
    extracted_data = full_result.get('extracted_data', {})
    
    p.drawString(50, y_position, f"Тип документа: {extracted_data.get('document_type', 'N/A')}")
    y_position -= 20
    parties = extracted_data.get('parties', [])
    if isinstance(parties, list):
        parties_str = ', '.join(parties) if parties else 'N/A'
    else:
        parties_str = str(parties)
    p.drawString(50, y_position, f"Стороны: {parties_str}")
    y_position -= 20
    p.drawString(50, y_position, f"Сумма: {extracted_data.get('total_amount', 'N/A')} {extracted_data.get('currency', '')}")
    y_position -= 50
    
    # Риски
    p.setFont(bold_font, 14)
    p.drawString(50, y_position, f"⚠️ Риски ({len(full_result.get('risk_flags', []))})")
    y_position -= 30
    
    for flag in full_result.get('risk_flags', []):
        p.setFont(main_font, 10)
        level = flag.get('level', '').upper()
        category = flag.get('category', '')
        description = flag.get('description', '')
        p.drawString(50, y_position, f"• {level} - {category}: {description}")
        y_position -= 20
        if y_position < 100:
            p.showPage()
            y_position = height - 50
    
    # Рекомендации
    p.setFont(bold_font, 14)
    p.drawString(50, y_position, "✅ Рекомендации")
    y_position -= 30
    
    for i, item in enumerate(full_result.get('action_items', []), 1):
        p.setFont(main_font, 10)
        p.drawString(50, y_position, f"{i}. {item}")
        y_position -= 20
        if y_position < 100:
            p.showPage()
            y_position = height - 50
    
    # Резюме
    p.setFont(bold_font, 14)
    p.drawString(50, y_position, "📝 Резюме")
    y_position -= 30
    
    p.setFont(main_font, 11)
    summary_text = full_result.get('summary', '')
    
    # Разбиваем текст на строки
    words = summary_text.split()
    line = ""
    for word in words:
        if len(line) + len(word) < 70:
            line += word + " "
        else:
            p.drawString(50, y_position, line)
            y_position -= 18
            line = word + " "
            if y_position < 100:
                p.showPage()
                y_position = height - 50
    if line:
        p.drawString(50, y_position, line)
    
    p.save()
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=docubot-analysis-{analysis_id}.pdf"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 10000)))