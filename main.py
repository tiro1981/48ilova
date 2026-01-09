import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo

# 1. @BotFather dan olgan tokenni shu yerga yozing
BOT_TOKEN = "8224220443:AAGKFocw5SwGGm4zmnHumtQ_kmEo9sfvs8E"

# 2. Xabarlar boradigan KANAL ID sini shu yerga yozing
# Kanal ID sini olish uchun kanalingizga https://t.me/getmyid_bot ni admin qilib,
# biror narsa yozsangiz ID ni beradi. (Masalan: -100123456789)
# DIQQAT: Bot shu kanalda ADMIN bo'lishi shart!
ADMIN_CHANNEL_ID = -1003584720091  # O'zingizning kanal IDingizni yozing

# 3. Web App havolasi
WEB_APP_URL = "https://tiro1981.github.io/48ilova"

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

# Barcha boshqa xabarlarni ushlab oluvchi va kanalga yuboruvchi handler
# F.content_type.in_([...]) o'rniga shunchaki @dp.message() ishlatamiz,
# u hamma narsani (rasm, video, fayl) ushlaydi (faqat buyruqlardan tashqari).
@dp.message()
async def send_to_channel(message: types.Message):
    try:
        # Xabarni kanalga "Forward" qilish (User kimligi ko'rinib turadi)
        await bot.forward_message(
            chat_id=ADMIN_CHANNEL_ID,
            from_chat_id=message.chat.id,
            message_id=message.message_id
        )
        
        # Userga tasdiqlash xabarini yuborish
        await message.answer("✅ Adminga xabar yetkazildi!")
        
    except Exception as e:
        # Agar xatolik bo'lsa (masalan bot kanalda admin emas)
        logging.error(f"Xatolik yuz berdi: {e}")
        await message.answer("Xatolik: Xabar yuborilmadi. Bot sozlamalarini tekshiring.")

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
