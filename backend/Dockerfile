FROM python:3.11-slim

WORKDIR /app

# Копируем requirements
COPY requirements.txt .

# Устанавливаем Python пакеты (без компиляции!)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Копируем весь код
COPY . .

# Открываем порт
EXPOSE 10000

# Запускаем
CMD uvicorn main_simple:app --host 0.0.0.0 --port ${PORT:-10000}