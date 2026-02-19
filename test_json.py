# test_json.py
import json
import requests
import time
import jwt
from dotenv import load_dotenv
import os

load_dotenv()

FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")

print("📖 Чтение авторизованного ключа...")
with open('authorized_key.json', 'r', encoding='utf-8') as f:
    key_data = json.load(f)

# 👈 Важно: разделяем ID ключа и ID сервисного аккаунта
service_account_id = key_data['service_account_id']  # Для iss в JWT
private_key = key_data['private_key']
key_id = key_data['id']  # Для kid в заголовке JWT

print(f"✅ Ключ загружен")
print(f"Service Account ID: {service_account_id}")
print(f"Key ID (kid): {key_id}")

# Создаём JWT токен
print("\n🔐 Создание JWT...")
now = int(time.time())
payload = {
    'aud': "https://iam.api.cloud.yandex.net/iam/v1/tokens",
    'iss': service_account_id,  # 👈 Используем service_account_id
    'iat': now,
    'exp': now + 3600
}

# Заголовок JWT с kid
headers = {
    'kid': key_id,  # 👈 Используем key_id
    'alg': 'PS256',
    'typ': 'JWT'
}

encoded_token = jwt.encode(payload, private_key, algorithm='PS256', headers=headers)

# Получаем IAM-токен
print("📡 Получение IAM-токена...")
resp = requests.post(
    "https://iam.api.cloud.yandex.net/iam/v1/tokens",
    headers={"Content-Type": "application/json"},
    json={"jwt": encoded_token}
)

if resp.status_code == 200:
    iam_token = resp.json()["iamToken"]
    print(f"✅ IAM-токен получен!")
    
    # Тестируем YandexGPT
    print("\n🔍 Тест YandexGPT...")
    gpt_resp = requests.post(
        "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {iam_token}",
            "x-folder-id": FOLDER_ID
        },
        json={
            "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite",
            "completionOptions": {"stream": False, "temperature": 0.1, "maxTokens": 100},
            "messages": [{"role": "user", "text": "Напиши слово ТЕСТ"}]
        }
    )
    
    if gpt_resp.status_code == 200:
        result = gpt_resp.json()
        print("✅ УСПЕШНО!")
        print("🤖 Ответ:", result['result']['alternatives'][0]['message']['text'])
        print("\n🎉 DocuBot готов к разработке!")
    else:
        print(f"❌ Ошибка GPT: {gpt_resp.text}")
else:
    print(f"❌ Ошибка получения IAM-токена: {resp.text}")