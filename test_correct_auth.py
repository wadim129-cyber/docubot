# test_correct_auth.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("YANDEX_API_KEY")
FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")

print("🔍 Тест с правильным методом аутентификации...")
print(f"API_KEY: {API_KEY[:10]}...")
print(f"FOLDER_ID: {FOLDER_ID}")
print()

# Для статических ключей Yandex Cloud используем прямой вызов
# Сначала получаем IAM-токен через обмен статического ключа

url = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Api-Key {API_KEY}"
}
data = {
    "yandex_passport_oauth_token": ""  # Пустое для статических ключей
}

print("📡 Отправка запроса на получение IAM-токена...")
response = requests.post(url, headers=headers, json={})

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    iam_token = response.json()["iamToken"]
    print(f"\n✅ IAM-токен получен!")
    
    # Теперь тестируем YandexGPT
    gpt_url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    gpt_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {iam_token}",
        "x-folder-id": FOLDER_ID
    }
    gpt_data = {
        "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite",
        "completionOptions": {"stream": False, "temperature": 0.1, "maxTokens": 100},
        "messages": [{"role": "user", "text": "Напиши слово ТЕСТ"}]
    }
    
    gpt_resp = requests.post(gpt_url, headers=gpt_headers, json=gpt_data)
    print(f"\nGPT Status: {gpt_resp.status_code}")
    
    if gpt_resp.status_code == 200:
        result = gpt_resp.json()
        print("✅ УСПЕШНО!")
        print("🤖 Ответ:", result['result']['alternatives'][0]['message']['text'])
    else:
        print(f"❌ Ошибка GPT: {gpt_resp.text}")
else:
    print(f"\n❌ Не удалось получить IAM-токен")
    print(f"Ошибка: {response.text}")