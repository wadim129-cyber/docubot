# 📘 КОНТЕКСТ ПРОЕКТА: DocuBot AI

## 1. Цель проекта
AI-агент для анализа юридических документов. Сервис позволяет загружать PDF файлы и получать их анализ: краткое резюме, извлечение данных и поиск рисков.

## 2. Технологический стек
- **Frontend:** Next.js 14 (React), TypeScript, Tailwind CSS
- **Backend:** Python 3.11, FastAPI
- **База данных:** SQLite (локально), PostgreSQL (production на Railway)
- **Deployment:** 
  - Frontend: Vercel (https://docubot-three.vercel.app)
  - Backend: Railway (https://docubot-production-043f.up.railway.app)
- **AI:** Yandex GPT (yandexgpt-lite)
- **Аутентификация:** JWT токены, bcrypt hashing

## 3. Структура сайта
- **Главная (`/`):** 
  - Шапка: логотип, переключатель языков (RU/EN), кнопка Login/Logout
  - Секция загрузки документов (PDF до 10 MB)
  - "Как это работает?" (3 шага)
  - "Почему DocuBot?" (4 преимущества)
  - FAQ (аккордеон)
  - Футер с ссылками

- **Функционал:**
  - Регистрация/Вход (JWT auth)
  - Загрузка PDF документов
  - AI анализ с извлечением данных
  - Генерация PDF отчётов
  - История анализов
  - Telegram бот

## 4. Ключевой функционал
✅ Регистрация и аутентификация пользователей
✅ Загрузка PDF документов (до 10 MB)
✅ AI анализ документов (Yandex GPT)
✅ Извлечение данных: тип документа, стороны, суммы, даты
✅ Поиск рисков (legal, financial, operational)
✅ Генерация рекомендаций
✅ PDF отчёты с кириллицей
✅ История анализов
✅ Кэширование результатов

## 5. Основные файлы проекта

**Backend:**
- `backend/main_simple.py` - основной FastAPI сервер
- `backend/auth.py` - аутентификация (JWT, bcrypt)
- `backend/database.py` - SQLAlchemy модели и БД
- `backend/requirements.txt` - Python зависимости

**Frontend:**
- `frontend/app/page.tsx` - главная страница
- `frontend/components/Auth.tsx` - компонент авторизации
- `frontend/components/Auth.js` - альтернативный auth компонент
- `frontend/.env.local` - переменные окружения (локально)

**Конфигурация:**
- `backend/.env` - переменные окружения бэкенда
- `vercel.json` - настройки деплоя на Vercel
- `railway.toml` - настройки Railway

## 6. Переменные окружения

**Backend (.env):**
```env
YANDEX_FOLDER_ID=b1gdcuaq0il54iojm93b
PORT=10000
SECRET_KEY=your_secret_key_here
DATABASE_URL=sqlite:///./docubot_local.db
AUTHORIZED_KEY_CONTENT={json с ключом Yandex Cloud}