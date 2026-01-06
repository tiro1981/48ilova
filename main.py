import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# 1. @BotFather dan olgan tokenni shu yerga yozing
BOT_TOKEN = "8224220443:AAGKFocw5SwGGm4zmnHumtQ_kmEo9sfvs8E"

# 2. Web App joylashgan HTTPS havolani shu yerga yozing
# Masalan: "https://hikmatillo-app.vercel.app"
WEB_APP_URL = "https://sizning-saytingiz.vercel.app"

# Bot va Dispatcher ni sozlash
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# /start buyrug'i uchun handler
@dp.message(CommandStart())
async def cmd_start(message: types.Message):
    # Tugmani yaratish
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="Ilovani ochish 📱", 
                web_app=WebAppInfo(url=WEB_APP_URL)
            )
        ]
    ])

    # Xabar matni
    text = "Assalomu aleykum! Botni ishga tushurish uchun ilovani ochish tugmasini bosing 👇"

    # Xabar va tugmani yuborish
    await message.answer(text, reply_markup=keyboard)

# Botni ishga tushirish funksiyasi
async def main():
    print("Bot ishga tushdi...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Bot to'xtatildi")