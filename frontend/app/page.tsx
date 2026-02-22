'use client';

import { useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';

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
 const handleExportPDF = () => {
  if (!result || result.status !== 'success') return;
  
  const doc = new jsPDF();
  const data = result.result;
  
  // Добавляем поддержку кириллицы через кастомный шрифт
  // Используем стандартный шрифт с кодировкой Windows-1251
  doc.addFileToVFS('Roboto-Regular.ttf', '');
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  
  // Временное решение: используем транслитерацию или упрощённый текст
  const cyrillicText = (text: string) => {
    // Простая замена для базовой поддержки
    return text;
  };
  
  // Заголовок
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('DocuBot AI - Analysis Results', 105, 20, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Date: ${new Date().toLocaleDateString('ru-RU')}`, 105, 30, { align: 'center' });
  
  let yPos = 55;
  
  // Основная информация
  doc.setTextColor(0, 217, 255);
  doc.setFontSize(14);
  doc.text('Basic Information', 14, yPos);
  yPos += 10;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Document Type: ${data.extracted_data.document_type}`, 14, yPos);
  yPos += 6;
  doc.text(`Subtype: ${data.extracted_data.document_subtype || 'N/A'}`, 14, yPos);
  yPos += 6;
  doc.text(`Parties: ${data.extracted_data.parties?.join(', ') || 'N/A'}`, 14, yPos);
  yPos += 6;
  doc.text(`Amount: ${data.extracted_data.total_amount ? `${data.extracted_data.total_amount.toLocaleString('ru-RU')} ${data.extracted_data.currency || 'RUB'}` : 'Not specified'}`, 14, yPos);
  yPos += 10;
  
  // Финансовые условия
  if (data.extracted_data.financial_terms && Object.values(data.extracted_data.financial_terms).some(v => v)) {
    doc.setTextColor(0, 217, 255);
    doc.setFontSize(14);
    doc.text('Financial Terms', 14, yPos);
    yPos += 10;
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    if (data.extracted_data.financial_terms.interest_rate) {
      doc.text(`Interest Rate: ${data.extracted_data.financial_terms.interest_rate}`, 14, yPos);
      yPos += 6;
    }
    if (data.extracted_data.financial_terms.loan_term) {
      doc.text(`Term: ${data.extracted_data.financial_terms.loan_term}`, 14, yPos);
      yPos += 6;
    }
    if (data.extracted_data.financial_terms.penalties) {
      doc.text(`Penalties: ${data.extracted_data.financial_terms.penalties}`, 14, yPos);
      yPos += 6;
    }
    yPos += 5;
  }
  
  // Риски
  doc.setTextColor(255, 165, 0);
  doc.setFontSize(14);
  doc.text(`Risks (${data.risk_flags?.length || 0})`, 14, yPos);
  yPos += 10;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  if (data.risk_flags && data.risk_flags.length > 0) {
    data.risk_flags.forEach((flag: any) => {
      const riskText = `${flag.level?.toUpperCase()} - ${flag.category}: ${flag.description}`;
      const splitText = doc.splitTextToSize(riskText, 180);
      doc.text(splitText, 14, yPos);
      yPos += splitText.length * 6;
    });
  } else {
    doc.text('No risks detected', 14, yPos);
    yPos += 6;
  }
  yPos += 5;
  
  // Рекомендации
  doc.setTextColor(0, 255, 136);
  doc.setFontSize(14);
  doc.text('Recommendations', 14, yPos);
  yPos += 10;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  if (data.action_items && data.action_items.length > 0) {
    data.action_items.forEach((item: string, index: number) => {
      doc.text(`${index + 1}. ${item}`, 14, yPos);
      yPos += 6;
    });
  } else {
    doc.text('No recommendations', 14, yPos);
    yPos += 6;
  }
  yPos += 5;
  
  // Резюме
  doc.setTextColor(0, 217, 255);
  doc.setFontSize(14);
  doc.text('Summary', 14, yPos);
  yPos += 10;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const summaryText = doc.splitTextToSize(data.summary || 'No summary', 180);
  doc.text(summaryText, 14, yPos);
  yPos += summaryText.length * 6 + 5;
  
  // Уверенность
  doc.text(`AI Confidence: ${(data.confidence_score * 100).toFixed(0)}%`, 14, yPos);
  yPos += 15;
  
  // Футер
  doc.setFillColor(26, 26, 46);
  const pageHeight = doc.internal.pageSize.height;
  doc.rect(0, pageHeight - 20, 210, 20, 'F');
  doc.setTextColor(136, 136, 136);
  doc.setFontSize(9);
  doc.text('© 2026 DocuBot AI • Not legal advice', 105, pageHeight - 10, { align: 'center' });
  doc.text('https://docubot-three.vercel.app', 105, pageHeight - 5, { align: 'center' });
  
  // Сохраняем PDF
  doc.save(`docubot-analysis-${new Date().toISOString().slice(0, 10)}.pdf`);
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
            
            {/* ===== ОСНОВНАЯ ИНФОРМАЦИЯ ===== */}
            <div className="result-card">
              <h3>📋 Основная информация</h3>
              <p><strong>Тип:</strong> {result.result.extracted_data.document_type}</p>
              <p><strong>Подтип:</strong> {result.result.extracted_data.document_subtype || '—'}</p>
              <p><strong>Стороны:</strong> {result.result.extracted_data.parties?.join(', ') || '—'}</p>
              <p><strong>Сумма:</strong> {result.result.extracted_data.total_amount ? `${result.result.extracted_data.total_amount.toLocaleString('ru-RU')} ${result.result.extracted_data.currency || 'RUB'}` : 'Не указана'}</p>
              
              {/* Даты - раскрывающийся блок */}
              {result.result.extracted_data.dates && Object.values(result.result.extracted_data.dates).some(v => v) && (
                <details className="details-block">
                  <summary>📅 Даты</summary>
                  <div className="details-content">
                    {result.result.extracted_data.dates.signature && <p><strong>Подписан:</strong> {result.result.extracted_data.dates.signature}</p>}
                    {result.result.extracted_data.dates.start_date && <p><strong>Начало:</strong> {result.result.extracted_data.dates.start_date}</p>}
                    {result.result.extracted_data.dates.end_date && <p><strong>Окончание:</strong> {result.result.extracted_data.dates.end_date}</p>}
                    {result.result.extracted_data.dates.payment_due && <p><strong>Оплата до:</strong> {result.result.extracted_data.dates.payment_due}</p>}
                  </div>
                </details>
              )}
            </div>

            {/* ===== ФИНАНСОВЫЕ УСЛОВИЯ ===== */}
            {result.result.extracted_data.financial_terms && Object.values(result.result.extracted_data.financial_terms).some(v => v) && (
              <div className="result-card">
                <h3>💰 Финансовые условия</h3>
                {result.result.extracted_data.financial_terms.interest_rate && (
                  <p className={result.result.extracted_data.financial_terms.interest_rate.includes('292%') ? 'warning-text' : ''}>
                    <strong>Процентная ставка:</strong> {result.result.extracted_data.financial_terms.interest_rate}
                  </p>
                )}
                {result.result.extracted_data.financial_terms.loan_term && <p><strong>Срок:</strong> {result.result.extracted_data.financial_terms.loan_term}</p>}
                {result.result.extracted_data.financial_terms.monthly_payment && <p><strong>Ежемесячный платёж:</strong> {result.result.extracted_data.financial_terms.monthly_payment.toLocaleString('ru-RU')} ₽</p>}
                {result.result.extracted_data.financial_terms.penalties && <p><strong>Штрафы:</strong> {result.result.extracted_data.financial_terms.penalties}</p>}
                {result.result.extracted_data.financial_terms.payment_schedule && <p><strong>График:</strong> {result.result.extracted_data.financial_terms.payment_schedule}</p>}
              </div>
            )}

            {/* ===== УСЛОВИЯ АРЕНДЫ ===== */}
            {result.result.extracted_data.rental_terms && Object.values(result.result.extracted_data.rental_terms).some(v => v) && (
              <div className="result-card">
                <h3>🏠 Условия аренды</h3>
                {result.result.extracted_data.rental_terms.monthly_rent && <p><strong>Аренда:</strong> {result.result.extracted_data.rental_terms.monthly_rent.toLocaleString('ru-RU')} ₽/мес</p>}
                {result.result.extracted_data.rental_terms.deposit && <p><strong>Залог:</strong> {result.result.extracted_data.rental_terms.deposit.toLocaleString('ru-RU')} ₽</p>}
                {result.result.extracted_data.rental_terms.utilities && <p><strong>Коммуналка:</strong> {result.result.extracted_data.rental_terms.utilities}</p>}
                {result.result.extracted_data.rental_terms.lease_duration && <p><strong>Срок:</strong> {result.result.extracted_data.rental_terms.lease_duration}</p>}
              </div>
            )}

            {/* ===== ДАННЫЕ ЗАЯВИТЕЛЯ ===== */}
            {result.result.extracted_data.applicant_info && Object.values(result.result.extracted_data.applicant_info).some(v => v) && (
              <details className="result-card details-block">
                <summary>👤 Данные заявителя</summary>
                <div className="details-content">
                  {result.result.extracted_data.applicant_info.full_name && <p><strong>ФИО:</strong> {result.result.extracted_data.applicant_info.full_name}</p>}
                  {result.result.extracted_data.applicant_info.birth_date && <p><strong>Дата рождения:</strong> {result.result.extracted_data.applicant_info.birth_date}</p>}
                  {result.result.extracted_data.applicant_info.passport && <p><strong>Паспорт:</strong> {result.result.extracted_data.applicant_info.passport}</p>}
                  {result.result.extracted_data.applicant_info.inn && <p><strong>ИНН:</strong> {result.result.extracted_data.applicant_info.inn}</p>}
                  {result.result.extracted_data.applicant_info.snils && <p><strong>СНИЛС:</strong> {result.result.extracted_data.applicant_info.snils}</p>}
                  {result.result.extracted_data.applicant_info.phone && <p><strong>Телефон:</strong> {result.result.extracted_data.applicant_info.phone}</p>}
                  {result.result.extracted_data.applicant_info.email && <p><strong>Email:</strong> {result.result.extracted_data.applicant_info.email}</p>}
                  {result.result.extracted_data.applicant_info.monthly_income && <p><strong>Доход:</strong> {result.result.extracted_data.applicant_info.monthly_income.toLocaleString('ru-RU')} ₽/мес</p>}
                  {result.result.extracted_data.applicant_info.employment && <p><strong>Работа:</strong> {result.result.extracted_data.applicant_info.employment}</p>}
                  {result.result.extracted_data.applicant_info.marital_status && <p><strong>Семейное положение:</strong> {result.result.extracted_data.applicant_info.marital_status}</p>}
                  {result.result.extracted_data.applicant_info.children_count !== undefined && <p><strong>Дети:</strong> {result.result.extracted_data.applicant_info.children_count}</p>}
                </div>
              </details>
            )}
            
            {/* ===== РИСКИ ===== */}
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

            {/* ===== РЕКОМЕНДАЦИИ ===== */}
            <div className="result-card">
              <h3>✅ Рекомендации</h3>
              <ul>
                {result.result.action_items?.map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>

            {/* ===== РЕЗЮМЕ ===== */}
            <div className="result-card">
              <h3>📝 Резюме</h3>
              <p>{result.result.summary}</p>
              <p><strong>Уверенность:</strong> {(result.result.confidence_score * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}
        {/* ===== КНОПКА ЭКСПОРТА ===== */}
        <div className="export-section">
          <button onClick={handleExportPDF} className="export-btn">
         📥 Скачать PDF отчёт
        </button>
      </div>

        {/* ===== СЕКЦИЯ: КАК ЭТО РАБОТАЕТ ===== */}
        <section className="how-it-works">
          <h2>📋 Как это работает?</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>📄 Загрузите документ</h3>
              <p>Выберите PDF файл: договор, счёт, акт или другой юридический документ</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>🤖 AI анализирует</h3>
              <p>Нейросеть читает документ, извлекает данные и ищет риски</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>📊 Получите результат</h3>
              <p>Увидите краткое резюме, риски и рекомендации на человеческом языке</p>
            </div>
          </div>
        </section>

        {/* ===== СЕКЦИЯ: ПРЕИМУЩЕСТВА ===== */}
        <section className="benefits">
          <h2>⭐ Почему DocuBot?</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <span className="benefit-icon">⚡</span>
              <h3>Быстро</h3>
              <p>Анализ за 5-10 секунд вместо 30 минут чтения</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">💰</span>
              <h3>Дёшево</h3>
              <p>Бесплатно для старта, дешевле чем консультация юриста</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">🔒</span>
              <h3>Конфиденциально</h3>
              <p>Ваши документы не передаются третьим лицам</p>
            </div>
            <div className="benefit-card">
              <span className="benefit-icon">🌙</span>
              <h3>24/7</h3>
              <p>Работает круглосуточно, без выходных и праздников</p>
            </div>
          </div>
        </section>

        {/* ===== СЕКЦИЯ: FAQ ===== */}
        <section className="faq">
          <h2>❓ Часто задаваемые вопросы</h2>
          <div className="faq-list">
            <details className="faq-item">
              <summary>📁 Какие форматы документов поддерживаете?</summary>
              <p>Сейчас поддерживаем только <strong>PDF</strong>. В планах: DOCX, изображения, сканы.</p>
            </details>
            <details className="faq-item">
              <summary>🎯 Насколько точен анализ?</summary>
              <p>Точность ~70-90% в зависимости от качества документа. Это <strong>помощник для первичного анализа</strong>, а не замена юриста.</p>
            </details>
            <details className="faq-item">
              <summary>⚖️ Это заменяет юриста?</summary>
              <p><strong>Нет.</strong> DocuBot помогает быстро оценить документ и найти "красные флаги". Для важных сделок всегда консультируйтесь с профессионалом.</p>
            </details>
            <details className="faq-item">
              <summary>🔐 Куда попадают мои документы?</summary>
              <p>Документы обрабатываются через Yandex Cloud API и не сохраняются на наших серверах. Мы не используем ваши данные для обучения моделей.</p>
            </details>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer className="footer">
          <div className="footer-links">
            <a href="/history" className="footer-link">📊 История анализов</a>
            <a href="https://t.me/DocuBotAI_bot" target="_blank" rel="noopener noreferrer" className="footer-link">🤖 Telegram бот</a>
            <a href="#" className="footer-link">📧 Контакты</a>
          </div>
          <p className="footer-text">© 2026 DocuBot AI • Не является юридической консультацией</p>
        </footer>
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
        
        /* ===== HOW IT WORKS ===== */
        .how-it-works {
          padding: 40px 20px;
          text-align: center;
        }
        .how-it-works h2 {
          color: #00d9ff;
          margin-bottom: 30px;
          font-size: 1.8em;
        }
        .steps {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .step {
          background: rgba(255, 255, 255, 0.05);
          padding: 25px;
          border-radius: 15px;
          max-width: 250px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .step-number {
          width: 50px;
          height: 50px;
          background: linear-gradient(90deg, #00d9ff, #00ff88);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.5em;
          color: #1a1a2e;
          margin: 0 auto 15px;
        }
        .step h3 { margin: 10px 0; color: #fff; }
        .step p { color: #888; font-size: 0.95em; margin: 0; }

        /* ===== BENEFITS ===== */
        .benefits {
          padding: 40px 20px;
          text-align: center;
        }
        .benefits h2 {
          color: #00d9ff;
          margin-bottom: 30px;
          font-size: 1.8em;
        }
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

        /* ===== FAQ ===== */
        .faq {
          padding: 40px 20px;
          max-width: 700px;
          margin: 0 auto;
        }
        .faq h2 {
          color: #00d9ff;
          text-align: center;
          margin-bottom: 30px;
          font-size: 1.8em;
        }
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
        .faq-item p {
          padding: 0 20px 20px;
          color: #888;
          margin: 0;
          line-height: 1.5;
        }
        .faq-item p strong { color: #fff; }

        /* ===== FOOTER ===== */
        .footer {
          padding: 40px 20px;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          margin-top: 40px;
        }
        .footer-links {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .footer-link {
          color: #00d9ff;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover { color: #00ff88; }
        .footer-text { color: #666; font-size: 0.9em; margin: 0; }

        /* ===== DETAILS BLOCK ===== */
        .details-block {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 10px;
          margin: 10px 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .details-block summary {
          padding: 12px 20px;
          cursor: pointer;
          font-weight: 500;
          list-style: none;
          display: flex;
          align-items: center;
          gap: 8px;
          color: #00d9ff;
        }
        .details-block summary::-webkit-details-marker { display: none; }
        .details-block summary::after {
          content: '▼';
          margin-left: auto;
          font-size: 0.8em;
          transition: transform 0.2s;
        }
        .details-block[open] summary::after { transform: rotate(180deg); }
        .details-content {
          padding: 0 20px 20px;
          color: #ccc;
        }
        .details-content p { margin: 8px 0; }
        
        /* ===== WARNING TEXT ===== */
        .warning-text {
          color: #ffa500;
          font-weight: 500;
        }
        
        /* ===== АДАПТИВНОСТЬ ===== */
        @media (max-width: 768px) {
          .steps { flex-direction: column; align-items: center; }
          .benefits-grid { grid-template-columns: 1fr; }
          .App-header h1 { font-size: 2em; }
        }
        @media (max-width: 600px) {
          .result-card { padding: 20px; }
          .result-card h3 { font-size: 1.2em; }
        }
                  /* ===== EXPORT BUTTON ===== */
        .export-section {
          text-align: center;
          margin: 30px 0;
        }
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
        .export-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}