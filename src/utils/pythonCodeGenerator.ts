import { Question } from '../types';

export function generateBotPy(questions: Question[], customToken?: string, inlineToken: boolean = false): string {
  const questionsJson = JSON.stringify(
    questions.map((q, idx) => ({
      id: idx + 1,
      text: q.text,
      type: q.type,
      points: q.points,
      answers: q.answers.map(a => a.trim().toLowerCase()),
      explanation: q.explanation || ''
    })),
    null,
    4
  );

  const tokenSetupCode = inlineToken
    ? `# Токен указан напрямую:
BOT_TOKEN = "${customToken?.trim() || '1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ'}"`
    : `# Загружаем переменные из .env файла
load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")

if not BOT_TOKEN:
    print("❌ ОШИБКА: Токен не найден! Создайте файл .env и укажите BOT_TOKEN=ваш_токен")
    sys.exit(1)`;

  return `# =====================================================================
# Telegram Quiz Bot на aiogram 3.x
# Тематика: Интеллектуальное Казино 🎰
# Баллы конвертируются 1:1 в CasinoCoins (фишки для казино)!
#
# Механика:
#   1. Игроки входят в игру командой /join (обязательно!)
#   2. На каждый вопрос каждый игрок дает свой ответ.
#   3. Как только ВСЕ зарегистрированные ответили (верно или неверно) —
#      раунд автоматически ЗАКРЫВАЕТСЯ и больше не принимает ответы!
#
# Команды:
#   /start   - Приветствие, правила и конвертация фишек
#   /join    - Вступить в викторину (обязательно для участия!)
#   /players - Список зарегистрированных участников за столом
#   /next    - Выдать следующий вопрос (крупье/ведущий)
#   /current - Повторить текущий вопрос и статус ответов
#   /stat    - Баланс фишек для казино и таблица лидеров
#   /reset   - Сбросить игру и регистрацию
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

${tokenSetupCode}

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ==========================================
# 1. БАЗА ВОПРОСОВ И ДИНАМИЧЕСКАЯ СИНХРОНИЗАЦИЯ (БД SQLITE / ФАЙЛ / API)
# ==========================================

QUESTIONS_DB_PATH = os.getenv("QUESTIONS_DB_PATH", "data/quiz.db")
QUESTIONS_FILE_PATH = os.getenv("QUESTIONS_FILE_PATH", "data/questions.json")
QUESTIONS_API_URL = os.getenv("QUESTIONS_API_URL", "http://localhost:3000/api/questions")

# Резервная база вопросов (встроенная в код)
EMBEDDED_QUESTIONS: List[dict] = ${questionsJson}
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

    # 2. Проверяем локальный файл data/questions.json или указанный через переменные
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
                        logger.info(f"✅ Вопросы успешно загружены из {p} ({len(QUESTIONS)} шт.)")
                        return len(QUESTIONS)
            except Exception as e:
                logger.warning(f"Ошибка чтения {p}: {e}")

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
                        logger.info(f"✅ Вопросы успешно синхронизированы через API {QUESTIONS_API_URL} ({len(QUESTIONS)} шт.)")
                        return len(QUESTIONS)
        except Exception as e:
            logger.debug(f"API {QUESTIONS_API_URL} недоступен: {e}")

    return len(QUESTIONS)

# Первичная загрузка вопросов при старте бота
load_questions_from_source()


# Шутки крупье при правильном ответе на общий вопрос
GENERAL_JOKES = [
    "🎰 Казна казино нервно задрожала, а ваши карманы потяжелели!",
    "🃏 Крупье уже вытирает холодный пот со лба! Отличный выстрел!",
    "🧠 Эйнштейн одобрительно кивает, а казино медленно банкротится!",
    "🪙 Дзынь-дзынь! Фишечки полетели прямиком в ваш банкролл.",
    "🥂 Красиво ворвался! На эти фишки уже можно шикануть у рулетки.",
    "🎩 Интеллект 100-го уровня! Бармен наливает вам виртуальный коктейль за счёт заведения."
]

# Шутки при первом ответе на скорость
SPEED_JOKES = [
    "🏎️💨 Флэш нервно курит в углу! Ты сорвал весь куш раунда!",
    "⚡ Пальцы быстрее скорости звука! Крупье не успел даже моргнуть, а фишки уже твои!",
    "🤑 Остальные участники ещё шевелили губами, читая вопрос, а ты уже грабишь казино!",
    "👑 Реакция мангуста! Главный претендент на золотой VIP-стол в казино!",
    "🎯 Прямо в яблочко и первым! Остальным участникам остаётся только завидовать твоему банкроллу."
]

# Шутки для опоздавших на вопрос на скорость (но ответивших верно)
LATE_JOKES = [
    "Увы! Первый куш уже сорван другим счастливчиком. В казино слоупоков не кредитуют! 🐌",
    "Опоздал на долю секунды! Крупье уже закрыл ставки и унёс фишки первому победителю 🚪",
    "Ответ верный, но фортуна и скорость сегодня у другого. Тренируй пальцы к следующему раунду! ⏱️",
    "Ставки сделаны, ставок больше нет! Весь банк забрал самый быстрый стрелок Дикого Запада 🤠"
]

# Шутки при неверном ответе
WRONG_JOKES = [
    "Мимо рулетки! Шарик предательски упал на зеро — фишки уходят казино! 💸",
    "Ставка не зашла! Крупье с улыбкой сгребает ставки лопаткой 🎲",
    "Интуиция взяла перекур! Но в казино главное — не унывать, впереди новые раунды! 🃏",
    "Блеф не удался! Мимо кассы, зато какая смелая попытка! 🎰",
    "Бармен сочувственно качает головой и наливает воды со льдом 🍸"
]

# Статусы для таблицы лидеров
RANK_TITLES = [
    "👑 Олигарх вечера / Владелец казино",
    "🎩 VIP-хайроллер с полными карманами",
    "🎲 Опытный игрок, чует удачу за версту",
    "🪙 Перспективный лудоман",
    "📉 Срочно требуется беспроцентный микрозайм"
]

# Хитрый мультипликатор рулетки: значения от 0.0 до 2.0 (шаг 0.1)
# Настроен по законам казино: в ~86% случаев уводит в минус или обнуляет баланс!
# (множитель, вес вероятности)
ROULETTE_WEIGHTED_CONFIG = [
    (0.0, 14.0),  # Сектор ЗЕРО: 14% шанс полного обнуления
    (0.1, 12.0),  # -90% фишек
    (0.2, 10.0),  # -80% фишек
    (0.3, 10.0),  # -70% фишек
    (0.4, 9.0),   # -60% фишек
    (0.5, 9.0),   # -50% (половина банка)
    (0.6, 7.0),   # -40% фишек
    (0.7, 6.0),   # -30% фишек
    (0.8, 5.0),   # -20% фишек
    (0.9, 4.0),   # -10% фишек
    # Суммарный шанс убытка (< 1.0): ~86%
    (1.0, 5.0),   # Ничья (возврат): 5%
    # Суммарный шанс прибыли (> 1.0): ~9%
    (1.1, 2.0),
    (1.2, 1.8),
    (1.3, 1.5),
    (1.4, 1.2),
    (1.5, 1.0),
    (1.6, 0.6),
    (1.7, 0.4),
    (1.8, 0.3),
    (1.9, 0.15),
    (2.0, 0.05),  # Джекпот x2.0: редчайшее чудо (0.05%)
]

ROULETTE_MULTIPLIERS = [item[0] for item in ROULETTE_WEIGHTED_CONFIG]
ROULETTE_WEIGHTS = [item[1] for item in ROULETTE_WEIGHTED_CONFIG]

# Шутки для рулетки
ROULETTE_ZERO_JOKES = [
    "💀 ЗЕРО! Шарик предательски запрыгнул в зелёный сектор! Все фишки сгорели дотла! Крупье сочувственно улыбается и сметает банк лопаткой 🧹",
    "💸 Полное обнуление! Фортуна сегодня отвернулась и ушла пить кофе. Баланс 0 фишек! 💨",
    "📉 Черная дыра азарта поглотила весь банкролл! Зато адреналин был на все 100%! 🚀",
    "🧲 Невидимый магнит под зеленым сукном стола сработал безукоризненно! Казино не победить 🎩"
]

ROULETTE_LOSS_JOKES = [
    "📉 Хитрый стол казино забрал своё! Множитель меньше единицы — банкролл заметно похудел 🏛️",
    "😬 Меньше единицы — казино всегда в плюсе! Но часть фишек уцелела, держитесь! 🪙",
    "🎲 Крупье незаметно подмигнул и подкрутил колесо! Легкий минус — это инвестиция в опыт 🧹",
    "📉 Коварная гравитация заведения засосала часть фишек в фонд золотых унитазов 💸"
]

ROULETTE_WIN_JOKES = [
    "📈 Куш в кармане! Невероятно, но вам удалось перехитрить колесо казино! 💰",
    "✨ Охрана заведения напряглась: кто-то уносит прибыль вопреки теории вероятностей! 🥂🚨",
    "🎩 Настоящий хайроллер! Колесо фортуны дрогнуло и выдало плюс! 🎰"
]

ROULETTE_JACKPOT_JOKES = [
    "🔥 ДЖЕКПОТ! МАКСИМАЛЬНЫЙ МНОЖИТЕЛЬ x2.0! Чудо на 0.05%! Вы удвоили весь свой банк! 🚀🎉",
    "👑 НЕВЕРОЯТНО! Колесо выдало редчайший максимум x2.0! Владелец казино нервно пьёт валидол! 💥"
]

# ==========================================
# 2. МОДЕЛИ СОСТОЯНИЯ (ДЛЯ КАЖДОГО ЧАТА)
# ==========================================

@dataclass
class UserStats:
    user_id: int
    full_name: str
    username: Optional[str] = None
    points: int = 0
    correct_count: int = 0
    first_place_count: int = 0

@dataclass
class ChatQuizState:
    current_index: int = -1  # -1 = викторина еще не начата
    is_active: bool = False

    # Зарегистрированные участники, которые ввели /join
    # user_id -> UserStats
    registered_players: Dict[int, UserStats] = field(default_factory=dict)

    # Сохраненный банкролл игроков, которые вышли из стола через /leave (очки сохраняются!)
    bankroll_archive: Dict[int, UserStats] = field(default_factory=dict)

    # Игроки, которые УЖЕ дали ответ на текущий вопрос (верный или неверный!)
    attempted_user_ids: Set[int] = field(default_factory=set)

    # Список ID игроков, ответивших ПРАВИЛЬНО на текущий вопрос (по порядку поступления)
    correct_user_ids: List[int] = field(default_factory=list)

    # Игроки, которые получили баллы за текущий вопрос
    awarded_user_ids: Set[int] = field(default_factory=set)

    # Кто первый ответил на вопрос типа 'first'
    first_winner_id: Optional[int] = None

    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

chat_states: Dict[int, ChatQuizState] = {}

def get_chat_state(chat_id: int) -> ChatQuizState:
    if chat_id not in chat_states:
        chat_states[chat_id] = ChatQuizState()
    return chat_states[chat_id]

# ==========================================
# 3. МАРШРУТИЗАЦИЯ И ХЕНДЛЕРЫ
# ==========================================

router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    """Приветствие с правилами регистрации (/join), выхода (/leave) и фишками казино."""
    text = (
        "👋 <b>Добро пожаловать в Интеллектуальное Казино!</b> 🎰🎲\\n\\n"
        "Здесь знания превращаются в реальный банкролл для казино!\\n\\n"
        "💰 <b>КУРС ВАЛЮТЫ:</b>\\n"
        "Каждое очко = <b>1 CasinoCoin (🪙 Фишка Казино)</b>!\\n"
        "В конце игры вы обменяете заработанные баллы на физические фишки "
        "для игры в рулетку, покер и блэкджек! 🃏✨\\n\\n"
        "🚨 <b>ОБЯЗАТЕЛЬНОЕ ПРАВИЛО УЧАСТИЯ:</b>\\n"
        "Каждый участник должен отправить команду <b>/join</b> в этот чат!\\n"
        "Без этого ваши ответы не будут засчитываться!\\n\\n"
        "⚡ <b>РЕЖИМЫ ВОПРОСОВ:</b>\\n"
        "• <b>На скорость:</b> завершается мгновенно при первом верном ответе — ждать остальных не нужно!\\n"
        "• <b>Общий вопрос:</b> ждём ставок всех игроков за столом, после чего оглашаем ответ.\\n\\n"
        "🎮 <b>Команды:</b>\\n"
        "• <b>/join</b> — зарегистрироваться за игровым столом\\n"
        "• <b>/leave</b> — выйти из-за стола (все ваши очки сохраняются!)\\n"
        "• <b>/players</b> — список игроков за столом\\n"
        "• <b>/next</b> — выдать следующий вопрос (крупье)\\n"
        "• <b>/current</b> — статус текущего вопроса\\n"
        "• <b>/stat</b> — банкролл и таблица лидеров\\n"
        "• <b>/roulette</b> — 🎰 РУЛЕТКА ВА-БАНК! Поставить все фишки (множитель 0.0 – 2.0)\\n"
        "• <b>/reset</b> — сбросить игру и регистрацию\\n\\n"
        "👉 <i>Отправьте <b>/join</b>, чтобы сесть за игровой стол!</i>"
    )
    await message.answer(text)

@router.message(Command("join", "play", "reg"))
async def cmd_join(message: Message):
    """Регистрация или возвращение участника за игровой стол."""
    state = get_chat_state(message.chat.id)
    user = message.from_user
    user_id = user.id

    async with state.lock:
        if user_id in state.registered_players:
            await message.reply(
                f"🎲 <b>{user.full_name}</b>, вы уже сидите за игровым столом! Ждите следующий вопрос."
            )
            return

        # Если игрок ранее выходил через /leave, восстанавливаем его сохраненные очки
        if user_id in state.bankroll_archive:
            user_stat = state.bankroll_archive.pop(user_id)
            user_stat.full_name = user.full_name
            user_stat.username = user.username
            state.registered_players[user_id] = user_stat
        else:
            state.registered_players[user_id] = UserStats(
                user_id=user_id,
                full_name=user.full_name,
                username=user.username
            )

        saved_points = state.registered_players[user_id].points
        total_players = len(state.registered_players)

    saved_info = f"\\n💰 Ваш сохранённый банкролл: <b>{saved_points} CasinoCoins 🪙</b>!" if saved_points > 0 else ""
    await message.reply(
        f"✅ <b>{user.full_name} успешно вступил в игру!</b> 🎰\\n"
        f"За игровым столом участников: <b>{total_players}</b>.{saved_info}\\n"
        f"Теперь ваши ответы будут учитываться, а очки пойдут в банкролл фишек!\\n"
        f"🪑 <i>Вы остаетесь за столом на все последующие вопросы викторины (для выхода используйте /leave)!</i>"
    )

@router.message(Command("leave", "exit"))
async def cmd_leave(message: Message):
    """Выход из игрового стола с полным сохранением заработанных очков."""
    state = get_chat_state(message.chat.id)
    user = message.from_user
    user_id = user.id

    async with state.lock:
        if user_id not in state.registered_players:
            await message.reply(
                f"⚠️ <b>{user.full_name}</b>, вы сейчас не за игровым столом!\\n"
                f"Отправьте команду <b>/join</b>, чтобы войти в игру."
            )
            return

        user_stat = state.registered_players.pop(user_id)
        state.bankroll_archive[user_id] = user_stat
        saved_points = user_stat.points
        remaining_count = len(state.registered_players)

    await message.reply(
        f"🚪 <b>{user.full_name} покинул(а) игровой стол!</b>\\n\\n"
        f"💰 <b>Ваши очки в полной сохранности:</b> {saved_points} CasinoCoins 🪙!\\n"
        f"👥 За столом осталось участников: <b>{remaining_count}</b>.\\n"
        f"<i>Вы можете вернуться в любой момент по команде <b>/join</b> — все ваши фишки сохранятся!</i>"
    )

    # Если шел общий вопрос и все оставшиеся игроки уже ответили — завершаем раунд
    async with state.lock:
        if (
            state.is_active
            and 0 <= state.current_index < len(QUESTIONS)
            and QUESTIONS[state.current_index]["type"] == "general"
            and state.registered_players
            and all(uid in state.attempted_user_ids for uid in state.registered_players.keys())
        ):
            state.is_active = False
            q = QUESTIONS[state.current_index]
            expl = f"\\n💡 <i>{q['explanation']}</i>" if q.get("explanation") else ""
            correct_sample = q["answers"][0] if q.get("answers") else ""
            points = q["points"]

            result_lines = [
                f"🛑 <b>СТАВКИ ЗАКРЫТЫ!</b> Все оставшиеся за столом игроки сделали свой ход!\\n",
                f"🎯 <b>Правильный ответ:</b> <b>{correct_sample}</b>{expl}\\n"
            ]

            valid_winners = [uid for uid in state.correct_user_ids if uid in state.registered_players]
            if valid_winners:
                result_lines.append("🏆 <b>ПРАВИЛЬНО ОТВЕТИЛИ И ПОЛУЧАЮТ ФИШКИ:</b>")
                for w_id in valid_winners:
                    w_stat = state.registered_players[w_id]
                    w_stat.points += points
                    w_stat.correct_count += 1
                    result_lines.append(f"• 👤 <b>{w_stat.full_name}</b>: +{points} CasinoCoins 🪙 (Баланс: <b>{w_stat.points} фишек</b>)")
                result_lines.append(f"\\n{random.choice(GENERAL_JOKES)}")
            else:
                result_lines.append(f"💨 <b>Никто из оставшихся за столом не угадал!</b>\\nКрупье сметает все фишки в банк казино! 🧹\\n{random.choice(WRONG_JOKES)}")

            result_lines.append("\\n👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>")
            await message.answer("\\n".join(result_lines))

@router.message(Command("players"))
async def cmd_players(message: Message):
    """Список зарегистрированных игроков."""
    state = get_chat_state(message.chat.id)

    if not state.registered_players:
        await message.answer(
            "🪑 За игровым столом пока никого нет!\\n"
            "Отправьте команду <b>/join</b>, чтобы вступить в викторину!"
        )
        return

    lines = [
        f"👥 <b>Игроки за столом ({len(state.registered_players)} чел.):</b>\\n"
        f"<i>(Для выхода из-за стола с сохранением очков используйте /leave)</i>\\n"
    ]
    for idx, (uid, stat) in enumerate(state.registered_players.items(), 1):
        lines.append(f"{idx}. <b>{stat.full_name}</b> (@{stat.username or 'user'}) — {stat.points} 🪙")

    await message.answer("\\n".join(lines))

@router.message(Command("next"))
async def cmd_next(message: Message):
    """Выдача следующего вопроса."""
    state = get_chat_state(message.chat.id)

    async with state.lock:
        if not state.registered_players:
            await message.answer(
                "⚠️ <b>За столом нет зарегистрированных игроков!</b>\\n\\n"
                "Пусть участники напишут команду <b>/join</b>, чтобы бот мог отслеживать их ответы!"
            )
            return

        # Автоматическая синхронизация: перед выдачей следующего вопроса проверяем обновления из UI / файла
        load_questions_from_source()

        state.current_index += 1

        # Если вопросы закончились
        if state.current_index >= len(QUESTIONS):
            state.is_active = False
            await message.answer(
                "🏁 <b>Все вопросы викторины завершены!</b> 🎰\\n\\n"
                "Игровой стол закрывается! Все игроки оставались за столом до самого конца викторины.\\n"
                "Время подводить итоги и получать фишки для казино! 🪙✨\\n\\n"
                "Отправьте команду <b>/stat</b>, чтобы увидеть финальный баланс фишек каждого игрока! 🏆\\n\\n"
                "<i>Для запуска новой игры крупье может отправить <b>/reset</b>.</i>"
            )
            return

        # Назначаем новый вопрос
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
            badge = "⚡ <b>РАУНД НА СКОРОСТЬ!</b> (Куш заберёт первый правильный ответ!)"
            points_text = f"+{question['points']} CasinoCoins 🪙 первому правильному"
            instruction = "⚡ <i>Вопрос на скорость: как только поступит ПЕРВЫЙ правильный ответ — вопрос сразу завершается, ждать остальных не нужно!</i>"
        else:
            badge = "🌟 <b>ОБЩИЙ РАУНД</b> (Фишки каждому правильному)"
            points_text = f"+{question['points']} CasinoCoins 🪙 каждому"
            instruction = f"👥 <i>Общий раунд: ждём скрытых ставок от всех <b>{total_players}</b> игроков за столом, затем огласим верный ответ!</i>"

        text = (
            f"━━━━━━━━━━━━━━━━━━━━\\n"
            f"❓ <b>Вопрос {q_num} из {total_q}</b>\\n"
            f"{badge}\\n\\n"
            f"<b>{question['text']}</b>\\n\\n"
            f"💰 <i>На кону: {points_text}</i>\\n"
            f"🪑 <i>Игроки за столом ({total_players} чел.): остаются до завершения всех вопросов</i>\\n"
            f"{instruction}\\n"
            f"✍️ <i>Пишите ваш ответ прямо в чат!</i>\\n"
            f"━━━━━━━━━━━━━━━━━━━━"
        )
        await message.answer(text)

@router.message(Command("current"))
async def cmd_current(message: Message):
    """Повтор текущего активного вопроса и статус ответивших."""
    state = get_chat_state(message.chat.id)

    if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
        if 0 <= state.current_index < len(QUESTIONS):
            q = QUESTIONS[state.current_index]
            winner_text = ""
            if state.first_winner_id:
                winner_obj = state.registered_players.get(state.first_winner_id) or state.bankroll_archive.get(state.first_winner_id)
                if winner_obj:
                    winner_text = f"🏆 Победитель раунда на скорость: <b>{winner_obj.full_name}</b>\\n"
            await message.answer(
                f"🛑 <b>Вопрос №{state.current_index + 1} ЗАКРЫТ!</b> 🏁\\n\\n"
                f"<b>{q['text']}</b>\\n\\n"
                f"{winner_text}"
                f"🎯 Правильный ответ: <b>{q['answers'][0]}</b>\\n\\n"
                f"✅ <i>Ожидание остановлено, раунд завершён. Крупье, отправьте <b>/next</b> для следующего вопроса!</i>"
            )
            return
        await message.answer("Сейчас нет активного раунда. Отправьте /next, чтобы запустить вопрос!")
        return

    q = QUESTIONS[state.current_index]
    type_desc = "⚡ На скорость (куш первому)" if q["type"] == "first" else "🌟 Общий (каждому)"

    if q["type"] == "first":
        await message.answer(
            f"⚡ <b>Текущий вопрос №{state.current_index + 1} (На скорость)</b>:\\n\\n"
            f"<b>{q['text']}</b>\\n\\n"
            f"💰 На кону: +{q['points']} CasinoCoins 🪙\\n"
            f"🏁 <i>Гонка за куш продолжается! Как только поступит ПЕРВЫЙ верный ответ — вопрос сразу закроется без ожидания других!</i>"
        )
        return

    total_reg = len(state.registered_players)
    answered_count = len(state.attempted_user_ids)

    # Список тех, кого ещё ждем
    waiting_names = [
        p.full_name for uid, p in state.registered_players.items()
        if uid not in state.attempted_user_ids
    ]
    waiting_str = ", ".join(waiting_names) if waiting_names else "Все ответили!"

    await message.answer(
        f"🎲 <b>Текущий вопрос №{state.current_index + 1} ({type_desc})</b>:\\n\\n"
        f"<b>{q['text']}</b>\\n\\n"
        f"💰 На кону: +{q['points']} фишек (CasinoCoins 🪙)\\n"
        f"📊 Статус: ставок сделано <b>{answered_count} из {total_reg}</b>\\n"
        f"⏳ Ждём ставки: <i>{waiting_str}</i>"
    )

@router.message(Command("reload", "sync"))
async def cmd_reload(message: Message):
    """Синхронизация вопросов из UI / data/questions.json без перезапуска бота."""
    count = load_questions_from_source()
    await message.reply(
        f"🔄 <b>Вопросы синхронизированы с UI!</b>\\n\\n"
        f"📚 Всего вопросов в базе: <b>{count}</b>\\n"
        f"<i>Все изменения, добавленные в веб-интерфейсе, уже применились к боту.</i>"
    )

@router.message(Command("stat"))
async def cmd_stat(message: Message):
    """Вывод итоговой статистики с балансом фишек для казино."""
    state = get_chat_state(message.chat.id)

    all_players = {**state.bankroll_archive, **state.registered_players}
    if not all_players:
        await message.answer(
            "📊 В кассе пока пусто — никто ещё не вступил в игру через /join! 🎰"
        )
        return

    # Сортировка по очкам (по убыванию)
    sorted_users = sorted(all_players.values(), key=lambda u: (u.points, u.correct_count), reverse=True)

    medals = ["🥇", "🥈", "🥉"]
    lines = [
        "🎰 <b>БАЛАНС ФИШЕК ДЛЯ КАЗИНО (ТАБЛИЦА ЛИДЕРОВ):</b>\\n",
        "<i>Курс: 1 очко = 1 CasinoCoin 🪙 для игры в рулетку и блэкджек</i>\\n"
    ]

    for idx, user in enumerate(sorted_users, 1):
        medal = medals[idx - 1] if idx <= 3 else f"{idx}."
        user_tag = f"@{user.username}" if user.username else user.full_name
        title_idx = min(idx - 1, len(RANK_TITLES) - 1)
        role_title = RANK_TITLES[title_idx]
        is_at_table = user.user_id in state.registered_players
        status_badge = " <i>(за столом)</i>" if is_at_table else " <i>(вышел, очки сохранены)</i>"

        lines.append(
            f"{medal} <b>{user.full_name}</b> ({user_tag}){status_badge}\\n"
            f"   💰 Банкролл: <b>{user.points} CasinoCoins 🪙</b> "
            f"<i>({role_title})</i>\\n"
            f"   📊 Правильных: {user.correct_count} | Скоростных: {user.first_place_count}\\n"
        )

    total_pool = sum(u.points for u in sorted_users)
    lines.append(
        f"🎲 <i>Общий банкролл игроков: {total_pool} фишек. Очки сохраняются при выходе из-за стола (/leave) и обмениваются у крупье перед игрой! Всё на красное! 🚀</i>"
    )
    await message.answer("\\n".join(lines))

@router.message(Command("roulette", "spin", "рулетка"))
async def cmd_roulette(message: Message):
    """Метод рулетка: ставит ВСЕ накопленные очки на рулетку с дробным мультипликатором от 0.0 до 2.0."""
    state = get_chat_state(message.chat.id)
    user = message.from_user
    user_id = user.id

    async with state.lock:
        if user_id not in state.registered_players:
            await message.reply(
                "⚠️ <b>Вы ещё не за игровым столом!</b>\\n"
                "Сначала отправьте команду <b>/join</b>, чтобы вступить в викторину и заработать фишки!"
            )
            return

        player = state.registered_players[user_id]
        current_points = player.points

        if current_points <= 0:
            await message.reply(
                f"🚫 <b>{user.full_name}</b>, ваш банкролл: <b>0 фишек</b> (CasinoCoins 🪙)!\\n\\n"
                f"Казино в долг не кредитует, а под честное слово фишки на рулетку не ставятся! 🙅‍♂️\\n"
                f"Заработайте фишки правильными ответами по команде <b>/next</b>!"
            )
            return

        # Игрок ставит ВСЕ свои очки (All-In)
        # Хитрый мультипликатор: взвешенный выбор, где ~86% уводит в убыток (< 1.0 или 0.0)
        multiplier = random.choices(ROULETTE_MULTIPLIERS, weights=ROULETTE_WEIGHTS, k=1)[0]
        new_points = int(round(current_points * multiplier))
        diff = new_points - current_points
        player.points = new_points

    wheel_header = (
        f"🎰 <b>РУЛЕТКА: СТАВКА ВА-БАНК!</b> 🔴⚫🟢\\n"
        f"👤 Игрок: <b>{user.full_name}</b>\\n"
        f"💰 Ставка: <b>{current_points} CasinoCoins 🪙 (ВСЕ ОЧКИ!)</b>\\n\\n"
        f"🎡 <i>Шарик с треском крутится по колесу рулетки...</i>\\n"
        f"🎯 <b>Выпавший мультипликатор: x{multiplier:.1f}</b>\\n\\n"
    )

    if multiplier == 0.0:
        joke = random.choice(ROULETTE_ZERO_JOKES)
        outcome = (
            f"💥 <b>ПОЛНЫЙ КРАХ! СЕКТОР ЗЕРО (x0.0)!</b>\\n"
            f"Все ваши <b>{current_points}</b> фишек сгорели дотла! 😱\\n"
            f"Новый банкролл: <b>0 CasinoCoins 🪙</b>\\n\\n"
            f"{joke}"
        )
    elif multiplier < 1.0:
        joke = random.choice(ROULETTE_LOSS_JOKES)
        lost = abs(diff)
        outcome = (
            f"📉 <b>УБЫТОК:</b> множитель <b>x{multiplier:.1f}</b>\\n"
            f"Потеряно: <b>-{lost}</b> фишек.\\n"
            f"Осталось в кармане: <b>{new_points} CasinoCoins 🪙</b>\\n\\n"
            f"{joke}"
        )
    elif multiplier == 1.0:
        outcome = (
            f"🔄 <b>НИЧЬЯ С КАЗИНО:</b> множитель <b>x1.0</b>\\n"
            f"Ваши <b>{current_points}</b> фишек вернулись без изменений!\\n"
            f"Крупье со вздохом протёр стол тряпочкой 🍸"
        )
    elif multiplier == 2.0:
        joke = random.choice(ROULETTE_JACKPOT_JOKES)
        outcome = (
            f"🔥🎉 <b>ДЖЕКПОТ! МАКСИМАЛЬНЫЙ КУШ x2.0!</b> 🚀\\n"
            f"Вы удвоили весь банк! Прибыль: <b>+{diff}</b> фишек! 🤑\\n"
            f"Новый банкролл: <b>{new_points} CasinoCoins 🪙</b>!\\n\\n"
            f"{joke}"
        )
    else:
        joke = random.choice(ROULETTE_WIN_JOKES)
        outcome = (
            f"💰📈 <b>ПОБЕДА:</b> множитель <b>x{multiplier:.1f}</b>!\\n"
            f"Чистая прибыль: <b>+{diff}</b> фишек!\\n"
            f"Новый банкролл: <b>{new_points} CasinoCoins 🪙</b>!\\n\\n"
            f"{joke}"
        )

    await message.answer(wheel_header + outcome)

@router.message(Command("reset"))
async def cmd_reset(message: Message):
    """Сброс результатов и регистрации."""
    state = get_chat_state(message.chat.id)
    async with state.lock:
        state.current_index = -1
        state.is_active = False
        state.first_winner_id = None
        state.registered_players.clear()
        state.attempted_user_ids.clear()
        state.correct_user_ids.clear()
        state.awarded_user_ids.clear()

    await message.answer(
        "🔄 <b>Казино обнулило счетчики!</b>\\n"
        "Все фишки аннулированы, регистрация сброшена, колода перетасована.\\n"
        "Участникам нужно заново отправить <b>/join</b>, а затем крупье запустит <b>/next</b>!"
    )

# ==========================================
# 4. ПРОВЕРКА ОТВЕТОВ И АВТОЗАВЕРШЕНИЕ ВОПРОСА
# ==========================================

@router.message(F.text & ~F.text.startswith("/"))
async def handle_user_answer(message: Message):
    """Проверка ответов, начисление фишек и проверка завершения вопроса."""
    state = get_chat_state(message.chat.id)

    if not state.is_active or state.current_index < 0 or state.current_index >= len(QUESTIONS):
        if 0 <= state.current_index < len(QUESTIONS):
            await message.reply(
                "🛑 <b>Вопрос уже закрыт!</b> Ожидание остановлено, ответы больше не принимаются.\\n"
                "👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>"
            )
        return

    user_id = message.from_user.id
    user_name = message.from_user.full_name
    username = message.from_user.username

    # Если пользователь просто написал слово 'рулетка' без слэша
    if message.text.strip().lower() in ["рулетка", "spin", "крутить"]:
        await cmd_roulette(message)
        return

    # 1. Проверяем, зарегистрирован ли игрок через /join
    if user_id not in state.registered_players:
        await message.reply(
            f"⚠️ <b>{user_name}</b>, вы ещё не за игровым столом!\\n"
            f"Отправьте команду <b>/join</b>, чтобы вступить в игру и копить фишки для казино!"
        )
        return

    async with state.lock:
        question = QUESTIONS[state.current_index]

        # 2. Проверяем, не отвечал ли пользователь уже на ЭТОТ вопрос
        if user_id in state.attempted_user_ids:
            if question["type"] == "first":
                await message.reply(
                    f"⚠️ <b>{user_name}</b>, вы уже сделали попытку на этот вопрос! В вопросах на скорость даётся 1 попытка."
                )
            else:
                await message.reply(
                    f"⚠️ <b>{user_name}</b>, ваша ставка уже принята! Ждём остальных игроков за столом ⏳"
                )
            return

        # Фиксируем, что игрок дал ответ (правильный или нет — ставка сделана!)
        state.attempted_user_ids.add(user_id)
        user_stat = state.registered_players[user_id]
        user_stat.full_name = user_name
        user_stat.username = username

        user_text = message.text.strip().lower()
        correct_variants = [a.lower() for a in question["answers"]]
        is_correct = any(user_text == variant or user_text == variant.strip() for variant in correct_variants)

        if is_correct:
            state.correct_user_ids.append(user_id)

        all_players = set(state.registered_players.keys())
        total_players = len(all_players)
        attempted_count = len(state.attempted_user_ids)
        all_answered = all_players and attempted_count >= total_players

        # -------------------------------------------------------------
        # ⚡ ВАРИАНТ 1: ВОПРОС НА СКОРОСТЬ ("first")
        # В вопросах на скорость не нужно ждать, пока все ответят!
        # Вопрос заканчивается, когда первый даёт правильный ответ!
        # -------------------------------------------------------------
        if question["type"] == "first":
            if is_correct:
                # ПЕРВЫЙ ПРАВИЛЬНЫЙ ОТВЕТ: ЗАКРЫВАЕМ ВОПРОС СРАЗУ!
                state.is_active = False
                state.first_winner_id = user_id
                state.awarded_user_ids.add(user_id)
                user_stat.points += question["points"]
                user_stat.correct_count += 1
                user_stat.first_place_count += 1

                speed_joke = random.choice(SPEED_JOKES)
                expl = f"\\n💡 <i>{question['explanation']}</i>" if question.get("explanation") else ""
                correct_sample = question["answers"][0] if question.get("answers") else ""

                await message.reply(
                    f"⚡ <b>ЕСТЬ ПЕРВЫЙ ВЕРНЫЙ ОТВЕТ! РАУНД НА СКОРОСТЬ ЗАКРЫТ!</b> 🏁\\n\\n"
                    f"👤 <b>{user_name}</b> молниеносно дал верный ответ: <b>{correct_sample}</b>{expl}\\n\\n"
                    f"🎉 <b>ДЖЕКПОТ СКОРОСТИ!</b> Забирает весь банк: <b>+{question['points']} CasinoCoins 🪙</b>\\n"
                    f"🎰 Баланс победителя: <b>{user_stat.points} фишек</b>\\n"
                    f"{speed_joke}\\n\\n"
                    f"🛑 <b>ВОПРОС ПОЛНОСТЬЮ ЗАКРЫТ! Ожидание других участников остановлено!</b>\\n"
                    f"👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>"
                )
                return
            else:
                if all_answered:
                    state.is_active = False
                    q_num = state.current_index + 1
                    expl = f"\\n💡 <i>{question['explanation']}</i>" if question.get("explanation") else ""
                    correct_sample = question["answers"][0] if question.get("answers") else ""
                    wrong_joke = random.choice(WRONG_JOKES)
                    await message.reply(
                        f"❌ <b>{user_name}</b>, мимо!\\n\\n"
                        f"🛑 <b>РАУНД НА СКОРОСТЬ ЗАКРЫТ!</b> 🏁\\n"
                        f"Все <b>{total_players}</b> игроков за столом сделали попытку, но никто не назвал верный ответ!\\n\\n"
                        f"🎯 Правильный ответ: <b>{correct_sample}</b>{expl}\\n"
                        f"💨 Все фишки остаются в кассе казино! 🏛️\\n"
                        f"{wrong_joke}\\n\\n"
                        f"👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>"
                    )
                    return
                else:
                    wrong_joke = random.choice(WRONG_JOKES)
                    await message.reply(
                        f"❌ <b>{user_name}</b>, мимо!\\n"
                        f"{wrong_joke}\\n\\n"
                        f"⚡ <i>Гонка за куш скорости продолжается! Кто первым назовёт правильный ответ?</i>"
                    )
                    return

        # -------------------------------------------------------------
        # 🌟 ВАРИАНТ 2: ОБЩИЙ ВОПРОС ("general")
        # Ставки скрыты, ждём всех игроков, затем объявляем ответ
        # -------------------------------------------------------------
        if not all_answered:
            await message.reply(
                f"🎲 <b>Ставка принята от {user_name}!</b> ⏳\\n"
                f"Принято ставок: <b>{attempted_count} из {total_players}</b>.\\n"
                f"<i>Ждём, пока все игроки за столом сделают свой ход...</i>"
            )
            return

        # Все ставки сделаны: закрываем ставки и выводим результаты
        state.is_active = False
        q_num = state.current_index + 1
        expl = f"\\n💡 <i>{question['explanation']}</i>" if question.get("explanation") else ""
        correct_sample = question["answers"][0] if question.get("answers") else ""
        points = question["points"]

        lines = [
            f"🎲 <b>Ставка принята от {user_name}!</b> (<b>{attempted_count} из {total_players}</b>)\\n",
            f"🛑 <b>СТАВКИ СДЕЛАНЫ, СТАВОК БОЛЬШЕ НЕТ!</b> 🎰\\n",
            f"Все <b>{total_players}</b> игроков за столом сделали свои ставки! Раунд №{q_num} официально закрыт!\\n\\n",
            f"🎯 <b>Правильный ответ:</b> <b>{correct_sample}</b>{expl}\\n"
        ]

        if state.correct_user_ids:
            general_joke = random.choice(GENERAL_JOKES)
            lines.append("🏆 <b>ПРАВИЛЬНО ОТВЕТИЛИ И ПОЛУЧАЮТ ФИШКИ:</b>")
            for uid in state.correct_user_ids:
                player = state.registered_players[uid]
                player.points += points
                player.correct_count += 1
                lines.append(f"• 👤 <b>{player.full_name}</b>: +{points} CasinoCoins 🪙 (Баланс: <b>{player.points} фишек</b>)")
            lines.append(f"\\n{general_joke}\\n")
        else:
            wrong_joke = random.choice(WRONG_JOKES)
            lines.append(
                f"💨 <b>Никто из игроков не угадал!</b>\\n"
                f"Крупье сметает все фишки себе в банк! 🧹\\n"
                f"{wrong_joke}\\n"
            )

        lines.append("👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>")
        await message.answer("\\n".join(lines))

# ==========================================
# 5. ЗАПУСК БОТА
# ==========================================

async def main():
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML)
    )
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
`;
}

export function generateRequirementsTxt(): string {
  return `aiogram>=3.13.0
python-dotenv>=1.0.1
`;
}

export function generateEnvExample(customToken?: string): string {
  const tokenVal = customToken?.trim() || "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ";
  return `# Получите токен вашего бота у официального бота @BotFather в Telegram:
BOT_TOKEN="${tokenVal}"
`;
}

export function generateReadmeMd(): string {
  return `# 🎰 Telegram Quiz & Casino Bot на aiogram 3.x

Бот для проведения викторин в групповых чатах с обязательной регистрацией участников (\`/join\`), автозавершением вопроса, шутками крупье и конвертацией заработанных баллов в **фишки для казино (CasinoCoins 🪙)**!

## 💰 Концепция:
1. **Регистрация через /join**: Чтобы участвовать в игре и копить банкролл, игроки отправляют в чат команду \`/join\`.
2. **Автозавершение раунда**: Как только все зарегистрированные игроки дали ответ (правильный или неправильный) — раунд автоматически закрывается и бот перестает принимать сообщения!
3. **Курс фишек**: Все заработанные очки конвертируются **1:1 в фишки**, которые участники затем получат на руки и смогут потратить в вашем казино (рулетка, блэкджек, покер)!

---

## ⚡ КРИТИЧЕСКИ ВАЖНО В @BotFather:
1. Откройте **[@BotFather](https://t.me/BotFather)**.
2. Отправьте \`/setprivacy\`.
3. Выберите бота и нажмите **«Disable»** (чтобы бот видел обычные ответы участников в групповом чате).

---

## 🚀 Быстрый запуск с файлом .env

### 1. Создайте файл \`.env\`
В одной папке со скриптом создайте файл \`.env\`:
\`\`\`env
BOT_TOKEN=ваш_токен_от_BotFather
\`\`\`

### 2. Установите зависимости и запустите
\`\`\`bash
pip install -r requirements.txt
python bot.py
\`\`\`

---

## 🎮 Команды:
- \`/start\` — правила викторины, регистрация и конвертация фишек
- \`/join\` — войти в игру (обязательно для каждого участника!)
- \`/players\` — список зарегистрированных игроков за столом
- \`/next\` — выдать следующий вопрос (для ведущего/крупье)
- \`/current\` — текущий вопрос, статус ответов (кого ещё ждём)
- \`/stat\` — баланс фишек для казино по каждому игроку
- \`/reset\` — сбросить банкролл и регистрацию
- \`/reload\` — перезагрузить вопросы из UI без перезапуска бота
- \`/leave\` — выйти из-за стола с сохранением очков
`;
}

export function generateDockerComposeYml(customToken?: string): string {
  const tokenVal = customToken?.trim() || '${BOT_TOKEN}';
  return `version: '3.8'

services:
  # 🌐 Веб-интерфейс: Конструктор вопросов, Симулятор чата и API
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: quiz_web_ui
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Общая папка для мгновенной синхронизации вопросов
      - ./data:/app/data
    environment:
      - NODE_ENV=production

  # 🤖 Telegram-бот на aiogram 3.x
  bot:
    build:
      context: .
      dockerfile: Dockerfile.bot
    container_name: quiz_telegram_bot
    restart: unless-stopped
    depends_on:
      - web
    volumes:
      # Тот же том: бот сразу читает вопросы, созданные в UI!
      - ./data:/app/data
    environment:
      - BOT_TOKEN=${tokenVal}
      - QUESTIONS_FILE_PATH=/app/data/questions.json
      - QUESTIONS_API_URL=http://web:3000/api/questions
`;
}

export function generateDockerfile(): string {
  return `FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
`;
}

export function generateDockerfileBot(): string {
  return `FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py .

CMD ["python", "bot.py"]
`;
}

