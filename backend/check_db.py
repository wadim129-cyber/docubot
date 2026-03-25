from database import SessionLocal, AnalysisHistory

print(" Подключение к базе данных...")
db = SessionLocal()

try:
    analyses = db.query(AnalysisHistory).all()
    print(f"📊 Всего анализов: {len(analyses)}\n")

    for a in analyses:
        print(f"📄 ID: {a.id}")
        print(f"   Filename: {a.filename}")
        print(f"   User ID: {a.user_id}")
        print(f"   Document Type: {a.document_type}")
        print(f"   Created At: {a.created_at}")
        print()
finally:
    db.close()