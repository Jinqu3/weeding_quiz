import express from "express";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const require = createRequire(import.meta.url);

const DEFAULT_QUESTIONS_BACKUP = [
  {
    id: "q1",
    text: "Какой химический элемент в таблице Менделеева обозначается символом Au?",
    type: "general",
    points: 10,
    answers: ["золото", "gold", "аурум", "aurum"],
    explanation: "Au происходит от латинского слова Aurum («сияющий рассвет» или золото)."
  },
  {
    id: "q2",
    text: "⚡ [НА СКОРОСТЬ] Назовите столицу Австралии (не Сидней и не Мельбурн!)",
    type: "first",
    points: 20,
    answers: ["канберра", "canberra"],
    explanation: "Канберра была специально построена как компромисс между соперничавшими Сиднеем и Мельбурном."
  },
  {
    id: "q3",
    text: "Сколько граней у стандартного игрального кубика (кости)?",
    type: "general",
    points: 10,
    answers: ["6", "шесть", "six"],
    explanation: "У классического шестигранного кубика d6 ровно 6 граней с числами от 1 до 6."
  },
  {
    id: "q4",
    text: "⚡ [НА СКОРОСТЬ] В каком году Юрий Гагарин совершил первый в истории полёт в космос?",
    type: "first",
    points: 25,
    answers: ["1961", "1961 год", "1961г"],
    explanation: "12 апреля 1961 года на советском космическом корабле «Восток-1»."
  },
  {
    id: "q5",
    text: "Какая планета Солнечной системы является самой большой по массе и размеру?",
    type: "general",
    points: 10,
    answers: ["юпитер", "jupiter"],
    explanation: "Юпитер — газовый гигант, его масса более чем в 2,5 раза превышает массу всех остальных планет вместе взятых."
  },
  {
    id: "q6",
    text: "⚡ [НА СКОРОСТЬ] Сколько секунд в ровно 3 минутах?",
    type: "first",
    points: 15,
    answers: ["180", "180 секунд", "180 сек"],
    explanation: "В одной минуте 60 секунд. 3 × 60 = 180."
  },
  {
    id: "q7",
    text: "Какое озеро является самым глубоким на планете Земля?",
    type: "general",
    points: 15,
    answers: ["байкал", "озеро байкал", "baikal"],
    explanation: "Максимальная глубина пресноводного озера Байкал составляет 1642 метра."
  },
  {
    id: "q8",
    text: "⚡ [НА СКОРОСТЬ] Какое число в рулетке европейского казино окрашено в зелёный цвет?",
    type: "first",
    points: 20,
    answers: ["0", "зеро", "ноль", "zero"],
    explanation: "В европейской рулетке ровно один зелёный сектор — Зеро (0). В американской их два: 0 и 00."
  },
  {
    id: "q9",
    text: "Какой океан является самым большим по площади на Земле?",
    type: "general",
    points: 10,
    answers: ["тихий", "тихий океан", "pacific", "pacific ocean"],
    explanation: "Тихий океан занимает более трети всей поверхности планеты Земля."
  },
  {
    id: "q10",
    text: "⚡ [ФИНАЛ НА СКОРОСТЬ] Сколько карт в стандартной классической покерной колоде (без джокеров)?",
    type: "first",
    points: 30,
    answers: ["52", "52 карты", "52 штуки"],
    explanation: "4 масти по 13 карт (от двойки до туза) — ровно 52 карты."
  }
];

const DATA_DIR = path.join(process.cwd(), "data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const DB_FILE = path.join(DATA_DIR, "quiz.db");

interface DbQuestion {
  id: string;
  text: string;
  type: string;
  points: number;
  answers: string[];
  explanation?: string;
  sort_order?: number;
}

let sqliteDb: any = null;

function initDatabase(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    try {
      const { DatabaseSync } = require("node:sqlite");
      sqliteDb = new DatabaseSync(DB_FILE);
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          type TEXT NOT NULL,
          points INTEGER NOT NULL,
          answers TEXT NOT NULL,
          explanation TEXT DEFAULT '',
          sort_order INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("✅ SQLite database connected successfully at:", DB_FILE);
    } catch (dbErr) {
      console.warn("⚠️ node:sqlite not initialized:", dbErr);
      sqliteDb = null;
    }

    // Check if SQLite table or JSON file has questions
    const currentQuestions = loadQuestionsFromStorage();
    if (currentQuestions.length === 0) {
      saveQuestionsToStorage(DEFAULT_QUESTIONS_BACKUP);
    } else {
      syncJsonFile(currentQuestions);
    }
  } catch (err) {
    console.error("Database initialization error:", err);
  }
}

function loadQuestionsFromStorage(): DbQuestion[] {
  // 1. Try reading from SQLite DB
  if (sqliteDb) {
    try {
      const query = sqliteDb.prepare("SELECT id, text, type, points, answers, explanation, sort_order FROM questions ORDER BY sort_order ASC, rowid ASC");
      const rows = query.all();
      if (rows && rows.length > 0) {
        return rows.map((row: any) => {
          let parsedAnswers: string[] = [];
          try {
            parsedAnswers = typeof row.answers === "string" && row.answers.startsWith("[")
              ? JSON.parse(row.answers)
              : [row.answers];
          } catch {
            parsedAnswers = [String(row.answers || "")];
          }
          return {
            id: String(row.id),
            text: String(row.text),
            type: String(row.type),
            points: Number(row.points) || 10,
            answers: parsedAnswers,
            explanation: row.explanation ? String(row.explanation) : "",
            sort_order: Number(row.sort_order) || 0
          };
        });
      }
    } catch (err) {
      console.warn("Error reading from SQLite, falling back to JSON:", err);
    }
  }

  // 2. Fallback to questions.json
  if (fs.existsSync(QUESTIONS_FILE)) {
    try {
      const raw = fs.readFileSync(QUESTIONS_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn("Error reading JSON file:", err);
    }
  }

  return DEFAULT_QUESTIONS_BACKUP;
}

function syncJsonFile(questions: DbQuestion[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questions, null, 2), "utf-8");
  } catch (err) {
    console.error("Error syncing JSON file:", err);
  }
}

function saveQuestionsToStorage(questions: DbQuestion[]): void {
  if (sqliteDb) {
    try {
      sqliteDb.exec("BEGIN TRANSACTION;");
      sqliteDb.exec("DELETE FROM questions;");
      const insert = sqliteDb.prepare(`
        INSERT INTO questions (id, text, type, points, answers, explanation, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      questions.forEach((q, idx) => {
        const id = q.id || `q_${Date.now()}_${idx}`;
        const answersJson = JSON.stringify(Array.isArray(q.answers) ? q.answers : [String(q.answers || "")]);
        insert.run(
          id,
          q.text || "",
          q.type || "general",
          Number(q.points) || 10,
          answersJson,
          q.explanation || "",
          idx
        );
      });
      sqliteDb.exec("COMMIT;");
    } catch (err) {
      try { sqliteDb.exec("ROLLBACK;"); } catch {}
      console.error("Failed to save to SQLite:", err);
    }
  }

  syncJsonFile(questions);
}

function insertSingleQuestionToDb(question: Partial<DbQuestion>): DbQuestion {
  const current = loadQuestionsFromStorage();
  const newId = question.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const answers = Array.isArray(question.answers)
    ? question.answers
    : typeof question.answers === "string"
      ? (question.answers as string).split(",").map(a => a.trim()).filter(Boolean)
      : ["Ответ"];

  const newQuestion: DbQuestion = {
    id: newId,
    text: question.text || "Новый вопрос викторины",
    type: question.type === "first" ? "first" : "general",
    points: Number(question.points) || 10,
    answers: answers.length > 0 ? answers : ["Ответ"],
    explanation: question.explanation || "",
    sort_order: current.length
  };

  if (sqliteDb) {
    try {
      const insert = sqliteDb.prepare(`
        INSERT INTO questions (id, text, type, points, answers, explanation, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        newQuestion.id,
        newQuestion.text,
        newQuestion.type,
        newQuestion.points,
        JSON.stringify(newQuestion.answers),
        newQuestion.explanation,
        newQuestion.sort_order
      );
    } catch (err) {
      console.error("Failed to insert single question to SQLite:", err);
    }
  }

  const updated = [...current, newQuestion];
  syncJsonFile(updated);
  return newQuestion;
}

function deleteQuestionFromDb(id: string): boolean {
  if (sqliteDb) {
    try {
      const del = sqliteDb.prepare("DELETE FROM questions WHERE id = ?");
      del.run(id);
    } catch (err) {
      console.error("Failed to delete from SQLite:", err);
    }
  }
  const current = loadQuestionsFromStorage();
  const filtered = current.filter(q => q.id !== id);
  syncJsonFile(filtered);
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // Инициализация базы данных SQLite
  initDatabase();

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/db/status - Информация о состоянии SQLite БД
  app.get("/api/db/status", (_req, res) => {
    const questions = loadQuestionsFromStorage();
    let sizeBytes = 0;
    try {
      if (fs.existsSync(DB_FILE)) {
        sizeBytes = fs.statSync(DB_FILE).size;
      }
    } catch {}

    res.json({
      connected: !!sqliteDb,
      engine: "SQLite 3",
      dbPath: DB_FILE,
      jsonBackupPath: QUESTIONS_FILE,
      totalQuestions: questions.length,
      sizeBytes,
      sizeKb: (sizeBytes / 1024).toFixed(1)
    });
  });

  // GET /api/questions - Возвращает текущий список вопросов из БД
  app.get("/api/questions", (_req, res) => {
    try {
      const questions = loadQuestionsFromStorage();
      res.json(questions);
    } catch (err) {
      console.error("Failed to read questions from DB:", err);
      res.status(500).json({ error: "Failed to read questions", fallback: DEFAULT_QUESTIONS_BACKUP });
    }
  });

  // POST /api/questions - Сохраняет полный обновлённый список вопросов в БД и JSON
  app.post("/api/questions", (req, res) => {
    try {
      const body = req.body;
      const questionsToSave = Array.isArray(body) ? body : (body?.questions || []);

      if (!Array.isArray(questionsToSave)) {
        res.status(400).json({ error: "Invalid questions payload: must be an array" });
        return;
      }

      saveQuestionsToStorage(questionsToSave);

      res.json({
        success: true,
        count: questionsToSave.length,
        savedAt: new Date().toISOString(),
        database: "sqlite (data/quiz.db)"
      });
    } catch (err) {
      console.error("Failed to save questions to DB:", err);
      res.status(500).json({ error: "Failed to save questions" });
    }
  });

  // POST /api/questions/add - Добавление одного вопроса напрямую в БД (удобный API)
  app.post("/api/questions/add", (req, res) => {
    try {
      const { text, type, points, answers, explanation } = req.body || {};
      if (!text || !answers) {
        res.status(400).json({ error: "Поля 'text' (вопрос) и 'answers' (ответы) обязательны" });
        return;
      }

      const created = insertSingleQuestionToDb({ text, type, points, answers, explanation });
      const current = loadQuestionsFromStorage();

      res.json({
        success: true,
        question: created,
        totalCount: current.length,
        database: "sqlite (data/quiz.db)"
      });
    } catch (err) {
      console.error("Failed to add question to DB:", err);
      res.status(500).json({ error: "Failed to add question" });
    }
  });

  // POST /api/questions/import - Пакетное добавление вопросов в БД
  app.post("/api/questions/import", (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: "Передайте массив 'items' с вопросами" });
        return;
      }

      const current = loadQuestionsFromStorage();
      const addedItems: DbQuestion[] = [];

      items.forEach((item, idx) => {
        if (item.text && item.answers) {
          const answers = Array.isArray(item.answers)
            ? item.answers
            : String(item.answers).split(",").map(a => a.trim()).filter(Boolean);

          addedItems.push({
            id: item.id || `q_${Date.now()}_${idx}`,
            text: String(item.text).trim(),
            type: item.type === "first" ? "first" : "general",
            points: Number(item.points) || 10,
            answers: answers.length > 0 ? answers : ["Ответ"],
            explanation: item.explanation ? String(item.explanation) : "",
            sort_order: current.length + idx
          });
        }
      });

      const updated = [...current, ...addedItems];
      saveQuestionsToStorage(updated);

      res.json({
        success: true,
        importedCount: addedItems.length,
        totalCount: updated.length,
        database: "sqlite (data/quiz.db)"
      });
    } catch (err) {
      console.error("Failed to import questions to DB:", err);
      res.status(500).json({ error: "Failed to import questions" });
    }
  });

  // DELETE /api/questions/:id - Удаление вопроса из БД по id
  app.delete("/api/questions/:id", (req, res) => {
    try {
      const id = req.params.id;
      deleteQuestionFromDb(id);
      const current = loadQuestionsFromStorage();
      res.json({ success: true, deletedId: id, remainingCount: current.length });
    } catch (err) {
      console.error("Failed to delete question from DB:", err);
      res.status(500).json({ error: "Failed to delete question" });
    }
  });

  // Готовые тематические наборы вопросов (1 клик для добавления в SQLite БД)
  const CURATED_PACKS = [
    {
      id: "casino",
      name: "🎰 Казино, покер и азартные игры",
      badge: "Казино",
      description: "Вопросы о рулетке, покере, блэкджеке, кубиках и Лас-Вегасе.",
      questions: [
        {
          text: "Сколько всего секторов на колесе классической европейской рулетки (с одним зеро)?",
          type: "general",
          points: 15,
          answers: ["37", "37 секторов", "тридцать семь"],
          explanation: "Сектора пронумерованы от 0 до 36, то есть ровно 37 ячеек."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Как называется лучшая и самая сильная комбинация в классическом покере (Техасский Холдем)?",
          type: "first",
          points: 25,
          answers: ["роял флеш", "роял-флеш", "royal flush", "флеш рояль"],
          explanation: "Роял-флеш: одномастные 10, Валет, Дама, Король и Туз."
        },
        {
          text: "Какая сумма очков считается идеальной победой в игре Блэкджек («Двадцать одно»)?",
          type: "general",
          points: 10,
          answers: ["21", "двадцать одно", "21 очко"],
          explanation: "Туз (11) плюс любая десятка/картинка дают ровно 21 очко."
        },
        {
          text: "В каком американском штате находится знаменитый город казино Лас-Вегас?",
          type: "general",
          points: 10,
          answers: ["невада", "nevada"],
          explanation: "Лас-Вегас расположен на юге штата Невада в пустыне Мохаве."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Какое число получится, если сложить все числа на колесе рулетки от 1 до 36?",
          type: "first",
          points: 30,
          answers: ["666", "шестьсот шестьдесят шесть"],
          explanation: "Сумма чисел от 1 до 36 равна ровно 666, поэтому рулетку называют «чертовым колесом»."
        }
      ]
    },
    {
      id: "cinema",
      name: "🎬 Кино, сериалы и поп-культура",
      badge: "Кино",
      description: "Вопросы о культовых фильмах, супергероях, Оскарах и мультфильмах.",
      questions: [
        {
          text: "Как зовут верного дворецкого и помощника миллиардера Брюса Уэйна (Бэтмена)?",
          type: "general",
          points: 15,
          answers: ["альфред", "альфред пенниуорт", "alfred"],
          explanation: "Альфред Пенниуорт хранит тайны поместья Уэйнов и помогает Бэтмену."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Какую таблетку по цвету выбрал Нео в фильме «Матрица», чтобы узнать правду о мире?",
          type: "first",
          points: 20,
          answers: ["красную", "красная", "красный"],
          explanation: "Морфеус предложил синюю (остаться в неведении) и красную (увидеть реальность)."
        },
        {
          text: "На какой платформе вокзала Кингс-Кросс садились ученики Хогвартса в саге о Гарри Поттере?",
          type: "general",
          points: 10,
          answers: ["9 3/4", "9 и три четверти", "девять и три четверти", "9 и 3/4"],
          explanation: "Платформа 9¾ скрыта за кирпичной колонной между платформами 9 и 10."
        },
        {
          text: "Какой фильм Джеймса Кэмерона 1997 года получил рекордные 11 премий «Оскар»?",
          type: "general",
          points: 10,
          answers: ["титаник", "titanic"],
          explanation: "Титаник с Леонардо Ди Каприо и Кейт Уинслет собрал колоссальный мировой сбор."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Как зовут зелёного мастера-джедая маленького роста из киносаги «Звёздные войны»?",
          type: "first",
          points: 20,
          answers: ["йода", "магистр йода", "yoda"],
          explanation: "Гранд-мастер Йода тренировал Люка Скайуокера на болотистой планете Дагоба."
        }
      ]
    },
    {
      id: "science",
      name: "🧠 Наука, космос и природа",
      badge: "Наука",
      description: "Увлекательные факты об астрономии, биологии, физике и планете.",
      questions: [
        {
          text: "Какая планета Солнечной системы вращается вокруг Солнца «лежа на боку» с наклоном оси почти 98°?",
          type: "general",
          points: 15,
          answers: ["уран", "uranus"],
          explanation: "Ось вращения Урана наклонена на 97,8 градуса, поэтому он вращается словно катящийся шар."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Сколько хромосом содержится в обычной клетке здорового человека?",
          type: "first",
          points: 25,
          answers: ["46", "46 хромосом", "23 пары"],
          explanation: "В кариотипе человека 46 хромосом (23 пары: 22 аутосомы и 1 пара половых)."
        },
        {
          text: "Какой газ преобладает в атмосфере Земли по объему (около 78%)?",
          type: "general",
          points: 10,
          answers: ["азот", "nitrogen", "n2"],
          explanation: "Азот составляет 78% атмосферы, кислород — около 21%, аргон — 0.9%."
        },
        {
          text: "Какое самое крупное животное когда-либо обитало на планете Земля?",
          type: "general",
          points: 10,
          answers: ["синий кит", "голубой кит", "кит", "blue whale"],
          explanation: "Синий кит достигает 33 метров в длину и массы свыше 150 тонн."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] При какой температуре по шкале Цельсия замерзает чистая пресная вода?",
          type: "first",
          points: 15,
          answers: ["0", "ноль", "0 градусов", "ноль градусов"],
          explanation: "Точка замерзания пресной воды при нормальном атмосферном давлении равна 0°C."
        }
      ]
    },
    {
      id: "it_games",
      name: "💻 IT, компьютеры и видеоигры",
      badge: "IT и Игры",
      description: "Вопросы для айтишников, геймеров и любителей цифровых технологий.",
      questions: [
        {
          text: "Как зовут итальянского водопроводчика в красной кепке — главный маскот Nintendo?",
          type: "general",
          points: 10,
          answers: ["марио", "mario", "супер марио"],
          explanation: "Марио впервые появился в аркадной игре Donkey Kong в 1981 году."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Сколько байт содержится в одном килобайте (КБ) в стандартной двоичной системе?",
          type: "first",
          points: 20,
          answers: ["1024", "1024 байта", "1024 байт"],
          explanation: "2 в 10-й степени = 1024 байта."
        },
        {
          text: "Какое животное изображено на официальном логотипе языка программирования Python?",
          type: "general",
          points: 10,
          answers: ["змея", "питон", "змеи", "два питона"],
          explanation: "На логотипе изображены две стилизованные переплетенные змеи (желтая и синяя)."
        },
        {
          text: "Как зовут главную героиню культовой серии игр Tomb Raider?",
          type: "general",
          points: 15,
          answers: ["лара крофт", "lara croft", "лара"],
          explanation: "Лара Крофт — археолог-авантюристка, дебютировавшая в 1996 году."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] В каком году была основана компания Google?",
          type: "first",
          points: 25,
          answers: ["1998", "1998 год"],
          explanation: "Ларри Пейдж и Сергей Брин основали Google в сентябре 1998 года."
        }
      ]
    },
    {
      id: "riddles",
      name: "⚡ Блиц-загадки и логика",
      badge: "Блиц",
      description: "Короткие загадки с подвохом для моментальных ответов в чате.",
      questions: [
        {
          text: "⚡ [НА СКОРОСТЬ] Что может путешествовать по всему миру, оставаясь в одном и том же углу?",
          type: "first",
          points: 25,
          answers: ["марка", "почтовая марка", "stamp"],
          explanation: "Почтовая марка наклеивается в угол конверта."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] У семерых братьев есть по одной сестре. Сколько всего детей в семье?",
          type: "first",
          points: 20,
          answers: ["8", "восемь", "8 детей"],
          explanation: "7 братьев и 1 общая сестра = 8 детей."
        },
        {
          text: "Что становится больше, когда из него что-то забирают?",
          type: "general",
          points: 15,
          answers: ["яма", "дыра", "отверстие", "нора"],
          explanation: "Чем больше земли вы выкапываете из ямы, тем глубже и шире она становится."
        },
        {
          text: "⚡ [НА СКОРОСТЬ] Сколько месяцев в году имеют 28 дней?",
          type: "first",
          points: 20,
          answers: ["12", "все", "все 12", "все месяцы", "12 месяцев"],
          explanation: "Во всех 12 месяцах года есть как минимум 28 дней!"
        },
        {
          text: "Чем больше вы берете из меня, тем больше оставляете позади. Что это?",
          type: "general",
          points: 20,
          answers: ["следы", "шаги", "шаг"],
          explanation: "Когда человек идет, каждый сделанный шаг оставляет следы позади."
        }
      ]
    }
  ];

  // GET /api/questions/packs - Список готовых тематических паков
  app.get("/api/questions/packs", (_req, res) => {
    res.json(CURATED_PACKS);
  });

  // POST /api/questions/install-pack - Установка готового пака в SQLite БД
  app.post("/api/questions/install-pack", (req, res) => {
    try {
      const { packId } = req.body || {};
      const pack = CURATED_PACKS.find(p => p.id === packId);
      if (!pack) {
        res.status(404).json({ error: "Тематический пакет не найден" });
        return;
      }

      const current = loadQuestionsFromStorage();
      const newItems: DbQuestion[] = pack.questions.map((q, idx) => ({
        id: `pack_${packId}_${Date.now()}_${idx}`,
        text: q.text,
        type: q.type as "general" | "first",
        points: q.points,
        answers: q.answers,
        explanation: q.explanation || "",
        sort_order: current.length + idx
      }));

      const updated = [...current, ...newItems];
      saveQuestionsToStorage(updated);

      res.json({
        success: true,
        packName: pack.name,
        addedCount: newItems.length,
        totalCount: updated.length,
        database: "sqlite (data/quiz.db)"
      });
    } catch (err) {
      console.error("Failed to install pack:", err);
      res.status(500).json({ error: "Failed to install pack" });
    }
  });

  // POST /api/questions/generate-ai - Генерация вопросов с помощью Gemini AI
  app.post("/api/questions/generate-ai", async (req, res) => {
    const { topic = "Общая эрудиция", count = 5, difficulty = "medium", saveImmediately = false } = req.body || {};
    const clampedCount = Math.max(1, Math.min(10, Number(count) || 5));

    try {
      let generatedQuestions: Array<{
        text: string;
        type: "general" | "first";
        points: number;
        answers: string[];
        explanation: string;
      }> = [];

      // Пробуем вызвать Gemini API, если задан ключ
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = `Ты — профессиональный ведущий викторин и крупье казино.
Сгенерируй ровно ${clampedCount} уникальных, интересных и однозначно проверяемых вопросов для викторины в Telegram-боте.
Тема: "${topic}".
Уровень сложности: ${difficulty}.

Требования:
1. Чередуй типы вопросов: 'general' (обычный, баллы всем) и 'first' (вопрос на скорость, куш первому, для таких вопросов в текст добавь в начале значок ⚡ [НА СКОРОСТЬ]).
2. Баллы (points): от 10 до 30 в зависимости от сложности.
3. Варианты ответов (answers): массив из 2-5 строковых вариантов правильного ответа строго строчными буквами без знаков препинания (синонимы, варианты на русском и английском, если применимо).
4. Краткое пояснение (explanation): 1-2 предложения интересного факта или комментария ведущего.

Верни СТРОГО валидный JSON-массив объектов без лишнего текста и markdown:
[
  {
    "text": "Текст вопроса?",
    "type": "general",
    "points": 15,
    "answers": ["ответ", "синоним ответа"],
    "explanation": "Интересный факт"
  }
]`;

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });

          const rawText = response.text || "";
          const parsed = JSON.parse(rawText);
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedQuestions = parsed.map(item => ({
              text: String(item.text || "").trim(),
              type: (item.type === "first" ? "first" : "general") as "first" | "general",
              points: Number(item.points) || 10,
              answers: Array.isArray(item.answers)
                ? item.answers.map((a: unknown) => String(a).toLowerCase().trim()).filter(Boolean)
                : [String(item.answers || "ответ").toLowerCase().trim()],
              explanation: String(item.explanation || "").trim()
            })).filter(q => q.text && q.answers.length > 0);
          }
        } catch (geminiError) {
          console.warn("Gemini API call failed, falling back to curated generator:", geminiError);
        }
      }

      // Если Gemini не был вызван или произошла ошибка — используем качественный генератор из базы знаний
      if (generatedQuestions.length === 0) {
        const fallbackPool = [
          ...CURATED_PACKS.flatMap(p => p.questions),
          {
            text: `Какой город является официальной столицей Канады (не Торонто и не Монреаль)?`,
            type: "general" as const,
            points: 15,
            answers: ["оттава", "ottawa"],
            explanation: "Оттава была выбрана королевой Викторией в 1857 году."
          },
          {
            text: `⚡ [НА СКОРОСТЬ] Сколько струн у стандартной классической гитары?`,
            type: "first" as const,
            points: 10,
            answers: ["6", "шесть", "6 струн"],
            explanation: "У классической испанской гитары 6 нейлоновых или металлических струн."
          },
          {
            text: `Какой металл находится в жидком агрегатном состоянии при комнатной температуре?`,
            type: "general" as const,
            points: 15,
            answers: ["ртуть", "hg", "mercury"],
            explanation: "Ртуть плавится при температуре -38,8°C."
          },
          {
            text: `⚡ [НА СКОРОСТЬ] Как звали кота в сказке Шарля Перро, который носил кожаную обувь?`,
            type: "first" as const,
            points: 10,
            answers: ["кот в сапогах", "в сапогах"],
            explanation: "Знаменитый персонаж «Кот в сапогах»."
          },
          {
            text: `В каком океане находится самая глубокая точка Земли — Марианская впадина?`,
            type: "general" as const,
            points: 15,
            answers: ["тихий", "тихом", "тихий океан", "pacific"],
            explanation: "Глубина Бездны Челленджера в Марианском желобе составляет почти 11 000 метров."
          }
        ];

        // Фильтруем или перемешиваем
        const shuffled = [...fallbackPool].sort(() => 0.5 - Math.random());
        generatedQuestions = shuffled.slice(0, clampedCount).map(q => ({
          text: q.text,
          type: q.type as "general" | "first",
          points: q.points,
          answers: q.answers,
          explanation: q.explanation || ""
        }));
      }

      // Если пользователь запросил мгновенное сохранение в SQLite БД
      if (saveImmediately && generatedQuestions.length > 0) {
        const current = loadQuestionsFromStorage();
        const newDbItems: DbQuestion[] = generatedQuestions.map((q, idx) => ({
          id: `ai_${Date.now()}_${idx}`,
          text: q.text,
          type: q.type,
          points: q.points,
          answers: q.answers,
          explanation: q.explanation,
          sort_order: current.length + idx
        }));

        const updated = [...current, ...newDbItems];
        saveQuestionsToStorage(updated);

        res.json({
          success: true,
          questions: generatedQuestions,
          savedCount: newDbItems.length,
          totalCount: updated.length,
          savedImmediately: true,
          database: "sqlite (data/quiz.db)"
        });
        return;
      }

      res.json({
        success: true,
        questions: generatedQuestions,
        savedImmediately: false
      });
    } catch (err) {
      console.error("Failed to generate AI questions:", err);
      res.status(500).json({ error: "Failed to generate questions" });
    }
  });

  // Vite middleware for development vs Static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
