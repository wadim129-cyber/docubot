# backend/app/services/yandex_gpt.py
import json
import requests
import time
import jwt
import os

class YandexGPTService:
    def __init__(self):
        self.folder_id = os.getenv("YANDEX_FOLDER_ID")
        self.iam_token = None
        self.token_expires_at = 0
        
        # Загружаем авторизованный ключ
        key_path = os.path.join(os.path.dirname(__file__), "../../../authorized_key.json")
        with open(key_path, 'r', encoding='utf-8') as f:
            self.key_data = json.load(f)
        
        self.service_account_id = self.key_data['service_account_id']
        self.private_key = self.key_data['private_key']
        self.key_id = self.key_data['id']
    
    def get_iam_token(self):
        """Получает IAM-токен (кэширует на 1 час)"""
        now = time.time()
        if self.iam_token and now < self.token_expires_at:
            return self.iam_token
        
        # Создаём JWT
        payload = {
            'aud': "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            'iss': self.service_account_id,
            'iat': int(now),
            'exp': int(now) + 3600
        }
        
        headers = {
            'kid': self.key_id,
            'alg': 'PS256',
            'typ': 'JWT'
        }
        
        encoded_token = jwt.encode(payload, self.private_key, algorithm='PS256', headers=headers)
        
        # Получаем IAM-токен
        resp = requests.post(
            "https://iam.api.cloud.yandex.net/iam/v1/tokens",
            headers={"Content-Type": "application/json"},
            json={"jwt": encoded_token}
        )
        
        if resp.status_code != 200:
            raise Exception(f"Failed to get IAM token: {resp.text}")
        
        self.iam_token = resp.json()["iamToken"]
        self.token_expires_at = now + 3600
        
        return self.iam_token
    
    def call_gpt(self, prompt: str, max_tokens: int = 500) -> str:
        """Вызов YandexGPT"""
        iam_token = self.get_iam_token()
        
        url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {iam_token}",
            "x-folder-id": self.folder_id
        }
        
        data = {
            "modelUri": f"gpt://{self.folder_id}/yandexgpt-lite",
            "completionOptions": {
                "stream": False,
                "temperature": 0.1,
                "maxTokens": max_tokens
            },
            "messages": [
                {"role": "user", "text": prompt}
            ]
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code != 200:
            raise Exception(f"GPT error: {response.text}")
        
        result = response.json()
        return result['result']['alternatives'][0]['message']['text']

# Глобальный экземпляр
gpt_service = YandexGPTService()