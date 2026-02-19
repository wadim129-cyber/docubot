# backend/app/agents/document_agent.py
import sys
import os
import json

# 👈 Добавляем путь к backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.services.yandex_gpt import gpt_service
from app.models.document import (
    AnalysisResult, ExtractedData, RiskFlag, 
    DocumentType, RiskLevel
)

class DocumentAgent:
    def __init__(self):
        self.gpt = gpt_service
    
    def extract_text_from_pdf(self, file_content: bytes) -> str:
        """Извлекает текст из PDF (упрощённая версия)"""
        try:
            from PyPDF2 import PdfReader
            from io import BytesIO
            
            reader = PdfReader(BytesIO(file_content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        except Exception as e:
            return f"[OCR не доступен: {str(e)}]"
    
    def analyze_document(self, text: str) -> AnalysisResult:
        """Анализирует документ в 3 шага"""
        
        # Шаг 1: Извлечение данных
        extract_prompt = f"""
Проанализируй этот документ и извлеки данные в JSON формате:

{text[:3000]}

Верни ТОЛЬКО JSON:
{{
    "document_type": "contract|invoice|act|other",
    "parties": ["Сторона 1", "Сторона 2"],
    "total_amount": 100000 или null,
    "currency": "RUB",
    "dates": {{"signature": "2024-01-01", "deadline": "2024-12-31"}},
    "obligations": ["обязательство 1", "обязательство 2"],
    "penalties": "описание штрафов" или null
}}
"""
        
        extract_response = self.gpt.call_gpt(extract_prompt, max_tokens=800)
        
        # Парсим JSON
        try:
            start = extract_response.find('{')
            end = extract_response.rfind('}') + 1
            json_str = extract_response[start:end]
            extracted_data = json.loads(json_str)
        except:
            extracted_data = {
                "document_type": "other",
                "parties": [],
                "total_amount": None,
                "currency": "RUB",
                "dates": {},
                "obligations": [],
                "penalties": None
            }
        
        # Шаг 2: Анализ рисков
        risk_prompt = f"""
Проанализируй договор на риски. Верни JSON список:

{json.dumps(extracted_data, ensure_ascii=False)}

Формат:
[
    {{"level": "high|medium|low", "category": "financial", "description": "...", "suggestion": "..."}}
]
"""
        
        risk_response = self.gpt.call_gpt(risk_prompt, max_tokens=600)
        
        try:
            start = risk_response.find('[')
            end = risk_response.rfind(']') + 1
            risk_flags = json.loads(risk_response[start:end])
        except:
            risk_flags = []
        
        # Шаг 3: Чек-лист действий
        action_prompt = f"""
Создай чек-лист действий по этому документу (3-5 пунктов):

{json.dumps(extracted_data, ensure_ascii=False)}

Верни JSON: {{"action_items": ["действие 1", "действие 2"]}}
"""
        
        action_response = self.gpt.call_gpt(action_prompt, max_tokens=400)
        
        try:
            start = action_response.find('{')
            end = action_response.rfind('}') + 1
            action_data = json.loads(action_response[start:end])
            action_items = action_data.get("action_items", [])
        except:
            action_items = ["Проверить документ вручную"]
        
        # Шаг 4: Резюме
        summary_prompt = f"""
Краткое резюме документа (2-3 предложения):

{json.dumps(extracted_data, ensure_ascii=False)}
"""
        
        summary = self.gpt.call_gpt(summary_prompt, max_tokens=200)
        
        # Собираем результат
        result = AnalysisResult(
            extracted_data=ExtractedData(
                document_type=DocumentType(extracted_data.get("document_type", "other")),
                parties=extracted_data.get("parties", []),
                total_amount=extracted_data.get("total_amount"),
                currency=extracted_data.get("currency", "RUB"),
                dates=extracted_data.get("dates", {}),
                obligations=extracted_data.get("obligations", []),
                penalties=extracted_data.get("penalties")
            ),
            risk_flags=[
                RiskFlag(
                    level=RiskLevel(f.get("level", "low")),
                    category=f.get("category", "other"),
                    description=f.get("description", ""),
                    suggestion=f.get("suggestion", "")
                )
                for f in risk_flags
            ],
            action_items=action_items,
            summary=summary,
            confidence_score=0.85
        )
        
        return result

# Глобальный экземпляр
document_agent = DocumentAgent()