# debug_key.py
import os
import json
from cryptography.hazmat.primitives import serialization

# Проверяем источник ключа
key_content = os.getenv('AUTHORIZED_KEY_CONTENT')
if key_content:
    print("🔍 Ключ из ENV (первые 200 символов):")
    print(repr(key_content[:200]))
else:
    print("🔍 Ключ из файла authorized_key.json")
    with open('authorized_key.json', 'r', encoding='utf-8') as f:
        key_data = json.load(f)
    pk = key_data['private_key']
    print("📋 private_key (первые 200 байт в hex):")
    print(pk[:200].encode('utf-8').hex())
    
    # Пробуем загрузить ключ
    try:
        from cryptography.hazmat.primitives import serialization
        key = serialization.load_pem_private_key(
            pk.encode('utf-8'),
            password=None
        )
        print("✅ Ключ загружен успешно!")
    except Exception as e:
        print(f"❌ Ошибка загрузки ключа: {e}")
        # Показываем проблемные байты
        for i, line in enumerate(pk.split('\n')[:10]):
            print(f"Line {i}: {repr(line)}")