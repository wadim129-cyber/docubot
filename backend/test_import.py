# backend/test_import.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("🔍 Проверка импортов...")

try:
    from app.services.yandex_gpt import gpt_service
    print("✅ yandex_gpt.py импортирован")
except Exception as e:
    print(f"❌ yandex_gpt: {e}")

try:
    from app.agents.document_agent import document_agent
    print("✅ document_agent.py импортирован")
except Exception as e:
    print(f"❌ document_agent: {e}")

try:
    from app.models.document import AnalysisResult
    print("✅ document.py импортирован")
except Exception as e:
    print(f"❌ document: {e}")

print("\n🎉 Если все ✅ — импорты работают!")