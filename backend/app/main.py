# backend/app/main.py
import sys
import os

# 👈 ВАЖНО: Добавляем backend в путь, чтобы импорты работали
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.agents.document_agent import document_agent
from app.models.document import DocumentUploadResponse
import logging

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="DocuBot API",
    description="AI-агент для анализа документов",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "DocuBot API работает!", "version": "0.1.0"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/analyze", response_model=DocumentUploadResponse)
async def analyze_document(file: UploadFile = File(...)):
    """Загрузка и анализ документа"""
    logger.info(f"Получен файл: {file.filename}")
    
    try:
        content = await file.read()
        text = document_agent.extract_text_from_pdf(content)
        
        if not text or len(text) < 10:
            raise HTTPException(400, "Не удалось извлечь текст из документа")
        
        result = document_agent.analyze_document(text)
        logger.info(f"Анализ завершён: {result.extracted_data.document_type}")
        
        return DocumentUploadResponse(status="success", result=result)
        
    except Exception as e:
        logger.error(f"Ошибка анализа: {str(e)}")
        return DocumentUploadResponse(status="error", error=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)