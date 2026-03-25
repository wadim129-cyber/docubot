import json

with open('authorized_key.json', 'r', encoding='utf-8') as f:
    key = json.load(f)

private_key = key.get('private_key', '')
print(f"🔑 Private key length: {len(private_key)} символов")
print(f"✅ Starts with: {private_key[:30]}...")
print(f"✅ Ends with: ...{private_key[-30:]}")

if len(private_key) > 1000:
    print("✅ Ключ полный!")
else:
    print("❌ Ключ обрезан! Нужно создать новый.")