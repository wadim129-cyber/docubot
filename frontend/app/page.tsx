'use client';

import { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

// 🔧 Исправлено: убраны лишние пробелы в URL
const API_URL = 'https://docubot-production-043f.up.railway.app';

export default function Home() {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // 🔧 Добавлено: храним ID текущего анализа для PDF
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      setCurrentAnalysisId(null); // Сбрасываем ID при новом файле
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError(t('selectFile'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/api/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setResult(response.data);
      
      // 🔧 Сохраняем ID текущего анализа для PDF
      if (response.data.status === 'success') {
        try {
          const historyResponse = await fetch(`${API_URL}/api/history?limit=1`);
          const historyData = await historyResponse.json();
          if (historyData.analyses?.length > 0) {
            setCurrentAnalysisId(historyData.analyses[0].id);
          }
        } catch (e) {
          console.warn('Could not fetch analysis ID:', e);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || t('analysisError'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    // 🔧 Используем сохранённый ID вместо запроса к базе
    const analysisId = currentAnalysisId;
    
    if (!analysisId) {
      alert('❌ No analysis available. Please upload a document first.');
      return;
    }
    
    const btn = document.querySelector('.export-btn') as HTMLButtonElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating PDF...';
    btn.disabled = true;
    
    try {
      const response = await fetch(`${API_URL}/api/generate-pdf/${analysisId}`);
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // 🔧 Уникальное имя файла с ID анализа
      link.download = `docubot-analysis-${analysisId}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF error:', error);
      alert('❌ Error creating PDF. Please try again.');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  return (
    <div className="App">
      {/* Language Switcher */}
      <header className="App-header">
        <div className="header-content">
          <h1>🤖 {t('title')}</h1>
          <p>{t('subtitle')}</p>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="main-content">
        
        {/* Upload Section */}
        <div className="upload-section">
          <h2>📄 {t('uploadTitle')}</h2>
          <p style={{ color: '#888', marginBottom: '15px' }}>{t('uploadSubtitle')}</p>
          
          {/* Custom File Upload Button */}
          <div className="custom-file-upload">
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input-hidden"
            />
            <label htmlFor="file-upload" className="file-upload-label">
              <span className="upload-icon">📁</span>
              <span className="upload-text">
                {file ? `✅ ${file.name}` : t('chooseFile')}
              </span>
            </label>
          </div>
          
          <button 
            onClick={handleUpload} 
            disabled={loading || !file}
            className="upload-btn"
          >
            {loading ? t('analyzing') : t('analyzeButton')}
          </button>
        </div>

        {/* Error Message */}
        {error && <div className="error-message">❌ {error}</div>}

        {/* Results */}
        {result?.status === 'success' && (
          <div className="results">
            <h2>📊 {t('resultsTitle')}</h2>
            
            {/* Basic Info */}
            <div className="result-card">
              <h3>📋 {t('basicInfo')}</h3>
              <p><strong>{t('type')}:</strong> {result.result.extracted_data.document_type}</p>
              <p><strong>{t('subtype')}:</strong> {result.result.extracted_data.document_subtype || '—'}</p>
              <p><strong>{t('parties')}:</strong> {result.result.extracted_data.parties?.join(', ') || '—'}</p>
              <p><strong>{t('amount')}:</strong> {result.result.extracted_data.total_amount ? `${result.result.extracted_data.total_amount.toLocaleString('ru-RU')} ${result.result.extracted_data.currency || 'RUB'}` : t('notSpecified')}</p>
            </div>

            {/* Risks */}
            <div className="result-card">
              <h3>⚠️ {t('risks')} ({result.result.risk_flags?.length || 0})</h3>
              {result.result.risk_flags?.map((flag: any, index: number) => (
                <div key={index} className={`risk-flag risk-${flag.level}`}>
                  <strong>{flag.level?.toUpperCase()} - {flag.category}</strong>
                  <p>{flag.description}</p>
                  <em>💡 {flag.suggestion}</em>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="result-card">
              <h3>✅ {t('recommendations')}</h3>
              <ul>
                {result.result.action_items?.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Summary */}
            <div className="result-card">
              <h3>📝 {t('summary')}</h3>
              <p>{result.result.summary}</p>
              <p><strong>{t('confidence')}:</strong> {(result.result.confidence_score * 100).toFixed(0)}%</p>
            </div>

            {/* Export Button */}
            <div className="export-section">
              <button onClick={handleExportPDF} className="export-btn">
                📥 {t('downloadPDF')}
              </button>
            </div>
          </div>
        )}

        {/* How It Works */}
        <section className="how-it-works">
          <h2>📋 {t('howItWorks')}</h2>
          <div className="steps">
            {[1, 2, 3].map((step) => (
              <div key={step} className="step">
                <div className="step-number">{step}</div>
                <h3>{t(`step${step}`)}</h3>
                <p>{t(`step${step}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="benefits">
          <h2>⭐ {t('whyDocubot')}</h2>
          <div className="benefits-grid">
            {[
              { icon: '⚡', key: 'fast' },
              { icon: '💰', key: 'cheap' },
              { icon: '🔒', key: 'confidential' },
              { icon: '🌙', key: 'alwaysOn' }
            ].map(({ icon, key }) => (
              <div key={key} className="benefit-card">
                <span className="benefit-icon">{icon}</span>
                <h3>{t(key)}</h3>
                <p>{t(`${key}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="faq">
          <h2>❓ {t('faq')}</h2>
          <div className="faq-list">
            {[1, 2, 3, 4].map((num) => (
              <details key={num} className="faq-item">
                <summary>{t(`faq${num}Q`)}</summary>
                <p>{t(`faq${num}A`)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-links">
            <a href="/history" className="footer-link">📊 {t('history')}</a>
            {/* 🔧 Исправлено: убраны пробелы в ссылке Telegram */}
            <a href="https://t.me/DocuBotAI_bot" target="_blank" rel="noopener noreferrer" className="footer-link">
              🤖 {t('telegramBot')}
            </a>
            <a href="#" className="footer-link">📧 {t('contacts')}</a>
          </div>
          <p className="footer-text">© 2026 DocuBot AI • {t('disclaimer')}</p>
        </footer>
      </main>

      {/* Styles */}
      <style jsx global>{`
        .App {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
        }
        .App-header {
          padding: 40px 20px;
          text-align: center;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
          position: relative;
        }
        .header-content {
          text-align: center;
          width: 100%;
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
        
        /* Custom File Upload - Global Styles */
        .file-input-hidden { display: none !important; }
        .custom-file-upload { margin: 25px auto; max-width: 450px; }
        .file-upload-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 18px 30px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px dashed rgba(0, 217, 255, 0.4);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          user-select: none;
        }
        .file-upload-label:hover {
          background: rgba(0, 217, 255, 0.1);
          border-color: rgba(0, 217, 255, 0.7);
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(0, 217, 255, 0.25);
        }
        .upload-icon { font-size: 1.6em; flex-shrink: 0; }
        .upload-text { color: #ffffff; font-size: 1.05em; font-weight: 500; line-height: 1.4; }
        
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
        
        .how-it-works, .benefits { padding: 40px 20px; text-align: center; }
        .how-it-works h2, .benefits h2 { color: #00d9ff; margin-bottom: 30px; font-size: 1.8em; }
        .steps { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .step {
          background: rgba(255, 255, 255, 0.05);
          padding: 25px;
          border-radius: 15px;
          max-width: 250px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .step-number {
          width: 50px; height: 50px;
          background: linear-gradient(90deg, #00d9ff, #00ff88);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold; font-size: 1.5em; color: #1a1a2e;
          margin: 0 auto 15px;
        }
        .step h3 { margin: 10px 0; color: #fff; }
        .step p { color: #888; font-size: 0.95em; margin: 0; }
        
        .benefits-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          max-width: 900px;
          margin: 0 auto;
        }
        .benefit-card {
          background: rgba(255, 255, 255, 0.05);
          padding: 25px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: transform 0.2s;
        }
        .benefit-card:hover { transform: translateY(-5px); }
        .benefit-icon { font-size: 2em; display: block; margin-bottom: 10px; }
        .benefit-card h3 { margin: 10px 0; color: #fff; }
        .benefit-card p { color: #888; font-size: 0.95em; margin: 0; }
        
        .faq { padding: 40px 20px; max-width: 700px; margin: 0 auto; }
        .faq h2 { color: #00d9ff; text-align: center; margin-bottom: 30px; font-size: 1.8em; }
        .faq-list { display: flex; flex-direction: column; gap: 15px; }
        .faq-item {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }
        .faq-item summary {
          padding: 15px 20px;
          cursor: pointer;
          font-weight: 500;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after {
          content: '▼';
          margin-left: auto;
          font-size: 0.8em;
          transition: transform 0.2s;
        }
        .faq-item[open] summary::after { transform: rotate(180deg); }
        .faq-item p { padding: 0 20px 20px; color: #888; margin: 0; line-height: 1.5; }
        .faq-item p strong { color: #fff; }
        
        .footer {
          padding: 40px 20px;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: 40px;
        }
        .footer-links { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
        .footer-link { color: #00d9ff; text-decoration: none; transition: color 0.2s; }
        .footer-link:hover { color: #00ff88; }
        .footer-text { color: #666; font-size: 0.9em; margin: 0; }
        
        .export-section { text-align: center; margin: 30px 0; }
        .export-btn {
          background: linear-gradient(90deg, #00d9ff, #00ff88);
          color: #1a1a2e;
          border: none;
          padding: 15px 40px;
          font-size: 1.1em;
          font-weight: bold;
          border-radius: 30px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .export-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 217, 255, 0.4);
        }
        
        @media (max-width: 768px) {
          .steps { flex-direction: column; align-items: center; }
          .benefits-grid { grid-template-columns: 1fr; }
          .App-header { flex-direction: column; gap: 15px; padding: 30px 20px 20px !important; }
          .App-header h1 { font-size: 1.8em !important; margin: 0 !important; }
          .export-btn { width: 100%; max-width: 300px; }
          .results { font-size: 14px; }
          .result-card { padding: 15px; }
        }
        
        @media (max-width: 600px) {
          .result-card { padding: 20px; }
          .result-card h3 { font-size: 1.2em; }
        }
        
        @media print {
          .App-header, .upload-section, .how-it-works, .benefits, .faq, .footer, .export-section { display: none !important; }
          .results { display: block !important; background: white !important; color: black !important; padding: 20px; }
          .result-card { background: white !important; border: 1px solid #ddd !important; page-break-inside: avoid; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}