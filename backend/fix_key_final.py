import json

print("🔧 Исправление ключа...")

# Читаем файл
with open('authorized_key.json', 'r', encoding='utf-8') as f:
    key_data = json.load(f)

private_key = key_data['private_key']

print(f"📋 До исправления (первые 100 символов):")
print(repr(private_key[:100]))

# 1. Удаляем \r (Windows переносы)
private_key = private_key.replace('\r\n', '\n').replace('\r', '\n')

# 2. Разбиваем на строки и убираем пустые
lines = private_key.split('\n')
cleaned_lines = [line for line in lines if line.strip()]

# 3. Собираем обратно
fixed_key = '\n'.join(cleaned_lines)

# 4. Добавляем \n в конце если нет
if not fixed_key.endswith('\n'):
    fixed_key += '\n'

print(f"✅ После исправления (первые 100 символов):")
print(repr(fixed_key[:100]))

# Проверяем что начинается правильно
if not fixed_key.startswith('-----BEGIN PRIVATE KEY-----'):
    print("❌ ОШИБКА: Ключ не начинается с '-----BEGIN PRIVATE KEY-----'")
    print("Первые 50 символов:", repr(fixed_key[:50]))
else:
    print("✅ Ключ начинается правильно!")

# Сохраняем
key_data['private_key'] = fixed_key

with open('authorized_key_fixed.json', 'w', encoding='utf-8', newline='\n') as f:
    json.dump(key_data, f, ensure_ascii=False, indent=2, newline='\n')

print("\n✅ Готово!")
print("1. Проверьте файл authorized_key_fixed.json")
print("2. Замените authorized_key.json на authorized_key_fixed.json")
print("3. Перезапустите сервер")