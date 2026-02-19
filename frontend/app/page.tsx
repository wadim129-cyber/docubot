'use client';

import { useState } from 'react';
import axios from 'axios';

const API_URL = 'https://docubot-production-043f.up.railway.app';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл для загрузки');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка при анализе документа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🤖 DocuBot AI</h1>
        <p>AI-агент для анализа документов</p>
      </header>

      <main className="main-content">
        <div className="upload-section">
          <h2>📄 Загрузите документ</h2>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={handleFileChange}
            className="file-input"
          />
          <button 
            onClick={handleUpload} 
            disabled={loading || !file}
            className="upload-btn"
          >
            {loading ? '⏳ Анализирую...' : '🚀 Анализировать'}
          </button>
        </div>

        {error && (
          <div className="error-message">❌ {error}</div>
        )}

        {result && result.status === 'success' && (
          <div className="results">
            <h2>📊 Результаты анализа</h2>
            
            <div className="result-card">
              <h3>📋 Основная информация</h3>
              <p><strong>Тип документа:</strong> {result.result.extracted_data.document_type}</p>
              <p><strong>Стороны:</strong> {result.result.extracted_data.parties?.join(', ') || '—'}</p>
              <p><strong>Сумма:</strong> {result.result.extracted_data.total_amount || 'Не указана'} {result.result.extracted_data.currency || ''}</p>
            </div>

            <div className="result-card">
              <h3>⚠️ Риски ({result.result.risk_flags?.length || 0})</h3>
              {result.result.risk_flags?.map((flag: any, index: number) => (
                <div key={index} className={`risk-flag risk-${flag.level}`}>
                  <strong>{flag.level?.toUpperCase()} - {flag.category}</strong>
                  <p>{flag.description}</p>
                  <em>💡 {flag.suggestion}</em>
                </div>
              ))}
            </div>

            <div className="result-card">
              <h3>✅ Рекомендации</h3>
              <ul>
                {result.result.action_items?.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="result-card">
              <h3>📝 Резюме</h3>
              <p>{result.result.summary}</p>
              <p><strong>Уверенность:</strong> {(result.result.confidence_score * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        .App {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .App-header {
          padding: 40px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .App-header h1 {
          margin: 0;
          font-size: 2.5em;
          background: linear-gradient(90deg, #00d9ff, #00ff88);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .App-header p { color: #888; margin-top: 10px; }
        .main-content {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .upload-section {
          background: rgba(255, 255, 255, 0.05);
          padding: 30px;
          border-radius: 15px;
          text-align: center;
          margin-bottom: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .upload-section h2 { margin-top: 0; color: #00d9ff; }
        .file-input {
          display: block;
          margin: 20px auto;
          padding: 15px;
          background: rgba(255, 255, 255, 0.1);
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 10px;
          color: #fff;
          width: 100%;
          max-width: 400px;
          cursor: pointer;
        }
        .upload-btn {
          background: linear-gradient(90deg, #00d9ff, #00ff88);
          color: #1a1a2e;
          border: none;
          padding: 15px 40px;
          font-size: 1.1em;
          font-weight: bold;
          border-radius: 30px;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .upload-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 217, 255, 0.3);
        }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-message {
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid rgba(255, 0, 0, 0.5);
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 30px;
          text-align: center;
        }
        .results { animation: fadeIn 0.5s ease-in; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .result-card {
          background: rgba(255, 255, 255, 0.05);
          padding: 25px;
          border-radius: 15px;
          margin-bottom: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .result-card h3 {
          margin-top: 0;
          color: #00d9ff;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding-bottom: 10px;
        }
        .risk-flag {
          padding: 15px;
          margin: 10px 0;
          border-radius: 10px;
          border-left: 4px solid;
        }
        .risk-high { background: rgba(255, 0, 0, 0.2); border-color: #ff4444; }
        .risk-medium { background: rgba(255, 165, 0, 0.2); border-color: #ffa500; }
        .risk-low { background: rgba(0, 255, 136, 0.2); border-color: #00ff88; }
        .risk-flag strong { display: block; margin-bottom: 8px; }
        .risk-flag p { margin: 8px 0; color: #ccc; }
        .risk-flag em { display: block; margin-top: 10px; color: #00d9ff; font-style: normal; }
        .result-card ul { padding-left: 20px; }
        .result-card li { margin: 10px 0; color: #ccc; }
      `}</style>
    </div>
  );
}