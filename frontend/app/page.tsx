'use client';

import { useState } from 'react';
import axios from 'axios';

interface AnalysisResult {
  extracted_data: {
    document_type: string;
    parties: string[];
    total_amount: number | null;
    currency: string;
    dates: Record<string, string>;
    obligations: string[];
    penalties: string | null;
  };
  risk_flags: Array<{
    level: string;
    category: string;
    description: string;
    suggestion: string;
  }>;
  action_items: string[];
  summary: string;
  confidence_score: number;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('http://127.0.0.1:8000/api/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      setResult(response.data.result);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка анализа документа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>🤖 DocuBot</h1>
      <p className="subtitle">AI-агент для анализа документов</p>

      <div 
        className="upload-zone" 
        onClick={() => document.getElementById('fileInput')?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          borderColor: isDragging ? '#64b5f6' : '#4a90d9',
          background: isDragging ? 'rgba(74, 144, 217, 0.3)' : 'rgba(74, 144, 217, 0.1)',
        }}
      >
        <div className="upload-icon">📄</div>
        <div className="upload-text">
          {file ? file.name : 'Нажмите для загрузки или перетащите файл'}
        </div>
        <div className="upload-hint">PDF, TXT (до 10 МБ)</div>
        <input
          id="fileInput"
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      {file && !result && !loading && (
        <button
          onClick={handleUpload}
          style={{
            width: '100%',
            padding: '15px',
            marginTop: '20px',
            background: '#4a90d9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          🔍 Анализировать документ
        </button>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Анализирую документ с помощью YandexGPT...</p>
        </div>
      )}

      {error && (
        <div className="error">
          <p>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="result">
          <div className="result-section">
            <h3>📊 Основная информация</h3>
            <div className="data-grid">
              <div className="data-item">
                <div className="data-label">Тип документа</div>
                <div className="data-value">{result.extracted_data.document_type}</div>
              </div>
              <div className="data-item">
                <div className="data-label">Сумма</div>
                <div className="data-value">
                  {result.extracted_data.total_amount || 'Не указана'} {result.extracted_data.currency}
                </div>
              </div>
              <div className="data-item">
                <div className="data-label">Стороны</div>
                <div className="data-value">{result.extracted_data.parties.join(', ') || 'Не указаны'}</div>
              </div>
            </div>
          </div>

          {result.risk_flags.length > 0 && (
            <div className="result-section">
              <h3>⚠️ Риски ({result.risk_flags.length})</h3>
              {result.risk_flags.map((flag, i) => (
                <div key={i} className={`risk-item risk-${flag.level}`}>
                  <strong>{flag.category.toUpperCase()}</strong>
                  <p>{flag.description}</p>
                  <p style={{ color: '#8892b0', marginTop: '8px' }}>💡 {flag.suggestion}</p>
                </div>
              ))}
            </div>
          )}

          <div className="result-section">
            <h3>✅ Чек-лист действий</h3>
            <ul className="action-list">
              {result.action_items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="result-section">
            <h3>📝 Резюме</h3>
            <p style={{ lineHeight: 1.6 }}>{result.summary}</p>
          </div>

          <div className="result-section">
            <p style={{ color: '#8892b0', fontSize: '14px' }}>
              🎯 Точность анализа: {(result.confidence_score * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}