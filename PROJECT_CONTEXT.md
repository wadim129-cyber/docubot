📘 КОНТЕКСТ ПРОЕКТА: DocuBot AI (ОБНОВЛЁН: Шаг 2 ✅)
Дата обновления: 26.03.2026
Статус: ✅ Шаг 2 завершён | 🔄 Готовим Шаг 3
Ветка Git: test-patch (запушена)
1. Цель проекта
AI-агент для анализа юридических документов. Сервис позволяет загружать PDF файлы и получать их анализ: краткое резюме, извлечение данных и поиск рисков.
2. Технологический стек
Frontend: Next.js 14 (React), TypeScript, Tailwind CSS
Backend: Python 3.11, FastAPI
База данных: SQLite (локально), PostgreSQL (production на Railway)
Deployment:
Frontend: Vercel (https://docubot-three.vercel.app)
Backend: Railway (https://docubot-production-043f.up.railway.app)
AI: Yandex GPT (yandexgpt-lite)
Аутентификация: JWT токены, bcrypt hashing
3. Структура сайта
Главная (/):
Шапка: логотип, переключатель языков (RU/EN), кнопка Login/Logout
Секция загрузки документов (PDF до 10 MB)
"Как это работает?" (3 шага)
"Почему DocuBot?" (4 преимущества)
FAQ (аккордеон)
Футер с ссылками
Функционал:
Регистрация/Вход (JWT auth)
Загрузка PDF документов
AI анализ с извлечением данных
Генерация PDF отчётов
История анализов
Telegram бот
4. Ключевой функционал (СТАТУС)
Функция
Статус
Примечание
✅ Регистрация и аутентификация
Готово
JWT + bcrypt
✅ Загрузка PDF (до 10 MB)
Готово
Валидация MIME + размер
✅ AI анализ (Yandex GPT)
Готово
Ключ из authorized_key.json
✅ Извлечение данных
Готово
тип, стороны, суммы, даты
✅ Поиск рисков
Готово
legal, financial, operational
✅ Генерация рекомендаций
Готово
Список action_items
✅ PDF отчёты с кириллицей
Готово
Исправлены parties, action_items
✅ История анализов
Готово
SQLite + пользовательская привязка
⏳ Кэширование результатов
В плане
Оптимизация запросов к GPT
5. Основные файлы проекта
Backend:
backend/main_simple.py — основной FastAPI сервер (исправлен generate_pdf: обработка parties как list[dict], action_items как dict/str)
backend/auth.py — аутентификация (JWT, bcrypt)
backend/database.py — SQLAlchemy модели и БД
backend/requirements.txt — Python зависимости
backend/authorized_key.json — 🔑 секретный ключ Yandex Cloud (НЕ в Git!)
Frontend:
frontend/app/page.tsx — главная страница
frontend/components/Auth.tsx — компонент авторизации
frontend/components/Auth.js — альтернативный auth компонент
frontend/.env.local — переменные окружения (локально)
Конфигурация:
backend/.env — переменные окружения бэкенда
vercel.json — настройки деплоя на Vercel
railway.toml — настройки Railway
.gitignore — исключает authorized_key.json, .env, *.db
6. Переменные окружения
Backend (.env):
env
12345
Frontend (.env.local):
env
12
Production (Railway Variables):
env
12345
7. 🔧 Технические исправления (Шаг 2)
📄 Генерация PDF (main_simple.py ~строка 725):
Исправлено parties:
python
123456789
Исправлено action_items:
python
123456
🔑 Ключ Yandex GPT:
Проблема: AUTHORIZED_KEY_CONTENT в .env ломал парсинг из-за \n
Решение: Ключ хранится в файле backend/authorized_key.json, код загружает его автоматически
Важно: Файл НЕ должен быть в Git (добавлен в .gitignore)
8. 🗓️ План на Шаг 3
🔤 Шрифты для PDF: Подключить DejaVuSans для гарантированной поддержки кириллицы на всех системах
🎨 Улучшения PDF: Логотип, таблицы, цветовое оформление, нумерация страниц
📊 Статистика: Дашборд с графиками (анализов за период, типы документов)
🚀 Деплой-чек: Проверка работы на Railway + Vercel, миграция на PostgreSQL
🤖 Telegram бот: Интеграция (опционально)
9. 🔗 Ссылки
Ресурс
Ссылка
📦 Репозиторий
https://github.com/wadim129-cyber/docubot
🌿 Ветка
test-patch
🖥️ Локальный сервер
http://localhost:10000/docs
🚀 Backend (Railway)
https://docubot-production-043f.up.railway.app
🎨 Frontend (Vercel)
https://docubot-three.vercel.app
⚙️ Railway Dashboard
https://railway.app/project/docubot
10. 📋 Чек-лист перед продолжением
[✅] Код запушен в ветку test-patch
[✅] authorized_key.json НЕ в репозитории
[✅] Локальный сервер работает: uvicorn main_simple:app --port 10000
[✅] Тестовый пользователь: test@docubot.ru / test123
[⏳] PostgreSQL на Railway настроен (проверить завтра)
💡 Инструкция на завтра:
Открой новый чат
Вставь этот контекст
Напиши: "Продолжаем Шаг 3"
Мы сразу приступим к шрифтам и улучшениям! 🚀
Сохрани этот текст, Вадим! Завтра он сэкономит нам 10-15 минут на восстановление контекста.
Отдыхай! До завтра! 👋✨🔥