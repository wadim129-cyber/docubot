# backend/main_simple.py
import sys
import os
import json
import time
import jwt
import requests
import logging
from io import BytesIO
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Загружаем .env
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    currency: str = "RUB"
    dates: Dict[str, str] = Field(default_factory=dict)
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
        
        with open(key_path, 'r', encoding='utf-8') as f:
            self.key_data = json.load(f)
        
        self.service_account_id = self.key_data['service_account_id']
        self.private_key = self.key_data['private_key']
        self.key_id = self.key_data['id']
    
    def get_iam_token(self):
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
    
    def call_gpt(self, prompt: str, max_tokens: int = 500) -> str:
        iam_token = self.get_iam_token()
        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {iam_token}",
            "x-folder-id": self.folder_id
        }
        data = {
            "modelUri": f"gpt://{self.folder_id}/yandexgpt-lite",
            "completionOptions": {"stream": False, "temperature": 0.1, "maxTokens": max_tokens},
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
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        except Exception as e:
            return f"[PDF parse error: {str(e)}]"
    
    def analyze_document(self, text: str) -> AnalysisResult:
        # Шаг 1: Извлечение данных
        extract_prompt = f"""
Проанализируй документ и извлеки данные в JSON:

{text[:3000]}

Верни ТОЛЬКО JSON:
{{
    "document_type": "contract|invoice|act|other",
    "parties": ["Сторона 1"],
    "total_amount": 100000 или null,
    "currency": "RUB",
    "dates": {{"signature": "2024-01-01"}},
    "obligations": ["обязательство"],
    "penalties": "штрафы" или null
}}
"""
        extract_response = self.gpt.call_gpt(extract_prompt, max_tokens=800)
        
        try:
            start = extract_response.find('{')
            end = extract_response.rfind('}') + 1
            extracted_data = json.loads(extract_response[start:end])
        except:
            extracted_data = {"document_type": "other", "parties": [], "total_amount": None, "currency": "RUB", "dates": {}, "obligations": [], "penalties": None}
        
        # Шаг 2: Риски
        risk_prompt = f"""
Проанализируй риски. Верни JSON список:
{json.dumps(extracted_data, ensure_ascii=False)}
Формат: [{{"level": "high|medium|low", "category": "financial", "description": "...", "suggestion": "..."}}]
"""
        risk_response = self.gpt.call_gpt(risk_prompt, max_tokens=600)
        try:
            start = risk_response.find('[')
            end = risk_response.rfind(']') + 1
            risk_flags = json.loads(risk_response[start:end])
        except:
            risk_flags = []
        
        # Шаг 3: Действия
        action_prompt = f"""
Чек-лист действий (3-5 пунктов):
{json.dumps(extracted_data, ensure_ascii=False)}
Верни JSON: {{"action_items": ["действие 1"]}}
"""
        action_response = self.gpt.call_gpt(action_prompt, max_tokens=400)
        try:
            start = action_response.find('{')
            end = action_response.rfind('}') + 1
            action_items = json.loads(action_response[start:end]).get("action_items", ["Проверить вручную"])
        except:
            action_items = ["Проверить вручную"]
        
        # Шаг 4: Резюме
        summary = self.gpt.call_gpt(f"Краткое резюме (2-3 предложения):\n{json.dumps(extracted_data, ensure_ascii=False)}", max_tokens=200)
        
        return AnalysisResult(
            extracted_data=ExtractedData(
                document_type=DocumentType(extracted_data.get("document_type", "other")),
                parties=extracted_data.get("parties", []),
                total_amount=extracted_data.get("total_amount"),
                currency=extracted_data.get("currency", "RUB"),
                dates=extracted_data.get("dates", {}),
                obligations=extracted_data.get("obligations", []),
                penalties=extracted_data.get("penalties")
            ),
            risk_flags=[RiskFlag(level=RiskLevel(f.get("level","low")), category=f.get("category","other"), description=f.get("description",""), suggestion=f.get("suggestion","")) for f in risk_flags],
            action_items=action_items,
            summary=summary,
            confidence_score=0.85
        )

# ==================== FASTAPI APP ====================

app = FastAPI(title="DocuBot API", description="AI-агент для анализа документов", version="0.1.0")

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
    return {"message": "DocuBot API работает!", "version": "0.1.0"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

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
    except Exception as e:
        logger.error(f"Ошибка: {str(e)}")
        return DocumentUploadResponse(status="error", error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)