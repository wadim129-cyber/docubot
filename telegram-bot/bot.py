# telegram-bot/bot.py
import os
import logging
import requests
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
BOT_TOKEN = os.getenv('BOT_TOKEN', '8371106909:AAHHERAmSMyqbZ7SgDTuS84Zhp7hEaiasgM')
API_URL = os.getenv('DOCUBOT_API_URL', 'https://docubot-production-043f.up.railway.app')
API_TOKEN = os.getenv('DOCUBOT_API_TOKEN', '')
PROXY_URL = os.getenv('TELEGRAM_PROXY', '')  # socks5://user:pass@proxy:1080

# ==================== ОБРАБОТЧИКИ ====================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
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
    try:
        headers = {"Authorization": f"Bearer {API_TOKEN}"} if API_TOKEN else {}
        response = requests.get(f"{API_URL}/api/stats", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                stats = data
                message = (
                    f"📊 <b>Статистика DocuBot AI</b>\n\n"
                    f"📁 <b>Всего документов:</b> {stats['total_documents']}\n\n"
                    f"📋 <b>По типам:</b>\n"
                    f"• Договоры: {stats['by_type'].get('contract', 0)}\n"
                    f"• Счета: {stats['by_type'].get('invoice', 0)}\n"
                    f"• Акты: {stats['by_type'].get('act', 0)}\n"
                    f"• Другие: {stats['by_type'].get('other', 0)}\n\n"
                    f"🎯 <b>Средняя уверенность:</b> {stats['avg_confidence']*100:.1f}%\n"
                    f"⚠️ <b>Всего рисков найдено:</b> {stats['total_risks']}"
                )
                await update.message.reply_html(message)
            else:
                await update.message.reply_text("❌ Ошибка получения статистики")
        else:
            await update.message.reply_text(f"❌ Ошибка API: {response.status_code}")
    except Exception as e:
        await update.message.reply_text(f"❌ Ошибка: {str(e)}")

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    file = await update.message.document.get_file()
    file_path = f"downloads/{update.message.document.file_name}"
    
    os.makedirs("downloads", exist_ok=True)
    
    # ✅ Исправлено: правильный метод скачивания
    await file.download_to_drive(file_path)
    
    logger.info(f"📄 Получен файл от @{user.username}: {update.message.document.file_name}")
    status_msg = await update.message.reply_text("⏳ Анализирую документ...")
    
    try:
        headers = {"Authorization": f"Bearer {API_TOKEN}"} if API_TOKEN else {}
        with open(file_path, 'rb') as f:
            response = requests.post(
                f"{API_URL}/api/analyze",
                files={'file': f},
                headers=headers,
                timeout=30
            )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('status') == 'success':
                result = data['result']
                message = format_analysis_result(result)
                await status_msg.edit_text(message, parse_mode='HTML')
            else:
                await status_msg.edit_text(f"❌ Ошибка анализа:\n{data.get('error', 'Неизвестная ошибка')}")
        else:
            await status_msg.edit_text(f"❌ Ошибка API: {response.status_code}\n{response.text[:200]}")
    
    except requests.exceptions.Timeout:
        await status_msg.edit_text("⏰ Превышено время ожидания.")
    except Exception as e:
        logger.error(f"Ошибка: {e}")
        await status_msg.edit_text(f"❌ Ошибка: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)

def format_analysis_result(result: dict) -> str:
    ext_data = result.get('extracted_data', {})
    risk_flags = result.get('risk_flags', [])
    action_items = result.get('action_items', [])
    summary = result.get('summary', '')
    confidence = result.get('confidence_score', 0)
    
    message = f"📊 <b>Результаты анализа</b>\n\n"
    message += f"<b>📋 Тип документа:</b> {ext_data.get('document_type', 'Не указан')}\n"
    
    # ✅ Исправлено: parties — список Pydantic-моделей или словарей
    parties = ext_data.get('parties', [])
    if parties:
        party_names = []
        for p in parties:
            if hasattr(p, 'name'):  # Pydantic модель
                party_names.append(p.name)
            elif isinstance(p, dict):
                party_names.append(p.get('name', 'Unknown'))
            else:
                party_names.append(str(p))
        message += f"<b>👥 Стороны:</b> {', '.join(party_names)}\n"
    
    # ✅ Исправлено: financial_terms — Pydantic модель
    financial = ext_data.get('financial_terms', {})
    total_amount = financial.total_amount if hasattr(financial, 'total_amount') else financial.get('total_amount')
    currency = financial.currency if hasattr(financial, 'currency') else financial.get('currency', 'RUB')
    
    if total_amount is not None:
        message += f"<b>💰 Сумма:</b> {total_amount:,.0f} {currency}\n"
    else:
        message += f"<b>💰 Сумма:</b> Не указана\n"
    
    message += f"\n<b>📝 Резюме:</b>\n{summary}\n"
    message += f"<b>🎯 Уверенность:</b> {confidence*100:.0f}%\n"
    
    # Риски
    if risk_flags:
        message += f"\n⚠️ <b>Риски ({len(risk_flags)}):</b>\n"
        for i, risk in enumerate(risk_flags[:5], 1):
            if hasattr(risk, 'level'):  # Pydantic
                level = risk.level.value if hasattr(risk.level, 'value') else risk.level
                category = risk.category
                desc = risk.description
                suggestion = risk.suggestion
            else:  # dict
                level = risk.get('level', 'low')
                category = risk.get('category', 'Общий')
                desc = risk.get('description', '')
                suggestion = risk.get('suggestion')
            
            level_emoji = {'critical': '🔴', 'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(str(level).lower(), '⚪')
            message += f"\n{level_emoji} <b>{i}. {category} ({level})</b>\n{desc}\n"
            if suggestion:
                message += f"💡 {suggestion}\n"
    
    # ✅ Исправлено: action_items — Pydantic модели
    if action_items:
        message += f"\n✅ <b>Рекомендации:</b>\n"
        for i, item in enumerate(action_items[:5], 1):
            if hasattr(item, 'action'):  # Pydantic
                action_text = item.action
            elif isinstance(item, dict):
                action_text = item.get('action', str(item))
            else:
                action_text = str(item)
            message += f"{i}. {action_text}\n"
    
    if len(message) > 4000:
        message = message[:4000] + "\n\n... (сообщение обрезано)"
    
    return message

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_html(
        f"🤖 Я понимаю только PDF файлы!\n\n"
        f"Отправь мне документ для анализа.\n\n"
        f"Используй /help для справки."
    )

# ==================== ЗАПУСК ====================

def main():
    builder = Application.builder().token(BOT_TOKEN)
    
    # ✅ Добавляем proxy если указан
    if PROXY_URL:
        builder = builder.proxy_url(PROXY_URL)
    
    application = builder.build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("stats", stats_command))
    application.add_handler(MessageHandler(filters.Document.PDF, handle_document))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    
    logger.info("🚀 Запуск бота...")
    application.run_polling(
        allowed_updates=Update.ALL_TYPES,
        timeout=30,
        read_timeout=30,
        connect_timeout=30,
        write_timeout=30
    )

if __name__ == "__main__":
    main()