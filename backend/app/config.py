# backend/app/config.py
from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    yandex_folder_id: str
    project_name: str = "DocuBot"
    version: str = "0.1.0"
    
    class Config:
        env_file = ".env"

settings = Settings()