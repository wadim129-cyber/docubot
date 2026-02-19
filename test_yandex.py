# test_yandex.py
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("YANDEX_API_KEY")
FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")

print("📋 Проверка:")
print(f"API_KEY: {'✅' if API_KEY else '❌'} ({API_KEY[:10]}...)")
print(f"FOLDER_ID: {'✅' if FOLDER_ID else '❌'} ({FOLDER_ID})")
print()

if not API_KEY or not FOLDER_ID:
    print("❌ Нет ключей!")
    exit(1)

print("🔍 Тест YandexGPT...")

try:
    # Правильный base_url без пробелов!
    client = OpenAI(
        api_key=API_KEY,
        base_url="https://llm.api.cloud.yandex.net/foundationModels/v1"
    )

    response = client.chat.completions.create(
        model="yandexgpt-lite",  # Попробуем lite версию
        messages=[
            {"role": "user", "content": "Напиши слово ТЕСТ"}
        ],
        extra_body={"folder_id": FOLDER_ID}
    )

    print("✅ УСПЕШНО!")
    print("🤖 Ответ:", response.choices[0].message.content)

except Exception as e:
    error_msg = str(e)
    print("❌ Ошибка:", error_msg)
    print()
    
    if "not found" in error_msg.lower():
        print("💡 Возможные причины:")
        print("   1. Нет роли ai.languageModels.user у сервисного аккаунта")
        print("   2. Folder ID неверный или нет доступа")
        print("   3. YandexGPT не активирован в каталоге")
        print()
        print("🔗 Проверь права: https://console.cloud.yandex.ru/cloud/folder/b1gdcuaq0il54iojm93b/access")