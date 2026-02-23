'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'ru' | 'en';

type Translations = {
  [key: string]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  ru: {
    title: 'DocuBot AI',
    subtitle: 'AI-агент для анализа документов',
    uploadTitle: 'Загрузите документ',
    uploadSubtitle: 'Поддерживаются PDF файлы до 10 МБ',
    uploadButton: 'Выберите файл',
    analyzeButton: 'Анализировать',
    analyzing: '⏳ Анализирую...',
    howItWorks: 'Как это работает?',
    step1: 'Загрузите документ',
    step1Desc: 'Выберите PDF файл: договор, счёт, акт или другой юридический документ',
    step2: 'AI анализирует',
    step2Desc: 'Нейросеть читает документ, извлекает данные и ищет риски',
    step3: 'Получите результат',
    step3Desc: 'Увидите краткое резюме, риски и рекомендации на человеческом языке',
    whyDocubot: 'Почему DocuBot?',
    fast: 'Быстро',
    fastDesc: 'Анализ за 5-10 секунд вместо 30 минут чтения',
    cheap: 'Дёшево',
    cheapDesc: 'Бесплатно для старта, дешевле чем консультация юриста',
    confidential: 'Конфиденциально',
    confidentialDesc: 'Ваши документы не передаются третьим лицам',
    alwaysOnDesc: 'Работает круглосуточно, без выходных и праздников',
    faq: 'Часто задаваемые вопросы',
    faq1Q: 'Какие форматы документов поддерживаете?',
    faq1A: 'Сейчас поддерживаем только PDF. В планах: DOCX, изображения, сканы.',
    faq2Q: 'Насколько точен анализ?',
    faq2A: 'Точность ~70-90% в зависимости от качества документа. Это помощник для первичного анализа, а не замена юриста.',
    faq3Q: 'Это заменяет юриста?',
    faq3A: 'Нет. DocuBot помогает быстро оценить документ и найти "красные флаги". Для важных сделок всегда консультируйтесь с профессионалом.',
    faq4Q: 'Куда попадают мои документы?',
    faq4A: 'Документы обрабатываются через Yandex Cloud API и не сохраняются на наших серверах. Мы не используем ваши данные для обучения моделей.',
    history: 'История анализов',
    telegramBot: 'Telegram бот',
    contacts: 'Контакты',
    disclaimer: 'Не является юридической консультацией',
    selectFile: 'Выберите файл для загрузки',
    analysisError: 'Ошибка при анализе документа',
    resultsTitle: 'Результаты анализа',
    basicInfo: 'Основная информация',
    risks: 'Риски',
    recommendations: 'Рекомендации',
    summary: 'Резюме',
    downloadPDF: 'Скачать PDF отчёт',
    type: 'Тип',
    subtype: 'Подтип',
    parties: 'Стороны',
    amount: 'Сумма',
    confidence: 'Уверенность',
    notSpecified: 'Не указана',
    chooseFile: 'Нажмите чтобы выбрать PDF файл',
  },
  en: {
    title: 'DocuBot AI',
    subtitle: 'AI-powered document analysis',
    uploadTitle: 'Upload Document',
    uploadSubtitle: 'PDF files up to 10 MB supported',
    uploadButton: 'Choose File',
    analyzeButton: 'Analyze',
    analyzing: '⏳ Analyzing...',
    howItWorks: 'How it works?',
    step1: 'Upload Document',
    step1Desc: 'Select a PDF file: contract, invoice, act or other legal document',
    step2: 'AI Analyzes',
    step2Desc: 'Neural network reads the document, extracts data and searches for risks',
    step3: 'Get Results',
    step3Desc: 'See a brief summary, risks and recommendations in human language',
    whyDocubot: 'Why DocuBot?',
    fast: 'Fast',
    fastDesc: 'Analysis in 5-10 seconds instead of 30 minutes of reading',
    cheap: 'Cheap',
    cheapDesc: 'Free to start, cheaper than a lawyer consultation',
    confidential: 'Confidential',
    confidentialDesc: 'Your documents are not transferred to third parties',
    alwaysOnDesc: 'Works around the clock, without days off and holidays',
    faq: 'Frequently Asked Questions',
    faq1Q: 'What document formats do you support?',
    faq1A: 'Currently we only support PDF. In the plans: DOCX, images, scans.',
    faq2Q: 'How accurate is the analysis?',
    faq2A: 'Accuracy ~70-90% depending on the quality of the document. This is a helper for initial analysis, not a replacement for a lawyer.',
    faq3Q: 'Does this replace a lawyer?',
    faq3A: 'No. DocuBot helps to quickly assess the document and find "red flags". For important transactions, always consult a professional.',
    faq4Q: 'Where do my documents go?',
    faq4A: 'Documents are processed via Yandex Cloud API and are not stored on our servers. We do not use your data to train models.',
    history: 'Analysis History',
    telegramBot: 'Telegram Bot',
    contacts: 'Contacts',
    disclaimer: 'Not a legal consultation',
    selectFile: 'Select a file to upload',
    analysisError: 'Error analyzing document',
    resultsTitle: 'Analysis Results',
    basicInfo: 'Basic Information',
    risks: 'Risks',
    recommendations: 'Recommendations',
    summary: 'Summary',
    downloadPDF: 'Download PDF Report',
    type: 'Type',
    subtype: 'Subtype',
    parties: 'Parties',
    amount: 'Amount',
    confidence: 'Confidence',
    notSpecified: 'Not specified',
    chooseFile: 'Click to choose PDF file',
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ru');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}