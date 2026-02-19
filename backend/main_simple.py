# backend/main_simple.py
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

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Загружаем .env
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== КЭШИРОВАНИЕ ====================

@lru_cache(maxsize=50)
def get_text_hash(text: str) -> str:
    """Хэш для кэширования похожих документов"""
    return hashlib.md5(text[:2000].encode()).hexdigest()

# Глобальный кэш результатов
_analysis_cache: Dict[str, 'AnalysisResult'] = {}

# ==================== МОДЕЛИ ====================

class DocumentType(str, Enum):
    CONTRACT = "contract"
    INVOICE = "invoice"
    ACT = "act"
    OTHER = "other"

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
    def __init__(self, folder_id: str, key_path: str):
        self.folder_id = folder_id
        self.iam_token = None
        self.token_expires_at = 0
        
        # 🔑 Читаем ключ из переменной окружения ИЛИ из файла
        key_content = os.getenv('AUTHORIZED_KEY_CONTENT')
        if key_content:
            self.key_data = json.loads(key_content)
            logger.info("✅ Ключ загружен из переменной окружения")
        else:
            logger.info(f"📁 Пробуем загрузить ключ из файла: {key_path}")
            with open(key_path, 'r', encoding='utf-8') as f:
                self.key_data = json.load(f)
        
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
        """Быстрое извлечение текста с ограничением"""
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(BytesIO(file_content))
            
            # Берём только первые 10 страниц (экономия времени)
            text = ""
            for page in reader.pages[:10]:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                if len(text) > 5000:  # Ограничиваем объём
                    break
            
            return text.strip()
        except Exception as e:
            logger.error(f"PDF parse error: {e}")
            return "[Ошибка чтения PDF]"
    
    def analyze_document(self, text: str) -> AnalysisResult:
        # 🔍 Проверяем кэш
        text_hash = get_text_hash(text)
        if text_hash in _analysis_cache:
            logger.info("✅ Результат взят из кэша")
            return _analysis_cache[text_hash]
        
        # 🔥 ОДИН запрос вместо четырёх!
        combined_prompt = f"""
Ты — эксперт по анализу юридических документов. Проанализируй текст и верни ТОЛЬКО валидный JSON:

📄 ТЕКСТ ДОКУМЕНТА:
{text[:4000]}

📋 ФОРМАТ ОТВЕТА (строго JSON, без markdown):
{{
  "extracted_data": {{
    "document_type": "contract|invoice|act|other",
    "parties": ["Сторона 1", "Сторона 2"],
    "total_amount": 100000 или null,
    "currency": "RUB|USD|EUR" или null,
    "dates": {{"signature": "2024-01-01" или null}},
    "obligations": ["обязательство 1"],
    "penalties": "описание штрафов" или null
  }},
  "risk_flags": [
    {{"level": "high|medium|low", "category": "financial|legal|operational", "description": "...", "suggestion": "..."}}
  ],
  "action_items": ["действие 1", "действие 2", "действие 3"],
  "summary": "Краткое резюме 2-3 предложения",
  "confidence_score": 0.85
}}

⚠️ ПРАВИЛА:
• Если данных нет — ставь null, не выдумывай
• currency: всегда строка, даже если null → "Не указана"
• dates.signature: строка или null
• confidence_score: 0.0-1.0
• Верни ТОЛЬКО JSON, без пояснений
"""
        
        response = self.gpt.call_gpt(combined_prompt, max_tokens=1200)
        
        # Парсим JSON
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
        
        # Конвертируем в Pydantic модели
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
        
        # 💾 Сохраняем в кэш
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

# Инициализация сервисов
FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "b1gdcuaq0il54iojm93b")
KEY_PATH = os.path.join(os.path.dirname(__file__), "../authorized_key.json")
gpt_service = YandexGPTService(FOLDER_ID, KEY_PATH)
agent = DocumentAgent(gpt_service)

@app.get("/")
async def root():
    return {"message": "DocuBot API работает!", "version": "0.2.0"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/cache/stats")
async def cache_stats():
    """Статистика кэша для отладки"""
    return {
        "cache_size": len(_analysis_cache),
        "cache_info": get_text_hash.cache_info()
    }

@app.post("/api/analyze", response_model=DocumentUploadResponse)
async def analyze_document(file: UploadFile = File(...)):
    logger.info(f"Получен файл: {file.filename}")
    try:
        content = await file.read()
        text = agent.extract_text_from_pdf(content)
        if not text or len(text) < 10:
            raise HTTPException(400, "Не удалось извлечь текст")
        result = agent.analyze_document(text)
        return DocumentUploadResponse(status="success", result=result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка: {str(e)}")
        return DocumentUploadResponse(status="error", error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 10000)))