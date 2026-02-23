'use client';

import { useLanguage } from '../context/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div style={{ display: 'flex', gap: '10px', padding: '10px' }}>
      <button
        onClick={() => setLanguage('ru')}
        style={{
          padding: '8px 16px',
          background: language === 'ru' ? '#0d9488' : '#334155',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: language === 'ru' ? 'bold' : 'normal'
        }}
      >
        RU
      </button>
      <button
        onClick={() => setLanguage('en')}
        style={{
          padding: '8px 16px',
          background: language === 'en' ? '#0d9488' : '#334155',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: language === 'en' ? 'bold' : 'normal'
        }}
      >
        EN
      </button>
    </div>
  );
}