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
from aiogram.types import Message

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
        "text": "⚡ [НА СКОРОСТЬ] Сколько секунд в ровно 3 минутах?",
        "type": "first",
        "points": 15,
        "answers": ["180", "180 секунд", "180 сек"],
        "explanation": "В одной минуте 60 секунд. 3 × 60 = 180."
    },
    {
        "id": "q7",
        "text": "Какое озеро является самым глубоким на планете Земля?",
        "type": "general",
        "points": 15,
        "answers": ["байкал", "озеро байкал", "baikal"],
        "explanation": "Максимальная глубина пресноводного озера Байкал составляет 1642 метра."
    },
    {
        "id": "q8",
        "text": "⚡ [НА СКОРОСТЬ] Какое число в рулетке европейского казино окрашено в зелёный цвет?",
        "type": "first",
        "points": 20,
        "answers": ["0", "зеро", "ноль", "zero"],
        "explanation": "В европейской рулетке ровно один зелёный сектор — Зеро (0). В американской их два: 0 и 00."
    },
    {
        "id": "q9",
        "text": "Какой океан является самым большим по площади на Земле?",
        "type": "general",
        "points": 10,
        "answers": ["тихий", "тихий океан", "pacific", "pacific ocean"],
        "explanation": "Тихий океан занимает более трети всей поверхности планеты Земля."
    },
    {
        "id": "q10",
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
                cursor.execute("SELECT id, text, type, points, answers, explanation FROM questions ORDER BY sort_order ASC, rowid ASC")
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

                        parsed_list.append({
                            "id": str(row[0]),
                            "text": str(row[1]),
                            "type": str(row[2]),
                            "points": int(row[3]) if row[3] else 10,
                            "answers": answers,
                            "explanation": str(row[5] or "")
                        })
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
        "🎰 <b>ДОБРО ПОЖАЛОВАТЬ В ИНТЕЛЛЕКТУАЛЬНОЕ КАЗИНО!</b> 🎰\\n\\n"
        "Правила игры за нашим столом:\\n"
        "1. <b>/join</b> — Обязательно для каждого! Вступить в игру.\\n"
        "2. <b>/leave</b> — Выйти из-за стола с сохранением очков.\\n"
        "3. <b>/next</b> — Выдать следующий вопрос (крупье).\\n"
        "4. <b>/stat</b> — Таблица лидеров и банкролл CasinoCoins 🪙\\n"
        "5. <b>/reload</b> — Синхронизировать вопросы из Web UI!\\n"
        "6. <b>/roulette</b> — Коварная рулетка ва-банк!\\n\\n"
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
            f"🎲 <b>{user.full_name}</b> занял(а) место за столом!\\n"
            f"Баланс: <b>{stat.points} CasinoCoins 🪙</b>\\n"
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
            f"👋 <b>{stat.full_name}</b> покинул(а) игровой стол.\\n"
            f"Банкролл <b>{stat.points} CasinoCoins 🪙</b> сохранён! При вводе /join он восстановится."
        )

@router.message(Command("players"))
async def cmd_players(message: Message):
    state = get_chat_state(message.chat.id)
    if not state.registered_players:
        await message.answer("За столом пока никого нет! Напишите <b>/join</b>.")
        return

    lines = [f"👥 <b>Игроки за столом ({len(state.registered_players)} чел.):</b>\\n"]
    for idx, (uid, stat) in enumerate(state.registered_players.items(), 1):
        lines.append(f"{idx}. <b>{stat.full_name}</b> (@{stat.username or 'user'}) — {stat.points} 🪙")
    await message.answer("\\n".join(lines))

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

        if question["type"] == "first":
            badge = "⚡ <b>РАУНД НА СКОРОСТЬ!</b> (Куш первому верному!)"
            points_text = f"+{question['points']} CasinoCoins 🪙"
        else:
            badge = "🌟 <b>ОБЩИЙ РАУНД</b> (Фишки каждому угадавшему)"
            points_text = f"+{question['points']} CasinoCoins 🪙"

        text = (
            f"━━━━━━━━━━━━━━━━━━━━\\n"
            f"❓ <b>Вопрос {q_num} из {total_q}</b>\\n"
            f"{badge}\\n\\n"
            f"<b>{question['text']}</b>\\n\\n"
            f"💰 <i>На кону: {points_text}</i>\\n"
            f"🪑 <i>Игроков за столом: {total_players} чел.</i>\\n"
            f"✍️ <i>Пишите ваш ответ прямо в чат!</i>\\n"
            f"━━━━━━━━━━━━━━━━━━━━"
        )
        await message.answer(text)

@router.message(Command("reload", "sync"))
async def cmd_reload(message: Message):
    count = load_questions_from_source()
    await message.reply(
        f"🔄 <b>Вопросы синхронизированы с UI!</b>\\n\\n"
        f"📚 Всего вопросов в базе: <b>{count}</b>\\n"
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
    lines = ["🎰 <b>ИТОГОВЫЙ БАНКРОЛЛ КАЗИНО</b> 🎰\\n"]
    for idx, stat in enumerate(sorted_players, 1):
        status_in_room = "🟢 за столом" if stat.user_id in state.registered_players else "🚪 вне стола"
        title = RANK_TITLES[min(idx - 1, len(RANK_TITLES) - 1)]
        lines.append(
            f"{idx}. <b>{stat.full_name}</b> ({status_in_room})\\n"
            f"   💰 Банкролл: <b>{stat.points} 🪙</b> | Скорость: ⚡ {stat.speed_wins}\\n"
            f"   <i>{title}</i>\\n"
        )
    await message.answer("\\n".join(lines))

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
            f"🎰 <b>РУЛЕТКА ВА-БАНК!</b>\\n\\n"
            f"Ставка: <b>{old_points} 🪙</b>\\n"
            f"Множитель: <b>{multiplier:.1f}x</b>\\n"
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

@router.message(F.text & ~F.text.startswith("/"))
async def handle_answer(message: Message):
    state = get_chat_state(message.chat.id)

    if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
        if 0 <= state.current_index < len(QUESTIONS):
            await message.reply(
                "🛑 <b>Вопрос уже закрыт!</b> Ответы больше не принимаются.\\n"
                "👉 <i>Крупье, отправьте /next для перехода к следующему вопросу!</i>"
            )
        return

    user_id = message.from_user.id
    user_name = message.from_user.full_name
    username = message.from_user.username

    if user_id not in state.registered_players:
        return

    async with state.lock:
        question = QUESTIONS[state.current_index]

        if user_id in state.attempted_user_ids:
            await message.reply(f"⚠️ <b>{user_name}</b>, ставка уже сделана в этом раунде!")
            return

        state.attempted_user_ids.add(user_id)
        user_stat = state.registered_players[user_id]
        user_stat.full_name = user_name
        user_stat.username = username

        user_text = message.text.strip().lower()
        correct_variants = [a.lower() for a in question["answers"]]
        is_correct = any(user_text == variant or user_text == variant.strip() for variant in correct_variants)

        # 1. ВОПРОС НА СКОРОСТЬ
        if question["type"] == "first":
            if is_correct:
                state.is_active = False
                state.first_winner_id = user_id
                user_stat.points += question["points"]
                user_stat.speed_wins += 1

                speed_joke = random.choice(SPEED_JOKES)
                await message.reply(
                    f"🎯 <b>В ТОЧКУ! БРАВО, {user_name}!</b>\\n"
                    f"Правильный ответ: <b>{question['answers'][0]}</b>\\n\\n"
                    f"🎉 <b>ДЖЕКПОТ СКОРОСТИ!</b>: <b>+{question['points']} CasinoCoins 🪙</b>\\n"
                    f"🎰 Баланс победителя: <b>{user_stat.points} фишек</b>\\n"
                    f"{speed_joke}\\n\\n"
                    f"🛑 <b>ВОПРОС ПОЛНОСТЬЮ ЗАКРЫТ! Ожидание других участников остановлено!</b>\\n"
                    f"👉 <i>Крупье, отправьте /next для перехода к следующему вопросу!</i>"
                )
                return
            else:
                wrong_joke = random.choice(WRONG_JOKES)
                await message.reply(
                    f"❌ <b>Мимо, {user_name}!</b> {wrong_joke}\\n"
                    f"⚡ В вопросе на скорость даётся 1 попытка. Гонка продолжается!"
                )
                return

        # 2. ОБЩИЙ ВОПРОС
        if is_correct:
            state.correct_user_ids.append(user_id)

        all_answered = all(uid in state.attempted_user_ids for uid in state.registered_players.keys())

        if not all_answered:
            await message.reply(
                f"🎲 <b>Ставка принята от {user_name}!</b> ⏳\\n"
                f"Ответили: {len(state.attempted_user_ids)} из {len(state.registered_players)} игроков."
            )
            return

        # Все ответили — подводим итоги
        state.is_active = False
        correct_answer = question["answers"][0]
        explanation = f"💡 <i>{question['explanation']}</i>\\n\\n" if question.get("explanation") else ""

        lines = [
            f"🔔 <b>ВСЕ СТАВКИ СДЕЛАНЫ! КРУПЬЕ ВСКРЫВАЕТ КАРТЫ!</b> 🔔\\n",
            f"🎯 Правильный ответ: <b>{correct_answer}</b>",
            explanation
        ]

        if state.correct_user_ids:
            lines.append("🎉 <b>Игроки, сорвавшие куш в этом раунде:</b>")
            for uid in state.correct_user_ids:
                if uid in state.registered_players:
                    winner = state.registered_players[uid]
                    winner.points += question["points"]
                    lines.append(f"• <b>{winner.full_name}</b>: +{question['points']} 🪙 (Баланс: {winner.points} фишек)")
            lines.append(f"\\n{random.choice(GENERAL_JOKES)}\\n")
        else:
            lines.append(
                f"💨 <b>Никто из игроков не угадал!</b>\\n"
                f"Крупье сметает все фишки в банк! 🧹\\n"
                f"{random.choice(WRONG_JOKES)}\\n"
            )

        lines.append("👉 <i>Крупье, отправьте /next для следующего вопроса!</i>")
        await message.answer("\\n".join(lines))

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
