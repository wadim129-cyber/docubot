FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем requirements.txt из папки backend
COPY backend/requirements.txt .

# Устанавливаем Python пакеты
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь код из backend
COPY backend/ .

# Открываем порт
EXPOSE 10000

# Запускаем
CMD uvicorn main_simple:app --host 0.0.0.0 --port ${PORT:-10000}