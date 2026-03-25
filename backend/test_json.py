import json

try:
    with open('authorized_key.json', 'r', encoding='utf-8') as f:
        key = json.load(f)
    print("✅ JSON валидный!")
    print(f"🔑 Private key length: {len(key.get('private_key', ''))} символов")
    if len(key.get('private_key', '')) > 1000:
        print("✅ Ключ полный!")
    else:
        print("❌ Ключ обрезан!")
except Exception as e:
    print(f"❌ Ошибка: {e}")