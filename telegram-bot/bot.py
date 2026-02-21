# telegram-bot/bot.py
import os
import logging
import requests
from telegram import Update, ForceReply
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN', '8371106909:AAHHERAmSMyqbZ7SgDTuS84Zhp7hEaiasgM')
API_URL = os.getenv('DOCUBOT_API_URL', 'https://docubot-production-043f.up.railway.app')

# ==================== ОБРАБОТЧИКИ ====================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    user = update.effective_user
    await update.message.reply_html(
        f"🤖 Привет, {user.mention_html()}!\n\n"
        f"Я <b>DocuBot AI</b> — бот для анализа юридических документов.\n\n"
        f"📄 Просто отправь мне PDF файл (договор, счёт, акт),\n"
        f"и я проанализирую его с помощью AI.\n\n"
        f"⚡ Анализ занимает 4-5 секунд\n"
        f"💾 Повторные документы — мгновенно\n\n"
        f"🔗 Веб-версия: https://docubot-three.vercel.app/"
    )

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help"""
    await update.message.reply_html(
        f"<b>📚 Помощь по DocuBot AI</b>\n\n"
        f"<b>Что я умею:</b>\n"
        f"• Анализировать PDF документы\n"
        f"• Извлекать данные (стороны, суммы, даты)\n"
        f"• Находить риски в договоре\n"
        f"• Давать рекомендации\n\n"
        f"<b>Как использовать:</b>\n"
        f"1. Отправь мне PDF файл\n"
        f"2. Подожди 4-5 секунд\n"
        f"3. Получи результат анализа\n\n"
        f"<b>Команды:</b>\n"
        f"/start - Начать работу\n"
        f"/help - Эта справка\n"
        f"/stats - Статистика использования"
    )

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /stats - показать статистику"""
    try:
        response = requests.get(
            f"{API_URL}/api/stats",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'success':
                stats = data
                
                message = f"""📊 <b>Статистика DocuBot AI</b>

📁 <b>Всего документов:</b> {stats['total_documents']}

📋 <b>По типам:</b>
• Договоры: {stats['by_type']['contract']}
• Счета: {stats['by_type']['invoice']}
• Акты: {stats['by_type']['act']}
• Другие: {stats['by_type']['other']}

🎯 <b>Средняя уверенность:</b> {stats['avg_confidence']*100:.1f}%

⚠️ <b>Всего рисков найдено:</b> {stats['total_risks']}
"""
                await update.message.reply_html(message)
            else:
                await update.message.reply_text("❌ Ошибка получения статистики")
        else:
            await update.message.reply_text("❌ Ошибка подключения к серверу")
    
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {str(e)}")
    """Команда /stats"""
    await update.message.reply_text(
        f"📊 Статистика DocuBot AI\n\n"
        f"Версия: 1.0.0\n"
        f"API: {API_URL}\n"
        f"Статус: 🟢 Работает"
    )

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка PDF файлов"""
    user = update.effective_user
    
    # Скачиваем файл
    file = await update.message.document.get_file()
    file_path = f"downloads/{update.message.document.file_name}"
    
    # Создаём папку downloads если нет
    os.makedirs("downloads", exist_ok=True)
    
    await file.download_to_drive(file_path)
    
    # Отправляем файл на API
    logger.info(f"📄 Получен файл от @{user.username}: {update.message.document.file_name}")
    
    # Индикатор загрузки
    status_msg = await update.message.reply_text("⏳ Анализирую документ...")
    
    try:
        # Отправляем на твой API
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{API_URL}/api/analyze",
                files=files,
                timeout=30
            )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'success':
                result = data['result']
                
                # Форматируем результат
                message = format_analysis_result(result)
                
                await status_msg.edit_text(message, parse_mode='HTML')
            else:
                await status_msg.edit_text(
                    f"❌ Ошибка анализа:\n{data.get('error', 'Неизвестная ошибка')}"
                )
        else:
            await status_msg.edit_text(
                f"❌ Ошибка API: {response.status_code}\n{response.text}"
            )
    
    except requests.exceptions.Timeout:
        await status_msg.edit_text(
            "⏰ Превышено время ожидания. Документ слишком большой."
        )
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        await status_msg.edit_text(f"❌ Ошибка: {str(e)}")
    
    finally:
        # Удаляем файл
        if os.path.exists(file_path):
            os.remove(file_path)

def format_analysis_result(result: dict) -> str:
    """Форматирует результат анализа в красивое сообщение"""
    
    ext_data = result.get('extracted_data', {})
    risk_flags = result.get('risk_flags', [])
    action_items = result.get('action_items', [])
    summary = result.get('summary', '')
    confidence = result.get('confidence_score', 0)
    
    # Основная информация
    message = f"📊 <b>Результаты анализа</b>\n\n"
    
    message += f"<b>📋 Тип документа:</b> {ext_data.get('document_type', 'Не указан')}\n"
    
    parties = ext_data.get('parties', [])
    if parties:
        message += f"<b>👥 Стороны:</b> {', '.join(parties)}\n"
    
    total_amount = ext_data.get('total_amount')
    currency = ext_data.get('currency', '')
    if total_amount:
        message += f"<b>💰 Сумма:</b> {total_amount:,.0f} {currency}\n"
    else:
        message += f"<b>💰 Сумма:</b> Не указана\n"
    
    message += f"\n<b>📝 Резюме:</b>\n{summary}\n"
    message += f"\n<b>🎯 Уверенность:</b> {confidence*100:.0f}%\n"
    
    # Риски
    if risk_flags:
        message += f"\n⚠️ <b>Риски ({len(risk_flags)}):</b>\n"
        for i, risk in enumerate(risk_flags[:5], 1):  # Максимум 5 рисков
            level_emoji = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(risk.get('level', 'low'), '⚪')
            message += f"\n{level_emoji} <b>{i}. {risk.get('category', 'Общий')} ({risk.get('level', 'unknown')})</b>\n"
            message += f"{risk.get('description', '')}\n"
            if risk.get('suggestion'):
                message += f"💡 {risk.get('suggestion')}\n"
    
    # Рекомендации
    if action_items:
        message += f"\n✅ <b>Рекомендации:</b>\n"
        for i, item in enumerate(action_items[:5], 1):  # Максимум 5
            message += f"{i}. {item}\n"
    
    # Ограничение по длине сообщения Telegram (4096 символов)
    if len(message) > 4000:
        message = message[:4000] + "\n\n... (сообщение обрезано)"
    
    return message

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка текстовых сообщений"""
    await update.message.reply_html(
        f"🤖 Я понимаю только PDF файлы!\n\n"
        f"Отправь мне документ для анализа.\n\n"
        f"Используй /help для справки."
    )

# ==================== ЗАПУСК ====================

import asyncio

def main():
    """Запуск бота"""
    
    # 🔧 Фикс для Python 3.14+
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
    
    # Создаём приложение
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(MessageHandler(filters.Document.PDF, handle_document))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    
    # Запускаем
    logger.info("🚀 Запуск бота...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()