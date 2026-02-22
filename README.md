# 🤖 DocuBot AI

**AI-сервис для анализа юридических документов**

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-green.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Описание

DocuBot AI — это интеллектуальный сервис для анализа юридических документов (договоры, счета, акты). 
Используя Yandex GPT, система автоматически извлекает данные, находит риски и формирует рекомендации.

### ✨ Возможности

- ✅ **Анализ PDF документов** за 5-10 секунд
- ✅ **Извлечение данных**: стороны, суммы, даты, обязательства
- ✅ **Поиск рисков**: финансовые, юридические, операционные
- ✅ **PDF отчёты** с полным анализом
- ✅ **Telegram бот** для работы 24/7
- ✅ **История анализов** в базе данных
- ✅ **Кэширование** для повторных документов

---

## 🌐 Демо

### Веб-версия
🔗 **Frontend**: https://docubot-three.vercel.app

### Telegram бот
🤖 **@DocuBotAI_bot**: https://t.me/DocuBotAI_bot

### API
🔌 **Backend**: https://docubot-production-043f.up.railway.app

---

## 📸 Скриншоты

### Главная страница
![Главная страница](screenshots/homepage.png)

### Результат анализа
![Результат](screenshots/analysis-result.png)

### PDF отчёт
![PDF](screenshots/pdf-report.png)

### Telegram бот
![Бот](screenshots/telegram-bot.png)

---

## 🛠️ Технологии

### Backend
- **Python 3.11**
- **FastAPI** — REST API
- **SQLAlchemy** — ORM
- **PostgreSQL** — база данных
- **Yandex GPT** — AI анализ
- **ReportLab** — генерация PDF
- **PyPDF2** — чтение PDF
- **PyJWT** — аутентификация

### Frontend
- **Next.js 14** — React фреймворк
- **TypeScript** — типизация
- **Axios** — HTTP запросы
- **html2pdf.js** — клиентская генерация PDF

### DevOps
- **Railway** — хостинг backend + bot
- **Vercel** — хостинг frontend
- **Docker** — контейнеризация
- **GitHub Actions** — CI/CD

---

## 🚀 Установка и запуск

### Требования
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Yandex Cloud аккаунт (для GPT API)

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/wadim129-cyber/docubot.git
cd docubot