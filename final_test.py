# final_test.py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("YANDEX_API_KEY")
FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")

print("=" * 50)
print("🔧 Автоматическая диагностика DocuBot")
print("=" * 50)

# 1. Проверка переменных
print("\n1️⃣ Проверка ключей...")
if not API_KEY:
    print("   ❌ API_KEY не найден в .env")
    exit()
if not FOLDER_ID:
    print("   ❌ FOLDER_ID не найден в .env")
    exit()
print(f"   ✅ API_KEY: {API_KEY[:10]}...")
print(f"   ✅ FOLDER_ID: {FOLDER_ID}")

# 2. Получение IAM-токена
print("\n2️⃣ Получение IAM-токена...")
iam_resp = requests.post(
    "https://iam.api.cloud.yandex.net/iam/v1/tokens",
    headers={"Content-Type": "application/json", "Authorization": f"Api-Key {API_KEY}"},
    json={}
)

if iam_resp.status_code != 200:
    print(f"   ❌ Ошибка: {iam_resp.text}")
    print("   💡 Проверь, что ключ начинается с AQCA")
    exit()

iam_token = iam_resp.json()["iamToken"]
print(f"   ✅ IAM-токен получен")

# 3. Тест YandexGPT
print("\n3️⃣ Тест YandexGPT...")
gpt_resp = requests.post(
    "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {iam_token}", "x-folder-id": FOLDER_ID},
    json={
        "modelUri": f"gpt://{FOLDER_ID}/yandexgpt-lite",
        "completionOptions": {"stream": False, "temperature": 0.1, "maxTokens": 100},
        "messages": [{"role": "user", "text": "Напиши слово ТЕСТ"}]
    }
)

if gpt_resp.status_code == 200:
    result = gpt_resp.json()
    print("   ✅ YandexGPT работает!")
    print(f"   🤖 Ответ: {result['result']['alternatives'][0]['message']['text']}")
    print("\n🎉 ГОТОВО! DocuBot готов к разработке!")
else:
    print(f"   ❌ Ошибка: {gpt_resp.status_code}")
    print(f"   {gpt_resp.text}")
    print("\n💡 Скинь этот вывод мне — помогу исправить!")