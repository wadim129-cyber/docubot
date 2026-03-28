// frontend/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import Auth from '../components/Auth';
import StatsChart from '../components/StatsChart'; // ✅ Импорт графика

// 🔧 Production URL
const API_URL = 'https://docubot-production-043f.up.railway.app';
// const API_URL = 'http://localhost:10000';

export default function Home() {
  const { t } = useLanguage();
  
  // --- Состояния файла и анализа ---
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<number | null>(null);
  
  // --- Состояния авторизации ---
  const [token, setToken] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  // --- ✅ НОВОЕ: Состояния статистики ---
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // --- Загрузка данных при старте ---
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      fetchUserData(savedToken);
    }
    // Загружаем статистику при монтировании
    fetchStats(savedToken || undefined);
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

  // --- ✅ НОВОЕ: Функция загрузки статистики ---
  const fetchStats = async (authToken?: string) => {
    try {
      setStatsLoading(true);
      const headers: any = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      
      const res = await axios.get(`${API_URL}/api/stats`, { headers });
      if (res.data?.status === 'success') {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleLogin = (newToken: string) => {
    setToken(newToken);
    fetchUserData(newToken);
    setShowAuthModal(false);
    // Обновляем статистику после входа
    fetchStats(newToken);
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
    console.log('🚀 Starting analysis for:', file.name);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const headers: any = { 'Content-Type': 'multipart/form-data' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      console.log('📡 Request URL:', `${API_URL}/api/analyze`);
      
      const response = await axios.post(`${API_URL}/api/analyze`, formData, { 
        headers,
        validateStatus: function (status) {
          return status < 500;
        }
      });

      console.log('📦 Response status:', response.status);

      if (response.status !== 200) {
        throw new Error(response.data?.error || `Server error: ${response.status}`);
      }

      setResult(response.data);
      
      if (response.data.status === 'success') {
        // Обновляем статистику после успешного анализа
        fetchStats(token || undefined);
      }
      
    } catch (err: any) {
      console.error('❌ Analysis failed:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      
      setError(err.response?.data?.error || err.message || t('analysisError'));
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
    // ✅ Добавлены классы для тёмной темы: bg/текст
    <div className="App min-h-screen bg-[#1a1a2e] dark:bg-gray-900 text-white dark:text-gray-100 transition-colors duration-300">
      
      {/* Header */}
      <header className="App-header bg-white/5 dark:bg-gray-800 border-b border-white/10 dark:border-gray-700">
        <div className="header-content">
          <h1 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
            🤖 {t('title') || 'DocuBot AI'}
          </h1>
          <p className="text-gray-400 dark:text-gray-500">{t('subtitle') || 'AI-агент для анализа документов'}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <LanguageSwitcher />
          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="text-gray-400 text-sm">
                👤 {user?.full_name || user?.email}
              </span>
              <button className="auth-btn bg-gradient-to-r from-cyan-400 to-emerald-400 text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all" onClick={handleLogout}>
                🚪 {t('logout') || 'Выйти'}
              </button>
            </div>
          ) : (
            <button className="auth-btn bg-gradient-to-r from-cyan-400 to-emerald-400 text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all" onClick={() => setShowAuthModal(true)}>
              🔐 {t('login') || 'Войти'}
            </button>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={modalStyles.overlay} onClick={() => setShowAuthModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-[#1a1a2e] dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl border border-white/10">
            <Auth onLogin={handleLogin} onClose={() => setShowAuthModal(false)} />
          </div>
        </div>
      )}

      <main className="main-content max-w-5xl mx-auto px-4 py-8">
        
        {/* ✅ НОВОЕ: Секция статистики (Графики) */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400">📊 Статистика</h2>
            {statsLoading && <span className="text-sm text-gray-400 animate-pulse">Загрузка данных...</span>}
          </div>
          
          {stats?.status === 'success' ? (
            <StatsChart 
              data={{
                by_type: stats.by_type,
                avg_confidence: stats.avg_confidence,
                total_risks: stats.total_risks,
                total_documents: stats.total_documents,
              }} 
            />
          ) : !statsLoading ? (
            <div className="bg-white/5 dark:bg-gray-800 rounded-xl p-6 text-center border border-white/10 text-gray-400">
              Нет данных для отображения. Проведите первый анализ!
            </div>
          ) : null}
        </section>

        {/* Загрузка документа */}
        <div className="upload-section bg-white/5 dark:bg-gray-800 p-8 rounded-2xl text-center mb-8 border border-white/10 shadow-xl">
          <h2 className="text-2xl font-bold text-cyan-400 mb-2">📄 {t('uploadTitle') || 'Загрузите документ'}</h2>
          <p className="text-gray-400 mb-6">{t('uploadSubtitle') || 'PDF до 10 МБ'}</p>
          
          <div className="custom-file-upload max-w-md mx-auto">
            <input
              id="file-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="file-input-hidden"
            />
            <label htmlFor="file-upload" className="file-upload-label flex flex-col items-center justify-center p-8 border-2 border-dashed border-cyan-500/50 rounded-xl cursor-pointer hover:bg-cyan-500/10 hover:border-cyan-400 transition-all group">
              <span className="upload-icon text-4xl mb-3 group-hover:scale-110 transition-transform">📁</span>
              <span className="upload-text text-lg font-medium text-white">
                {file ? `✅ ${file.name}` : (t('chooseFile') || 'Выберите файл')}
              </span>
            </label>
          </div>
          
          <button onClick={handleUpload} disabled={loading || !file} className="upload-btn mt-6 bg-gradient-to-r from-cyan-400 to-emerald-400 text-[#1a1a2e] px-8 py-3 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? (t('analyzing') || 'Анализ...') : (t('analyzeButton') || 'Анализировать')}
          </button>
        </div>

        {error && <div className="error-message bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl mb-6 text-center">❌ {error}</div>}

        {/* Результаты анализа */}
        {result?.status === 'success' && (
          <div className="results animate-fade-in-up">
            <h2 className="text-2xl font-bold text-cyan-400 mb-6">📊 {t('resultsTitle') || 'Результаты анализа'}</h2>
            
            {/* Основная информация */}
            <div className="result-card bg-white/5 dark:bg-gray-800 p-6 rounded-xl mb-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">📋 {t('basicInfo') || 'Основная информация'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <p><strong className="text-gray-300">{t('type') || 'Тип'}: </strong> <span className="text-white">{result.result?.extracted_data?.document_type || '—'}</span></p>
                <p><strong className="text-gray-300">{t('subtype') || 'Подтип'}: </strong> <span className="text-white">{result.result?.extracted_data?.document_subtype || '—'}</span></p>
                <p className="md:col-span-2"><strong className="text-gray-300">{t('parties') || 'Стороны'}: </strong> 
                  <span className="text-white">
                    {result.result?.extracted_data?.parties?.map((p: any, i: number) => (
                      <span key={i} className="inline-block bg-white/10 px-2 py-1 rounded mr-2 mb-1">{p.name}{p.role && ` (${p.role})`}</span>
                    )) || '—'}
                  </span>
                </p>
                <p><strong className="text-gray-300">{t('amount') || 'Сумма'}: </strong> 
                  <span className="text-emerald-400 font-bold">
                    {result.result?.extracted_data?.financial_terms?.total_amount 
                      ? `${result.result.extracted_data.financial_terms.total_amount.toLocaleString('ru-RU')} ${result.result.extracted_data.financial_terms.currency || 'RUB'}` 
                      : (t('notSpecified') || 'Не указана')}
                  </span>
                </p>
              </div>
            </div>

            {/* Даты */}
            {result.result?.extracted_data?.dates && Object.values(result.result.extracted_data.dates).some(v => v) && (
              <div className="result-card bg-white/5 dark:bg-gray-800 p-6 rounded-xl mb-4 border border-white/10">
                <h3 className="text-lg font-bold text-cyan-400 mb-3">📅 Даты</h3>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
                  {result.result.extracted_data.dates.signature && <p><strong>Подпись:</strong> {result.result.extracted_data.dates.signature}</p>}
                  {result.result.extracted_data.dates.start_date && <p><strong>Начало:</strong> {result.result.extracted_data.dates.start_date}</p>}
                  {result.result.extracted_data.dates.end_date && <p><strong>Окончание:</strong> {result.result.extracted_data.dates.end_date}</p>}
                  {result.result.extracted_data.dates.payment_due && <p><strong>Оплата до:</strong> {result.result.extracted_data.dates.payment_due}</p>}
                </div>
              </div>
            )}

            {/* Недостающие реквизиты */}
            {result.result?.extracted_data?.missing_requisites && result.result.extracted_data.missing_requisites.length > 0 && (
              <div className="result-card bg-orange-500/10 border border-orange-500/30 p-6 rounded-xl mb-4">
                <h3 className="text-lg font-bold text-orange-400 mb-3">⚠️ Недостающие реквизиты</h3>
                <ul className="list-disc list-inside text-orange-200">
                  {result.result.extracted_data.missing_requisites.map((req: string, i: number) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Риски */}
            <div className="result-card bg-white/5 dark:bg-gray-800 p-6 rounded-xl mb-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">⚠️ {t('risks') || 'Риски'} ({result.result?.risk_flags?.length || 0})</h3>
              <div className="space-y-3">
                {result.result?.risk_flags?.map((flag: any, index: number) => (
                  <div key={index} className={`risk-flag p-4 rounded-lg border-l-4 ${
                    flag.level === 'high' || flag.level === 'critical' ? 'bg-red-500/10 border-red-500' : 
                    flag.level === 'medium' ? 'bg-yellow-500/10 border-yellow-500' : 
                    'bg-green-500/10 border-green-500'
                  }`}>
                    {flag.title && <strong className="block mb-1 text-white">{flag.title}</strong>}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        flag.level === 'high' || flag.level === 'critical' ? 'bg-red-500 text-white' : 
                        flag.level === 'medium' ? 'bg-yellow-500 text-black' : 
                        'bg-green-500 text-white'
                      }`}>{flag.level}</span>
                      <span className="text-gray-400 text-sm">{flag.category}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{flag.description}</p>
                    {flag.suggestion && <p className="text-emerald-400 text-sm mt-2 italic">💡 {flag.suggestion}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Рекомендации */}
            <div className="result-card bg-white/5 dark:bg-gray-800 p-6 rounded-xl mb-4 border border-white/10">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">✅ {t('recommendations') || 'Рекомендации'}</h3>
              <ul className="space-y-3">
                {result.result?.action_items?.map((item: any, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-gray-300">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                      item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <span>{item.action}</span>
                    {item.deadline && <span className="text-gray-500 text-xs ml-auto whitespace-nowrap">⏰ {item.deadline}</span>}
                  </li>
                ))}
              </ul>
            </div>

            {/* Резюме */}
            <div className="result-card bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 p-6 rounded-xl mb-6 border border-cyan-500/20">
              <h3 className="text-lg font-bold text-cyan-400 mb-3">📝 {t('summary') || 'Резюме'}</h3>
              <p className="text-gray-200 leading-relaxed mb-4">{result.result?.summary || '—'}</p>
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div>
                  <strong className="text-gray-300">{t('confidence') || 'Точность'}: </strong> 
                  <span className={`font-bold ${
                    (result.result?.confidence_score || 0) > 0.8 ? 'text-emerald-400' : 
                    (result.result?.confidence_score || 0) > 0.5 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {result.result?.confidence_score ? (result.result.confidence_score * 100).toFixed(0) + '%' : '—'}
                  </span>
                </div>
                {result.result?.analysis_notes && <p className="text-gray-500 text-xs italic">📌 {result.result.analysis_notes}</p>}
              </div>
            </div>

            {/* Кнопка экспорта */}
            <div className="export-section text-center">
              <button onClick={handleExportPDF} className="export-btn bg-gradient-to-r from-cyan-400 to-emerald-400 text-[#1a1a2e] px-8 py-3 rounded-full font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                📥 {t('downloadPDF') || 'Скачать PDF отчёт'}
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        <section className="how-it-works py-12 text-center">
          <h2 className="text-2xl font-bold text-cyan-400 mb-8">📋 {t('howItWorks') || 'Как это работает?'}</h2>
          <div className="steps flex flex-col md:flex-row gap-6 justify-center">
            {[1, 2, 3].map((step) => (
              <div key={step} className="step bg-white/5 dark:bg-gray-800 p-6 rounded-xl max-w-xs border border-white/10 hover:border-cyan-500/50 transition-colors">
                <div className="step-number w-12 h-12 mx-auto bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full flex items-center justify-center font-bold text-[#1a1a2e] text-xl mb-4 shadow-lg shadow-cyan-500/20">
                  {step}
                </div>
                <h3 className="text-white font-bold mb-2">{t(`step${step}`) || `Шаг ${step}`}</h3>
                <p className="text-gray-400 text-sm">{t(`step${step}Desc`) || `Описание шага ${step}`}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="benefits py-12 text-center bg-white/5 dark:bg-gray-800/50 rounded-2xl">
          <h2 className="text-2xl font-bold text-cyan-400 mb-8">⭐ {t('whyDocubot') || 'Почему DocuBot?'}</h2>
          <div className="benefits-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto px-4">
            {[
              { icon: '⚡', key: 'fast', color: 'from-yellow-400 to-orange-500' },
              { icon: '💰', key: 'cheap', color: 'from-emerald-400 to-green-500' },
              { icon: '🔒', key: 'confidential', color: 'from-blue-400 to-indigo-500' },
              { icon: '🌙', key: 'alwaysOn', color: 'from-purple-400 to-pink-500' }
            ].map(({ icon, key, color }) => (
              <div key={key} className="benefit-card bg-white/5 dark:bg-gray-800 p-6 rounded-xl border border-white/10 hover:border-cyan-500/30 transition-all group">
                <span className={`benefit-icon text-3xl block mb-3 bg-gradient-to-r ${color} bg-clip-text text-transparent group-hover:scale-110 transition-transform`}>{icon}</span>
                <h3 className="text-white font-bold mb-2">{t(key) || key}</h3>
                <p className="text-gray-400 text-sm">{t(`${key}Desc`) || ''}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="faq py-12 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-cyan-400 mb-8 text-center">❓ {t('faq') || 'Часто задаваемые вопросы'}</h2>
          <div className="faq-list space-y-3">
            {[1, 2, 3, 4].map((num) => (
              <details key={num} className="faq-item bg-white/5 dark:bg-gray-800 rounded-lg border border-white/10 overflow-hidden group">
                <summary className="p-4 cursor-pointer font-medium text-gray-200 flex justify-between items-center hover:bg-white/5 transition-colors list-none">
                  <span>{t(`faq${num}Q`) || `Вопрос ${num}`}</span>
                  <span className="text-cyan-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed border-t border-white/5 pt-3">
                  {t(`faq${num}A`) || `Ответ ${num}`}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="footer py-8 text-center border-t border-white/10 mt-12">
          <div className="footer-links flex justify-center gap-6 mb-4 flex-wrap">
            <a href="/history" className="footer-link text-cyan-400 hover:text-emerald-400 transition-colors text-sm">📊 {t('history') || 'История анализов'}</a>
            <a href="https://t.me/DocuBotAI_bot" target="_blank" rel="noopener noreferrer" className="footer-link text-cyan-400 hover:text-emerald-400 transition-colors text-sm">
              🤖 {t('telegramBot') || 'Telegram бот'}
            </a>
            <a href="#contacts" className="footer-link text-cyan-400 hover:text-emerald-400 transition-colors text-sm">📧 {t('contacts') || 'Контакты'}</a>
          </div>
          <p className="footer-text text-gray-600 text-xs">© 2026 DocuBot AI • {t('disclaimer') || 'Не является юридической консультацией'}</p>
        </footer>
      </main>

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-up { animation: fadeIn 0.5s ease-out forwards; }
        
        /* Скроллбар */
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #1a1a2e; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #475569; }
        
        /* Детали/Аккордеон */
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }
      `}</style>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
    backdropFilter: 'blur(4px)'
  }
};