import json
import re

print("🔧 Читаю authorized_key.json...")

with open('authorized_key.json', 'r', encoding='utf-8') as f:
    key_data = json.load(f)

private_key = key_data['private_key']

# 🔍 Проверяем на двойные экранирования
if '\\\\n' in private_key:
    print("⚠️  Найдены двойные экранирования \\\\n → исправляю на \\n")
    private_key = private_key.replace('\\\\n', '\n')

# 🔍 Проверяем на лишние пробелы в начале/конце
private_key = private_key.strip()

# 🔍 Проверяем на литеральные \n (не преобразованные)
if '\\n' in private_key and not '\n' in private_key:
    print("⚠️  Найдены литеральные \\n → преобразую в реальные переносы")
    private_key = private_key.replace('\\n', '\n')

# Обновляем ключ
key_data['private_key'] = private_key

# Сохраняем исправленный файл
with open('authorized_key.json', 'w', encoding='utf-8') as f:
    json.dump(key_data, f, indent=2, ensure_ascii=False)

print("✅ Ключ исправлен и сохранён!")
print(f"🔑 Новая длина: {len(private_key)} символов")
print(f"📊 Содержит реальные переносы: {'\\n' in repr(private_key)}")