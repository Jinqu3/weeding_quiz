# =====================================================================
# Telegram Quiz Bot на aiogram 3.x
# Тематика: Интеллектуальное Казино 🎰
# Баллы конвертируются 1:1 в CasinoCoins (фишки для казино)!
#
# Синхронизация вопросов:
#   - Автоматически считывает data/questions.json (Docker volume)
#   - Либо обращается к HTTP API веб-интерфейса (QUESTIONS_API_URL)
#   - При вводе /next или /reload вопросы обновляются без перезапуска бота!
# =====================================================================

import asyncio
import json
import logging
import os
import random
import sqlite3
import sys
import urllib.request
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
from dotenv import load_dotenv

from aiogram import Bot, Dispatcher, Router, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton

# Загружаем переменные из .env файла
load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")

if not BOT_TOKEN:
    print("❌ ВНИМАНИЕ: BOT_TOKEN не указан в .env файле!")
    print("Укажите переменную окружения BOT_TOKEN='ваш_токен' перед запуском.")

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ==========================================
# 1. БАЗА ВОПРОСОВ И ДИНАМИЧЕСКАЯ СИНХРОНИЗАЦИЯ
# ==========================================

QUESTIONS_DB_PATH = os.getenv("QUESTIONS_DB_PATH", "data/quiz.db")
QUESTIONS_FILE_PATH = os.getenv("QUESTIONS_FILE_PATH", "data/questions.json")
QUESTIONS_API_URL = os.getenv("QUESTIONS_API_URL", "http://localhost:3000/api/questions")

EMBEDDED_QUESTIONS: List[dict] = [
    {
        "id": "q1",
        "text": "Какой химический элемент в таблице Менделеева обозначается символом Au?",
        "type": "general",
        "points": 10,
        "answers": ["золото", "gold", "аурум", "aurum"],
        "explanation": "Au происходит от латинского слова Aurum («сияющий рассвет» или золото)."
    },
    {
        "id": "q2",
        "text": "⚡ [НА СКОРОСТЬ] Назовите столицу Австралии (не Сидней и не Мельбурн!)",
        "type": "first",
        "points": 20,
        "answers": ["канберра", "canberra"],
        "explanation": "Канберра была специально построена как компромисс между соперничавшими Сиднеем и Мельбурном."
    },
    {
        "id": "q3",
        "text": "Сколько граней у стандартного игрального кубика (кости)?",
        "type": "general",
        "points": 10,
        "answers": ["6", "шесть", "six"],
        "explanation": "У классического шестигранного кубика d6 ровно 6 граней с числами от 1 до 6."
    },
    {
        "id": "q4",
        "text": "⚡ [НА СКОРОСТЬ] В каком году Юрий Гагарин совершил первый в истории полёт в космос?",
        "type": "first",
        "points": 25,
        "answers": ["1961", "1961 год", "1961г"],
        "explanation": "12 апреля 1961 года на советском космическом корабле «Восток-1»."
    },
    {
        "id": "q5",
        "text": "Какая планета Солнечной системы является самой большой по массе и размеру?",
        "type": "general",
        "points": 10,
        "answers": ["юпитер", "jupiter"],
        "explanation": "Юпитер — газовый гигант, его масса более чем в 2,5 раза превышает массу всех остальных планет вместе взятых."
    },
    {
        "id": "q6",
        "text": "Сколько секунд длится раунд в классическом мужском профессиональном боксе?",
        "type": "choice",
        "options": ["120 секунд (2 мин)", "180 секунд (3 мин)", "240 секунд (4 мин)", "300 секунд (5 мин)"],
        "correctOptionIndex": 1,
        "points": 15,
        "answers": ["2", "2)", "180", "180 секунд", "180 секунд (3 мин)", "б"],
        "explanation": "Классический раунд в мужском профессиональном боксе длится ровно 3 минуты (180 секунд)."
    },
    {
        "id": "q7",
        "text": "⚡ [НА СКОРОСТЬ] Сколько секунд в ровно 3 минутах?",
        "type": "first",
        "points": 15,
        "answers": ["180", "180 секунд", "180 сек"],
        "explanation": "В одной минуте 60 секунд. 3 × 60 = 180."
    },
    {
        "id": "q8",
        "text": "Какое озеро является самым глубоким на планете Земля?",
        "type": "general",
        "points": 15,
        "answers": ["байкал", "озеро байкал", "baikal"],
        "explanation": "Максимальная глубина пресноводного озера Байкал составляет 1642 метра."
    },
    {
        "id": "q9",
        "text": "⚡ [НА СКОРОСТЬ] Какое число в рулетке европейского казино окрашено в зелёный цвет?",
        "type": "first",
        "points": 20,
        "answers": ["0", "зеро", "ноль", "zero"],
        "explanation": "В европейской рулетке ровно один зелёный сектор — Зеро (0). В американской их два: 0 и 00."
    },
    {
        "id": "q10",
        "text": "Какой океан является самым большим по площади на Земле?",
        "type": "general",
        "points": 10,
        "answers": ["тихий", "тихий океан", "pacific", "pacific ocean"],
        "explanation": "Тихий океан занимает более трети всей поверхности планеты Земля."
    },
    {
        "id": "q11",
        "text": "⚡ [ФИНАЛ НА СКОРОСТЬ] Сколько карт в стандартной классической покерной колоде (без джокеров)?",
        "type": "first",
        "points": 30,
        "answers": ["52", "52 карты", "52 штуки"],
        "explanation": "4 масти по 13 карт (от двойки до туза) — ровно 52 карты."
    }
]

QUESTIONS: List[dict] = list(EMBEDDED_QUESTIONS)

def load_questions_from_source() -> int:
    """Динамическая загрузка актуальных вопросов из базы данных SQLite (data/quiz.db), JSON-файла или API."""
    global QUESTIONS

    # 1. Проверяем наличие базы данных SQLite (data/quiz.db)
    possible_db_paths = [
        QUESTIONS_DB_PATH,
        "data/quiz.db",
        "../data/quiz.db",
        "quiz.db"
    ]
    for db_p in possible_db_paths:
        if db_p and os.path.exists(db_p):
            try:
                conn = sqlite3.connect(db_p)
                cursor = conn.cursor()
                cursor.execute("PRAGMA table_info(questions)")
                cols = [c[1] for c in cursor.fetchall()]
                has_options = "options" in cols
                has_order = "sort_order" in cols

                order_sql = "sort_order ASC, rowid ASC" if has_order else "rowid ASC"
                if has_options:
                    cursor.execute(f"SELECT id, text, type, points, answers, explanation, options FROM questions ORDER BY {order_sql}")
                else:
                    cursor.execute(f"SELECT id, text, type, points, answers, explanation FROM questions ORDER BY {order_sql}")
                rows = cursor.fetchall()
                conn.close()
                if rows:
                    parsed_list = []
                    for row in rows:
                        ans_raw = row[4]
                        if isinstance(ans_raw, str) and ans_raw.startswith("["):
                            try:
                                answers = json.loads(ans_raw)
                            except Exception:
                                answers = [a.strip() for a in ans_raw.split(",") if a.strip()]
                        elif isinstance(ans_raw, str):
                            answers = [a.strip() for a in ans_raw.split(",") if a.strip()]
                        elif isinstance(ans_raw, list):
                            answers = ans_raw
                        else:
                            answers = [str(ans_raw)]

                        options_list = None
                        if has_options and len(row) > 6 and row[6]:
                            opt_raw = row[6]
                            if isinstance(opt_raw, str) and opt_raw.startswith("["):
                                try:
                                    options_list = json.loads(opt_raw)
                                except Exception:
                                    options_list = None
                            elif isinstance(opt_raw, list):
                                options_list = opt_raw

                        # Определяем индекс правильного ответа для типа choice
                        correct_opt_idx = 0
                        if options_list:
                            for o_idx, opt in enumerate(options_list):
                                opt_str = str(opt).strip().lower()
                                num_str = str(o_idx + 1)
                                if any(num_str == a.strip().lower() or opt_str == a.strip().lower() for a in answers):
                                    correct_opt_idx = o_idx
                                    break

                        q_item = {
                            "id": str(row[0]),
                            "text": str(row[1]),
                            "type": str(row[2]),
                            "points": int(row[3]) if row[3] else 10,
                            "answers": answers,
                            "explanation": str(row[5] or "")
                        }
                        if options_list:
                            q_item["options"] = options_list
                            q_item["correctOptionIndex"] = correct_opt_idx

                        parsed_list.append(q_item)
                    if parsed_list:
                        QUESTIONS = parsed_list
                        logger.info(f"🗄️ Вопросы успешно загружены из SQLite БД {db_p} ({len(QUESTIONS)} шт.)")
                        return len(QUESTIONS)
            except Exception as e:
                logger.warning(f"Ошибка чтения SQLite БД {db_p}: {e}")

    # 2. Проверяем локальный файл data/questions.json
    possible_paths = [
        QUESTIONS_FILE_PATH,
        "data/questions.json",
        "../data/questions.json",
        "questions.json"
    ]
    for p in possible_paths:
        if p and os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        QUESTIONS = data
                        logger.info(f"✅ Вопросы успешно загружены из JSON {p} ({len(QUESTIONS)} шт.)")
                        return len(QUESTIONS)
            except Exception as e:
                logger.warning(f"Ошибка чтения JSON {p}: {e}")

    # 3. Если файл не найден, пробуем получить из Web UI API
    if QUESTIONS_API_URL:
        try:
            req = urllib.request.Request(
                QUESTIONS_API_URL,
                headers={"User-Agent": "TelegramQuizBot/1.0", "Accept": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    if isinstance(data, list) and len(data) > 0:
                        QUESTIONS = data
                        logger.info(f"🌐 Вопросы успешно синхронизированы через API {QUESTIONS_API_URL} ({len(QUESTIONS)} шт.)")
                        return len(QUESTIONS)
        except Exception as e:
            logger.debug(f"API {QUESTIONS_API_URL} недоступен: {e}")

    return len(QUESTIONS)

# Первичная загрузка вопросов при старте бота
load_questions_from_source()

GENERAL_JOKES = [
    "🎰 Казна казино нервно задрожала, а ваши карманы потяжелели!",
    "🃏 Крупье уже вытирает холодный пот со лба! Отличный выстрел!",
    "🧠 Эйнштейн одобрительно кивает, а казино медленно банкротится!",
    "🪙 Дзынь-дзынь! Фишечки полетели прямиком в ваш банкролл.",
    "🥂 Красиво ворвался! На эти фишки уже можно шикануть у рулетки.",
    "🎩 Интеллект 100-го уровня! Бармен наливает вам виртуальный коктейль за счёт заведения."
]

SPEED_JOKES = [
    "🏎️💨 Флэш нервно курит в углу! Ты сорвал весь куш раунда!",
    "⚡ Пальцы быстрее скорости звука! Крупье не успел даже моргнуть, а фишки уже твои!",
    "🤑 Остальные участники ещё шевелили губами, читая вопрос, а ты уже грабишь казино!",
    "👑 Реакция мангуста! Главный претендент на золотой VIP-стол в казино!",
    "🎯 Прямо в яблочко и первым! Остальным участникам остаётся только завидовать твоему банкроллу."
]

WRONG_JOKES = [
    "Мимо рулетки! Шарик предательски упал на зеро — фишки уходят казино! 💸",
    "Ставка не зашла! Крупье с улыбкой сгребает ставки лопаткой 🎲",
    "Интуиция взяла перекур! Но в казино главное — не унывать, впереди новые раунды! 🃏",
    "Блеф не удался! Мимо кассы, зато какая смелая попытка! 🎰",
    "Бармен сочувственно качает головой и наливает воды со льдом 🍸"
]

RANK_TITLES = [
    "👑 Олигарх вечера / Владелец казино",
    "🎩 VIP-хайроллер с полными карманами",
    "🎲 Опытный игрок, чует удачу за версту",
    "🪙 Перспективный лудоман",
    "📉 Срочно требуется беспроцентный микрозайм"
]

ROULETTE_WEIGHTED_CONFIG = [
    (0.0, 14.0),
    (0.1, 12.0),
    (0.2, 10.0),
    (0.3, 10.0),
    (0.4, 9.0),
    (0.5, 9.0),
    (0.6, 7.0),
    (0.7, 6.0),
    (0.8, 5.0),
    (0.9, 4.0),
    (1.0, 5.0),
    (1.1, 2.0),
    (1.2, 1.8),
    (1.3, 1.5),
    (1.4, 1.2),
    (1.5, 1.0),
    (1.6, 0.6),
    (1.7, 0.4),
    (1.8, 0.3),
    (1.9, 0.15),
    (2.0, 0.05),
]

def spin_roulette_wheel() -> float:
    multipliers = [item[0] for item in ROULETTE_WEIGHTED_CONFIG]
    weights = [item[1] for item in ROULETTE_WEIGHTED_CONFIG]
    return random.choices(multipliers, weights=weights, k=1)[0]

@dataclass
class UserStat:
    user_id: int
    full_name: str
    username: Optional[str] = None
    points: int = 0
    speed_wins: int = 0

@dataclass
class ChatQuizState:
    chat_id: int
    current_index: int = -1
    is_active: bool = False
    registered_players: Dict[int, UserStat] = field(default_factory=dict)
    bankroll_archive: Dict[int, UserStat] = field(default_factory=dict)
    attempted_user_ids: Set[int] = field(default_factory=set)
    correct_user_ids: List[int] = field(default_factory=list)
    first_winner_id: Optional[int] = None
    awarded_user_ids: Set[int] = field(default_factory=set)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

chat_states: Dict[int, ChatQuizState] = {}

def get_chat_state(chat_id: int) -> ChatQuizState:
    if chat_id not in chat_states:
        chat_states[chat_id] = ChatQuizState(chat_id=chat_id)
    return chat_states[chat_id]

router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    text = (
        "🎰 <b>ДОБРО ПОЖАЛОВАТЬ В ИНТЕЛЛЕКТУАЛЬНОЕ КАЗИНО!</b> 🎰\n\n"
        "Правила игры за нашим столом:\n"
        "1. <b>/join</b> — Обязательно для каждого! Вступить в игру.\n"
        "2. <b>/leave</b> — Выйти из-за стола с сохранением очков.\n"
        "3. <b>/next</b> — Выдать следующий вопрос (крупье).\n"
        "4. <b>/stat</b> — Таблица лидеров и банкролл CasinoCoins 🪙\n"
        "5. <b>/reload</b> — Синхронизировать вопросы из Web UI!\n"
        "6. <b>/roulette</b> — Коварная рулетка ва-банк!\n\n"
        "Все фишки 1:1 конвертируются в реальные ставки!"
    )
    await message.answer(text)

@router.message(Command("join"))
async def cmd_join(message: Message):
    state = get_chat_state(message.chat.id)
    user = message.from_user
    if not user:
        return

    async with state.lock:
        if user.id in state.registered_players:
            stat = state.registered_players[user.id]
            await message.reply(f"Вы уже за столом! Баланс: <b>{stat.points} 🪙</b>")
            return

        if user.id in state.bankroll_archive:
            stat = state.bankroll_archive.pop(user.id)
            stat.full_name = user.full_name
            stat.username = user.username
        else:
            stat = UserStat(user_id=user.id, full_name=user.full_name, username=user.username, points=0)

        state.registered_players[user.id] = stat
        total = len(state.registered_players)

        await message.reply(
            f"🎲 <b>{user.full_name}</b> занял(а) место за столом!\n"
            f"Баланс: <b>{stat.points} CasinoCoins 🪙</b>\n"
            f"Игроков за столом: <b>{total}</b>."
        )

@router.message(Command("leave"))
async def cmd_leave(message: Message):
    state = get_chat_state(message.chat.id)
    user = message.from_user
    if not user:
        return

    async with state.lock:
        if user.id not in state.registered_players:
            await message.reply("Вы сейчас не сидите за игровым столом. Напишите <b>/join</b>!")
            return

        stat = state.registered_players.pop(user.id)
        state.bankroll_archive[user.id] = stat

        await message.reply(
            f"👋 <b>{stat.full_name}</b> покинул(а) игровой стол.\n"
            f"Банкролл <b>{stat.points} CasinoCoins 🪙</b> сохранён! При вводе /join он восстановится."
        )

@router.message(Command("players"))
async def cmd_players(message: Message):
    state = get_chat_state(message.chat.id)
    if not state.registered_players:
        await message.answer("За столом пока никого нет! Напишите <b>/join</b>.")
        return

    lines = [f"👥 <b>Игроки за столом ({len(state.registered_players)} чел.):</b>\n"]
    for idx, (uid, stat) in enumerate(state.registered_players.items(), 1):
        lines.append(f"{idx}. <b>{stat.full_name}</b> (@{stat.username or 'user'}) — {stat.points} 🪙")
    await message.answer("\n".join(lines))

@router.message(Command("next"))
async def cmd_next(message: Message):
    state = get_chat_state(message.chat.id)

    async with state.lock:
        if not state.registered_players:
            await message.answer("⚠️ <b>За столом нет игроков!</b> Напишите <b>/join</b>.")
            return

        # Синхронизация вопросов перед каждым новым раундом
        load_questions_from_source()

        state.current_index += 1
        if state.current_index >= len(QUESTIONS):
            state.is_active = False
            await message.answer("🏁 <b>Все вопросы завершены!</b> Подводим итоги по команде <b>/stat</b>! 🏆")
            return

        question = QUESTIONS[state.current_index]
        state.is_active = True
        state.first_winner_id = None
        state.attempted_user_ids.clear()
        state.correct_user_ids.clear()
        state.awarded_user_ids.clear()

        q_num = state.current_index + 1
        total_q = len(QUESTIONS)
        total_players = len(state.registered_players)

        # Очищаем дублирующиеся теги в начале текста вопроса
        q_text = question["text"].strip()
        for prefix in ["⚡ [НА СКОРОСТЬ]", "⚡ [ФИНАЛ НА СКОРОСТЬ]", "[НА СКОРОСТЬ]", "[ФИНАЛ НА СКОРОСТЬ]"]:
            if q_text.startswith(prefix):
                q_text = q_text[len(prefix):].strip()
                break

        options = question.get("options")
        is_choice = question.get("type") == "choice" and options and len(options) > 0
        reply_markup = None

        if is_choice:
            badge = "🔘 <b>ВОПРОС С ВЫБОРОМ ВАРИАНТА</b> (Тест)"
            points_text = f"+{question['points']} CasinoCoins 🪙 каждому"
            num_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"]
            opt_lines = []
            buttons = []
            for idx, opt in enumerate(options):
                emoji = num_emojis[idx] if idx < len(num_emojis) else f"{idx + 1}."
                opt_lines.append(f"{emoji} <b>{opt}</b>")
                buttons.append(
                    InlineKeyboardButton(
                        text=f"{emoji} Вариант {idx + 1}",
                        callback_data=f"choice:{state.current_index}:{idx + 1}"
                    )
                )

            options_text = "\n\n" + "\n".join(opt_lines) + "\n"
            keyboard_rows = [buttons[i:i + 2] for i in range(0, len(buttons), 2)]
            reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)

            instructions = (
                f"💰 <i>На кону: {points_text}</i>\n"
                f"🪑 <i>Игроков за столом: {total_players} чел.</i>\n"
                f"✍️ <i>Нажмите кнопку с номером ниже или отправьте цифру (1, 2, 3...) прямо в чат!</i>\n"
                f"<i>Ставки принимаются от всех игроков за столом.</i>"
            )
        elif question["type"] == "first":
            badge = "⚡ <b>РАУНД НА СКОРОСТЬ!</b> (Куш первому верному!)"
            points_text = f"+{question['points']} CasinoCoins 🪙 первому верному"
            options_text = ""
            instructions = (
                f"💰 <i>На кону: {points_text}</i>\n"
                f"🪑 <i>Игроков за столом: {total_players} чел.</i>\n"
                f"⚡ <i>Раунд на скорость: вопрос закроется сразу же после первого верного ответа!</i>\n"
                f"✍️ <i>Пишите ваш ответ прямо в чат!</i>"
            )
        else:
            badge = "🌟 <b>ОБЩИЙ РАУНД</b> (Фишки каждому угадавшему)"
            points_text = f"+{question['points']} CasinoCoins 🪙 каждому"
            options_text = ""
            instructions = (
                f"💰 <i>На кону: {points_text}</i>\n"
                f"🪑 <i>Игроков за столом: {total_players} чел.</i>\n"
                f"👥 <i>Ждём скрытых ответов всех участников, затем объявим правильный ответ!</i>\n"
                f"✍️ <i>Пишите ваш ответ прямо в чат!</i>"
            )

        text = (
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"❓ <b>Вопрос {q_num} из {total_q}</b>\n"
            f"{badge}\n\n"
            f"<b>{q_text}</b>{options_text}\n"
            f"{instructions}\n"
            f"━━━━━━━━━━━━━━━━━━━━"
        )
        await message.answer(text, reply_markup=reply_markup)

@router.message(Command("current"))
async def cmd_current(message: Message):
    state = get_chat_state(message.chat.id)
    if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
        await message.answer("Сейчас нет активного вопроса. Напишите <b>/next</b>!")
        return

    question = QUESTIONS[state.current_index]
    options = question.get("options")
    is_choice = question.get("type") == "choice" and options and len(options) > 0
    total_players = len(state.registered_players)
    answered_count = len(state.attempted_user_ids)

    reply_markup = None
    options_text = ""
    if is_choice:
        num_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"]
        opt_lines = []
        buttons = []
        for idx, opt in enumerate(options):
            emoji = num_emojis[idx] if idx < len(num_emojis) else f"{idx + 1}."
            opt_lines.append(f"{emoji} <b>{opt}</b>")
            buttons.append(
                InlineKeyboardButton(
                    text=f"{emoji} Вариант {idx + 1}",
                    callback_data=f"choice:{state.current_index}:{idx + 1}"
                )
            )
        options_text = "\n\n" + "\n".join(opt_lines) + "\n"
        keyboard_rows = [buttons[i:i + 2] for i in range(0, len(buttons), 2)]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard_rows)

    text = (
        f"🎯 <b>ТЕКУЩИЙ ВОПРОС №{state.current_index + 1}:</b>\n\n"
        f"<b>{question['text']}</b>{options_text}\n"
        f"📊 <i>Ответов принято: {answered_count} из {total_players} игроков</i>"
    )
    await message.answer(text, reply_markup=reply_markup)

@router.message(Command("reload", "sync"))
async def cmd_reload(message: Message):
    count = load_questions_from_source()
    await message.reply(
        f"🔄 <b>Вопросы синхронизированы с UI!</b>\n\n"
        f"📚 Всего вопросов в базе: <b>{count}</b>\n"
        f"<i>Все изменения из веб-интерфейса уже активны в боте!</i>"
    )

@router.message(Command("stat"))
async def cmd_stat(message: Message):
    state = get_chat_state(message.chat.id)
    all_players = {**state.bankroll_archive, **state.registered_players}
    if not all_players:
        await message.answer("Казна пуста! Напишите <b>/join</b>.")
        return

    sorted_players = sorted(all_players.values(), key=lambda p: (p.points, p.speed_wins), reverse=True)
    lines = ["🎰 <b>ИТОГОВЫЙ БАНКРОЛЛ КАЗИНО</b> 🎰\n"]
    for idx, stat in enumerate(sorted_players, 1):
        status_in_room = "🟢 за столом" if stat.user_id in state.registered_players else "🚪 вне стола"
        title = RANK_TITLES[min(idx - 1, len(RANK_TITLES) - 1)]
        lines.append(
            f"{idx}. <b>{stat.full_name}</b> ({status_in_room})\n"
            f"   💰 Банкролл: <b>{stat.points} 🪙</b> | Скорость: ⚡ {stat.speed_wins}\n"
            f"   <i>{title}</i>\n"
        )
    await message.answer("\n".join(lines))

@router.message(Command("roulette"))
async def cmd_roulette(message: Message):
    state = get_chat_state(message.chat.id)
    user = message.from_user
    if not user:
        return

    async with state.lock:
        stat = state.registered_players.get(user.id) or state.bankroll_archive.get(user.id)
        if not stat or stat.points <= 0:
            await message.reply("У вас 0 фишек! Заработайте фишки в викторине.")
            return

        old_points = stat.points
        multiplier = spin_roulette_wheel()
        new_points = int(round(old_points * multiplier))
        stat.points = new_points

        await message.reply(
            f"🎰 <b>РУЛЕТКА ВА-БАНК!</b>\n\n"
            f"Ставка: <b>{old_points} 🪙</b>\n"
            f"Множитель: <b>{multiplier:.1f}x</b>\n"
            f"Итог: <b>{new_points} CasinoCoins 🪙</b>"
        )

@router.message(Command("reset"))
async def cmd_reset(message: Message):
    state = get_chat_state(message.chat.id)
    async with state.lock:
        state.current_index = -1
        state.is_active = False
        state.registered_players.clear()
        state.bankroll_archive.clear()
        state.attempted_user_ids.clear()
        state.correct_user_ids.clear()
        state.awarded_user_ids.clear()
        state.first_winner_id = None
    await message.answer("🔄 <b>Игра сброшена!</b> Напишите <b>/join</b> для нового захода.")

async def process_player_input(
    chat_id: int,
    user_id: int,
    user_name: str,
    username: Optional[str],
    raw_answer: str,
    reply_fn,
    answer_fn
):
    """Общий обработчик ответов (как из текстовых сообщений, так и при нажатии кнопок выбора)."""
    state = get_chat_state(chat_id)

    if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
        if 0 <= state.current_index < len(QUESTIONS):
            await reply_fn(
                "🛑 <b>Вопрос уже закрыт!</b> Ответы больше не принимаются.\n"
                "👉 <i>Крупье, отправьте /next для перехода к следующему вопросу!</i>"
            )
        return

    if user_id not in state.registered_players:
        await reply_fn(
            f"⚠️ <b>{user_name}</b>, вы ещё не за игровым столом!\n"
            "Напишите <b>/join</b>, чтобы вступить в игру и делать ставки!"
        )
        return

    async with state.lock:
        if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
            return

        question = QUESTIONS[state.current_index]

        if user_id in state.attempted_user_ids:
            await reply_fn(f"⚠️ <b>{user_name}</b>, ваша ставка в этом раунде уже принята!")
            return

        state.attempted_user_ids.add(user_id)
        user_stat = state.registered_players[user_id]
        user_stat.full_name = user_name
        user_stat.username = username

        user_text = raw_answer.strip().lower()
        # Очищаем цифры (например: "1", "1)", "1.", "вариант 1" -> 1)
        digits_only = "".join(c for c in user_text if c.isdigit())
        user_num = int(digits_only) if digits_only else None

        letter_map = {"а": 1, "б": 2, "в": 3, "г": 4, "д": 5, "е": 6, "a": 1, "b": 2, "c": 3, "d": 4}
        if not user_num and user_text in letter_map:
            user_num = letter_map[user_text]

        is_choice = question.get("type") == "choice" and question.get("options")
        is_correct = False

        if is_choice:
            options = question["options"]
            c_idx = question.get("correctOptionIndex")
            if c_idx is None:
                c_idx = 0
                for o_i, opt in enumerate(options):
                    if any(str(o_i + 1) == str(a).strip().lower() or str(opt).strip().lower() == str(a).strip().lower() for a in question["answers"]):
                        c_idx = o_i
                        break

            # 1. Проверка номера варианта (1, 2, 3...)
            if user_num is not None and user_num == c_idx + 1:
                is_correct = True
            # 2. Проверка текста варианта ответа
            elif 0 <= c_idx < len(options) and user_text == str(options[c_idx]).strip().lower():
                is_correct = True
            # 3. Проверка соответствия списку answers
            elif any(user_text == str(v).strip().lower() for v in question["answers"]):
                is_correct = True
        else:
            correct_variants = [str(a).strip().lower() for a in question["answers"]]
            is_correct = any(user_text == v for v in correct_variants)

        # 1. ВОПРОС НА СКОРОСТЬ
        if question["type"] == "first":
            if is_correct:
                state.is_active = False
                state.first_winner_id = user_id
                user_stat.points += question["points"]
                user_stat.speed_wins += 1

                correct_sample = question["answers"][0]
                speed_joke = random.choice(SPEED_JOKES)
                await reply_fn(
                    f"🎯 <b>В ТОЧКУ! БРАВО, {user_name}!</b>\n"
                    f"Правильный ответ: <b>{correct_sample}</b>\n\n"
                    f"🎉 <b>ДЖЕКПОТ СКОРОСТИ!</b>: <b>+{question['points']} CasinoCoins 🪙</b>\n"
                    f"🎰 Баланс победителя: <b>{user_stat.points} фишек</b>\n"
                    f"{speed_joke}\n\n"
                    f"🛑 <b>ВОПРОС ПОЛНОСТЬЮ ЗАКРЫТ! Ожидание других участников остановлено!</b>\n"
                    f"👉 <i>Крупье, отправьте /next для перехода к следующему вопросу!</i>"
                )
                return
            else:
                wrong_joke = random.choice(WRONG_JOKES)
                await reply_fn(
                    f"❌ <b>Мимо, {user_name}!</b> {wrong_joke}\n"
                    f"⚡ В вопросе на скорость даётся 1 попытка. Гонка продолжается!"
                )
                return

        # 2. ОБЩИЙ ВОПРОС ИЛИ ТЕСТ С ВЫБОРОМ ВАРИАНТА
        if is_correct:
            state.correct_user_ids.append(user_id)

        all_answered = all(uid in state.attempted_user_ids for uid in state.registered_players.keys())

        if not all_answered:
            choice_hint = f" (вариант {user_num})" if user_num else ""
            await reply_fn(
                f"🎲 <b>Ставка принята от {user_name}{choice_hint}!</b> ⏳\n"
                f"Ответили: {len(state.attempted_user_ids)} из {len(state.registered_players)} игроков за столом."
            )
            return

        # Все ответили — закрываем раунд и вскрываем карты
        state.is_active = False
        if is_choice and question.get("options"):
            options = question["options"]
            c_idx = question.get("correctOptionIndex", 0)
            if 0 <= c_idx < len(options):
                correct_answer_display = f"Вариант {c_idx + 1}: {options[c_idx]}"
            else:
                correct_answer_display = question["answers"][0]
        else:
            correct_answer_display = question["answers"][0]

        explanation = f"💡 <i>{question['explanation']}</i>\n\n" if question.get("explanation") else ""

        lines = [
            f"🔔 <b>ВСЕ СТАВКИ СДЕЛАНЫ! КРУПЬЕ ВСКРЫВАЕТ КАРТЫ!</b> 🔔\n",
            f"🎯 Правильный ответ: <b>{correct_answer_display}</b>",
            explanation
        ]

        if state.correct_user_ids:
            lines.append("🎉 <b>Игроки, сорвавшие куш в этом раунде:</b>")
            for uid in state.correct_user_ids:
                if uid in state.registered_players:
                    winner = state.registered_players[uid]
                    winner.points += question["points"]
                    lines.append(f"• <b>{winner.full_name}</b>: +{question['points']} 🪙 (Баланс: {winner.points} фишек)")
            lines.append(f"\n{random.choice(GENERAL_JOKES)}\n")
        else:
            lines.append(
                f"💨 <b>Никто из игроков не угадал!</b>\n"
                f"Крупье сметает все фишки в банк! 🧹\n"
                f"{random.choice(WRONG_JOKES)}\n"
            )

        lines.append("👉 <i>Крупье, отправьте /next для следующего вопроса!</i>")
        await answer_fn("\n".join(lines))

@router.callback_query(F.data.startswith("choice:"))
async def on_choice_callback(callback: CallbackQuery):
    if not callback.from_user or not callback.message:
        return

    parts = callback.data.split(":")
    if len(parts) != 3:
        await callback.answer("Ошибка формата данных кнопки.", show_alert=True)
        return

    q_idx = int(parts[1])
    opt_num = parts[2]

    state = get_chat_state(callback.message.chat.id)
    if not state.is_active or state.current_index != q_idx:
        await callback.answer("⚠️ Этот вопрос уже неактивен!", show_alert=True)
        return

    user_id = callback.from_user.id
    if user_id not in state.registered_players:
        await callback.answer("⚠️ Вы ещё не за столом! Сначала отправьте /join в чат.", show_alert=True)
        return

    if user_id in state.attempted_user_ids:
        await callback.answer("⚠️ Ваша ставка в этом раунде уже принята!", show_alert=True)
        return

    await callback.answer(f"✅ Ваш выбор: Вариант {opt_num}!")

    await process_player_input(
        chat_id=callback.message.chat.id,
        user_id=user_id,
        user_name=callback.from_user.full_name,
        username=callback.from_user.username,
        raw_answer=opt_num,
        reply_fn=callback.message.reply,
        answer_fn=callback.message.answer
    )

@router.message(F.text & ~F.text.startswith("/"))
async def handle_answer(message: Message):
    await process_player_input(
        chat_id=message.chat.id,
        user_id=message.from_user.id,
        user_name=message.from_user.full_name,
        username=message.from_user.username,
        raw_answer=message.text,
        reply_fn=message.reply,
        answer_fn=message.answer
    )

async def main():
    if not BOT_TOKEN:
        logger.error("BOT_TOKEN не задан! Задайте переменную окружения BOT_TOKEN.")
        sys.exit(1)

    bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.include_router(router)

    logger.info("🚀 Бот Казино-Викторины запущен! Рулетка крутится...")
    await bot.delete_webhook(drop_pending_updates=True)
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("🛑 Бот остановлен.")
