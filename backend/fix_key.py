import json

with open('authorized_key.json', 'r', encoding='utf-8') as f:
    key = json.load(f)

pk = key['private_key']
# Удаляем комментарий Yandex и лишние строки
lines = [l for l in pk.split('\n') if l.strip() and not l.startswith('PLEASE')]
key['private_key'] = '\n'.join(lines) + '\n'

with open('authorized_key_fixed.json', 'w', encoding='utf-8') as f:
    json.dump(key, f, ensure_ascii=False, indent=2)

print("✅ Готово! Проверьте что private_key начинается с '-----BEGIN PRIVATE KEY-----'")