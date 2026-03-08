'use client';
import { useLanguage } from '../context/LanguageContext';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div style={{ display: 'flex', gap: '5px' }}>
      <button
        onClick={() => setLanguage('ru')}
        style={{
          padding: '8px 12px',
          background: language === 'ru' ? '#0d9488' : '#2d3748',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        RU
      </button>
      <button
        onClick={() => setLanguage('en')}
        style={{
          padding: '8px 12px',
          background: language === 'en' ? '#0d9488' : '#2d3748',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        EN
      </button>
    </div>
  );
}