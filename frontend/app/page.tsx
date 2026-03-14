'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Auth from '../components/Auth';

// 🔧 Production URL
const API_URL = 'https://docubot-production-043f.up.railway.app';
// const API_URL = 'http://localhost:10000';
// const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

export default function Home() {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  
  // 🔐 Auth state
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUserData(savedToken);
    }
  }, []);

  const fetchUserData = async (authToken: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    fetchUserData(newToken);
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      setCurrentAnalysisId(null);
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

      const headers: any = { 'Content-Type': 'multipart/form-data' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(`${API_URL}/api/analyze`, formData, { headers });
      setResult(response.data);
      
      if (response.data.status === 'success') {
        try {
          const historyHeaders: any = {};
          if (token) historyHeaders['Authorization'] = `Bearer ${token}`;
          
          const historyResponse = await fetch(`${API_URL}/api/history?limit=1`, { headers: historyHeaders });
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
    const analysisId = currentAnalysisId;
    if (!analysisId) {
      alert('❌ No analysis available');
      return;
    }

    const btn = document.querySelector('.export-btn') as HTMLButtonElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Generating PDF...';
    btn.disabled = true;

    try {
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/generate-pdf/${analysisId}`, { headers });
      
      if (!response.ok) throw new Error('Failed to generate PDF');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `docubot-analysis-${analysisId}-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF error:', error);
      alert('❌ Error creating PDF');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  };

  return (
    <div className="App">
      {/* Header */}
      <header className="App-header">
        <div className="header-content">
          <h1>🤖 {t('title') || 'DocuBot AI'}</h1>
          <p>{t('subtitle') || 'AI-агент для анализа документов'}</p>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <LanguageSwitcher />
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#888', fontSize: '0.9em' }}>
                👤 {user?.full_name || user?.email}
              </span>
              <button className="auth-btn" onClick={handleLogout}>
                🚪 Выйти
              </button>
            </div>
          ) : (
            <button className="auth-btn" onClick={() => setShowAuthModal(true)}>
              🔐 {t('login') || 'Войти'}
            </button>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={modalStyles.overlay} onClick={() => setShowAuthModal(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Auth onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="upload-section">
          <h2>📄 {t('uploadTitle') || 'Загрузите документ'}</h2>
          <p style={{ color: '#888', marginBottom: '15px' }}>{t('uploadSubtitle') || 'PDF до 10 МБ'}</p>
          
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
                {file ? `✅ ${file.name}` : (t('chooseFile') || 'Выберите файл')}
              </span>
            </label>
          </div>
          
          <button onClick={handleUpload} disabled={loading || !file} className="upload-btn">
            {loading ? (t('analyzing') || 'Анализ...') : (t('analyzeButton') || 'Анализировать')}
          </button>
        </div>

        {error && <div className="error-message">❌ {error}</div>}

        {result?.status === 'success' && (
          <div className="results">
            <h2>📊 {t('resultsTitle') || 'Результаты анализа'}</h2>
            
            <div className="result-card">
              <h3>📋 {t('basicInfo') || 'Основная информация'}</h3>
              <p><strong>{t('type') || 'Тип'}: </strong> {result.result?.extracted_data?.document_type || '—'}</p>
              <p><strong>{t('subtype') || 'Подтип'}: </strong> {result.result?.extracted_data?.document_subtype || '—'}</p>
              <p><strong>{t('parties') || 'Стороны'}: </strong> {result.result?.extracted_data?.parties?.join(', ') || '—'}</p>
              <p><strong>{t('amount') || 'Сумма'}: </strong> {result.result?.extracted_data?.total_amount ? `${result.result.extracted_data.total_amount.toLocaleString('ru-RU')} ${result.result.extracted_data.currency || 'RUB'}` : (t('notSpecified') || 'Не указана')}</p>
            </div>

            <div className="result-card">
              <h3>⚠️ {t('risks') || 'Риски'} ({result.result?.risk_flags?.length || 0})</h3>
              {result.result?.risk_flags?.map((flag: any, index: number) => (
                <div key={index} className={`risk-flag risk-${flag.level}`}>
                  <strong>{flag.level?.toUpperCase()} - {flag.category}</strong>
                  <p>{flag.description}</p>
                  <em>💡 {flag.suggestion}</em>
                </div>
              ))}
            </div>

            <div className="result-card">
              <h3>✅ {t('recommendations') || 'Рекомендации'}</h3>
              <ul>
                {result.result?.action_items?.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="result-card">
              <h3>📝 {t('summary') || 'Резюме'}</h3>
              <p>{result.result?.summary || '—'}</p>
              <p><strong>{t('confidence') || 'Точность'}: </strong> {result.result?.confidence_score ? (result.result.confidence_score * 100).toFixed(0) + '%' : '—'}</p>
            </div>

            <div className="export-section">
              <button onClick={handleExportPDF} className="export-btn">
                📥 {t('downloadPDF') || 'Скачать PDF отчёт'}
              </button>
            </div>
          </div>
        )}

        <section className="how-it-works">
          <h2>📋 {t('howItWorks') || 'Как это работает?'}</h2>
          <div className="steps">
            {[1, 2, 3].map((step) => (
              <div key={step} className="step">
                <div className="step-number">{step}</div>
                <h3>{t(`step${step}`) || `Шаг ${step}`}</h3>
                <p>{t(`step${step}Desc`) || `Описание шага ${step}`}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="benefits">
          <h2>⭐ {t('whyDocubot') || 'Почему DocuBot?'}</h2>
          <div className="benefits-grid">
            {[
              { icon: '⚡', key: 'fast' },
              { icon: '💰', key: 'cheap' },
              { icon: '🔒', key: 'confidential' },
              { icon: '🌙', key: 'alwaysOn' }
            ].map(({ icon, key }) => (
              <div key={key} className="benefit-card">
                <span className="benefit-icon">{icon}</span>
                <h3>{t(key) || key}</h3>
                <p>{t(`${key}Desc`) || ''}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="faq">
          <h2>❓ {t('faq') || 'Часто задаваемые вопросы'}</h2>
          <div className="faq-list">
            {[1, 2, 3, 4].map((num) => (
              <details key={num} className="faq-item">
                <summary>{t(`faq${num}Q`) || `Вопрос ${num}`}</summary>
                <p>{t(`faq${num}A`) || `Ответ ${num}`}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="footer">
          <div className="footer-links">
            <a href="/history" className="footer-link">📊 {t('history') || 'История анализов'}</a>
            <a href="https://t.me/DocuBotAI_bot" target="_blank" rel="noopener noreferrer" className="footer-link">
              🤖 {t('telegramBot') || 'Telegram бот'}
            </a>
            <a href="#contacts" className="footer-link">📧 {t('contacts') || 'Контакты'}</a>
          </div>
          <p className="footer-text">© 2026 DocuBot AI • {t('disclaimer') || 'Не является юридической консультацией'}</p>
        </footer>
      </main>

      <style jsx global>{`
        .App { min-height: 100vh; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; font-family: sans-serif; }
        .App-header { padding: 40px 20px; text-align: center; background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; gap: 15px; position: relative; }
        .header-content { text-align: center; width: 100%; }
        .App-header h1 { margin: 0; font-size: 2.5em; background: linear-gradient(90deg, #00d9ff, #00ff88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .App-header p { color: #888; margin-top: 10px; }
        .auth-btn { background: linear-gradient(90deg, #00d9ff, #00ff88); color: #1a1a2e; border: none; padding: 10px 20px; font-size: 1em; font-weight: bold; border-radius: 8px; cursor: pointer; transition: transform 0.2s; }
        .auth-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,217,255,0.3); }
        .main-content { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
        .upload-section { background: rgba(255,255,255,0.05); padding: 30px; border-radius: 15px; text-align: center; margin-bottom: 30px; border: 1px solid rgba(255,255,255,0.1); }
        .upload-section h2 { margin-top: 0; color: #00d9ff; }
        .file-input-hidden { display: none !important; }
        .custom-file-upload { margin: 25px auto; max-width: 450px; }
        .file-upload-label { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 18px 30px; background: rgba(255,255,255,0.05); border: 2px dashed rgba(0,217,255,0.4); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; }
        .file-upload-label:hover { background: rgba(0,217,255,0.1); border-color: rgba(0,217,255,0.7); transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,217,255,0.25); }
        .upload-icon { font-size: 1.6em; }
        .upload-text { color: #fff; font-size: 1.05em; }
        .upload-btn { background: linear-gradient(90deg, #00d9ff, #00ff88); color: #1a1a2e; border: none; padding: 15px 40px; font-size: 1.1em; font-weight: bold; border-radius: 30px; cursor: pointer; }
        .upload-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,217,255,0.3); }
        .upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-message { background: rgba(255,0,0,0.2); border: 1px solid rgba(255,0,0,0.5); padding: 20px; border-radius: 10px; margin-bottom: 30px; text-align: center; }
        .results { animation: fadeIn 0.5s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .result-card { background: rgba(255,255,255,0.05); padding: 25px; border-radius: 15px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); }
        .result-card h3 { margin-top: 0; color: #00d9ff; }
        .risk-flag { padding: 15px; margin: 10px 0; border-radius: 10px; border-left: 4px solid; }
        .risk-high { background: rgba(255,0,0,0.2); border-color: #ff4444; }
        .risk-medium { background: rgba(255,165,0,0.2); border-color: #ffa500; }
        .risk-low { background: rgba(0,255,136,0.2); border-color: #00ff88; }
        .how-it-works, .benefits, .faq { padding: 40px 20px; text-align: center; }
        .how-it-works h2, .benefits h2, .faq h2 { color: #00d9ff; margin-bottom: 30px; font-size: 1.8em; }
        .steps { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
        .step { background: rgba(255,255,255,0.05); padding: 25px; border-radius: 15px; max-width: 250px; }
        .step-number { width: 50px; height: 50px; background: linear-gradient(90deg, #00d9ff, #00ff88); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5em; color: #1a1a2e; margin: 0 auto 15px; }
        .step h3 { margin: 10px 0; color: #fff; }
        .step p { color: #888; margin: 0; }
        .benefits-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 900px; margin: 0 auto; }
        .benefit-card { background: rgba(255,255,255,0.05); padding: 25px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1); transition: transform 0.2s; }
        .benefit-card:hover { transform: translateY(-5px); }
        .benefit-icon { font-size: 2em; display: block; margin-bottom: 10px; }
        .benefit-card h3 { margin: 10px 0; color: #fff; }
        .benefit-card p { color: #888; font-size: 0.95em; margin: 0; }
        .faq { max-width: 700px; margin: 0 auto; }
        .faq-list { display: flex; flex-direction: column; gap: 15px; }
        .faq-item { background: rgba(255,255,255,0.05); border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); overflow: hidden; }
        .faq-item summary { padding: 15px 20px; cursor: pointer; font-weight: 500; list-style: none; display: flex; align-items: center; gap: 10px; }
        .faq-item summary::-webkit-details-marker { display: none; }
        .faq-item summary::after { content: '▼'; margin-left: auto; font-size: 0.8em; transition: transform 0.2s; }
        .faq-item[open] summary::after { transform: rotate(180deg); }
        .faq-item p { padding: 0 20px 20px; color: #888; margin: 0; line-height: 1.5; }
        .faq-item p strong { color: #fff; }
        .footer { padding: 40px 20px; text-align: center; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 40px; }
        .footer-links { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }
        .footer-link { color: #00d9ff; text-decoration: none; transition: color 0.2s; }
        .footer-link:hover { color: #00ff88; }
        .footer-text { color: #666; }
        .export-section { text-align: center; margin: 30px 0; }
        .export-btn { background: linear-gradient(90deg, #00d9ff, #00ff88); color: #1a1a2e; border: none; padding: 15px 40px; font-size: 1.1em; font-weight: bold; border-radius: 30px; cursor: pointer; }
        @media (max-width: 768px) { .steps { flex-direction: column; align-items: center; } .benefits-grid { grid-template-columns: 1fr; } .App-header h1 { font-size: 1.8em; } }
      `}</style>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px'
  }
};