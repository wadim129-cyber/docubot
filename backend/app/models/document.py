# backend/app/models/document.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum

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
    document_type: DocumentType = Field(..., description="Тип документа")
    parties: List[str] = Field(default_factory=list, description="Стороны документа")
    total_amount: Optional[float] = Field(None, description="Сумма")
    currency: str = Field(default="RUB")
    dates: Dict[str, str] = Field(default_factory=dict)
    obligations: List[str] = Field(default_factory=list, description="Обязательства")
    penalties: Optional[str] = Field(None, description="Штрафы и санкции")

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