import express from "express";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";

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
    text: "Сколько секунд длится раунд в классическом мужском профессиональном боксе?",
    type: "choice",
    options: ["120 секунд (2 мин)", "180 секунд (3 мин)", "240 секунд (4 мин)", "300 секунд (5 мин)"],
    correctOptionIndex: 1,
    points: 15,
    answers: ["2", "2)", "180", "180 секунд", "180 секунд (3 мин)", "б"],
    explanation: "Классический раунд в мужском профессиональном боксе длится ровно 3 минуты (180 секунд)."
  },
  {
    id: "q7",
    text: "⚡ [НА СКОРОСТЬ] Сколько секунд в ровно 3 минутах?",
    type: "first",
    points: 15,
    answers: ["180", "180 секунд", "180 сек"],
    explanation: "В одной минуте 60 секунд. 3 × 60 = 180."
  },
  {
    id: "q8",
    text: "Какое озеро является самым глубоким на планете Земля?",
    type: "general",
    points: 15,
    answers: ["байкал", "озеро байкал", "baikal"],
    explanation: "Максимальная глубина пресноводного озера Байкал составляет 1642 метра."
  },
  {
    id: "q9",
    text: "Какая денежная единица является официальной валютой Японии?",
    type: "choice",
    options: ["Юань", "Вона", "Иена", "Рупия"],
    correctOptionIndex: 2,
    points: 15,
    answers: ["3", "3)", "иена", "йена", "yen", "в"],
    explanation: "Национальной валютой Японии является иена (JPY), введённая в 1871 году."
  },
  {
    id: "q10",
    text: "⚡ [НА СКОРОСТЬ] Какое число в рулетке европейского казино окрашено в зелёный цвет?",
    type: "first",
    points: 20,
    answers: ["0", "зеро", "ноль", "zero"],
    explanation: "В европейской рулетке ровно один зелёный сектор — Зеро (0). В американской их два: 0 и 00."
  },
  {
    id: "q11",
    text: "Какой океан является самым большим по площади на Земле?",
    type: "general",
    points: 10,
    answers: ["тихий", "тихий океан", "pacific", "pacific ocean"],
    explanation: "Тихий океан занимает более трети всей поверхности планеты Земля."
  },
  {
    id: "q12",
    text: "⚡ [ФИНАЛ НА СКОРОСТЬ] Сколько карт в стандартной классической покерной колоде (без джокеров)?",
    type: "first",
    points: 30,
    answers: ["52", "52 карты", "52 штуки"],
    explanation: "4 масти по 13 карт (от двойки до туза) — ровно 52 карты."
  }
];

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const QUESTIONS_FILE = path.join(DATA_DIR, "questions.json");
const DB_FILE = path.join(DATA_DIR, "quiz.db");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

// Хранилище активных токенов авторизованных администраторов
const activeAdminTokens = new Set<string>();

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const saltToUse = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, saltToUse, 10000, 64, "sha512").toString("hex");
  return { hash, salt: saltToUse };
}

function isAuthRequired(): boolean {
  const envPass = process.env.ADMIN_PASSWORD;
  if (envPass && envPass.trim().length > 0) {
    return true;
  }
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, "utf-8");
      const data = JSON.parse(raw);
      return Boolean(data.hash && data.salt);
    } catch {
      return false;
    }
  }
  return false;
}

function verifyAdminPassword(password: string): boolean {
  const envPass = process.env.ADMIN_PASSWORD;
  if (envPass && envPass.trim().length > 0) {
    return password.trim() === envPass.trim();
  }
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (data.hash && data.salt) {
        const calculated = crypto.pbkdf2Sync(password.trim(), data.salt, 10000, 64, "sha512").toString("hex");
        return calculated === data.hash;
      }
    } catch (e) {
      console.error("Error reading auth file:", e);
    }
  }
  return false;
}

function checkIsAuthenticated(req: express.Request): boolean {
  if (!isAuthRequired()) return true;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (activeAdminTokens.has(token)) return true;
    // Разрешаем использование ADMIN_PASSWORD напрямую в заголовке Bearer для скриптов/бота
    if (process.env.ADMIN_PASSWORD && token === process.env.ADMIN_PASSWORD.trim()) return true;
  }

  const customKey = req.headers["x-admin-password"] || req.headers["x-admin-key"];
  if (typeof customKey === "string" && verifyAdminPassword(customKey)) {
    return true;
  }

  return false;
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (checkIsAuthenticated(req)) {
    return next();
  }
  res.status(401).json({
    error: "Доступ ограничен. Требуется пароль администратора.",
    needAuth: true
  });
}

interface DbQuestion {
  id: string;
  text: string;
  type: string;
  points: number;
  answers: string[];
  explanation?: string;
  sort_order?: number;
  options?: string[];
  correctOptionIndex?: number;
}

let sqliteDb: any = null;

async function initDatabase(): Promise<void> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    try {
      // Dynamic import works across ESM and CommonJS in modern Node
      const sqliteModule = await import("node:sqlite").catch(() => null);
      const DatabaseSync = sqliteModule?.DatabaseSync;
      if (DatabaseSync) {
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
            options TEXT DEFAULT '',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Безопасная миграция: добавляем колонку options, если база была создана ранее
        try {
          sqliteDb.exec("ALTER TABLE questions ADD COLUMN options TEXT DEFAULT ''");
        } catch {}

        console.log("✅ SQLite database connected successfully at:", DB_FILE);
      } else {
        sqliteDb = null;
      }
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
      let hasOptionsCol = false;
      try {
        const pragma = sqliteDb.prepare("PRAGMA table_info(questions)").all();
        hasOptionsCol = pragma.some((c: any) => c.name === "options");
      } catch {}

      const selectSql = hasOptionsCol
        ? "SELECT id, text, type, points, answers, explanation, sort_order, options FROM questions ORDER BY sort_order ASC, rowid ASC"
        : "SELECT id, text, type, points, answers, explanation, sort_order FROM questions ORDER BY sort_order ASC, rowid ASC";

      const query = sqliteDb.prepare(selectSql);
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

          let parsedOptions: string[] | undefined = undefined;
          if (row.options) {
            try {
              if (typeof row.options === "string" && row.options.startsWith("[")) {
                parsedOptions = JSON.parse(row.options);
              }
            } catch {}
          }

          return {
            id: String(row.id),
            text: String(row.text),
            type: String(row.type),
            points: Number(row.points) || 10,
            answers: parsedAnswers,
            explanation: row.explanation ? String(row.explanation) : "",
            sort_order: Number(row.sort_order) || 0,
            options: parsedOptions
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
        INSERT INTO questions (id, text, type, points, answers, explanation, sort_order, options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      questions.forEach((q, idx) => {
        const id = q.id || `q_${Date.now()}_${idx}`;
        const answersJson = JSON.stringify(Array.isArray(q.answers) ? q.answers : [String(q.answers || "")]);
        const optionsJson = JSON.stringify(Array.isArray(q.options) ? q.options : []);
        insert.run(
          id,
          q.text || "",
          q.type || "general",
          Number(q.points) || 10,
          answersJson,
          q.explanation || "",
          idx,
          optionsJson
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

  const options = Array.isArray(question.options) && question.options.length > 0 ? question.options : undefined;

  const newQuestion: DbQuestion = {
    id: newId,
    text: question.text || "Новый вопрос викторины",
    type: question.type || "general",
    points: Number(question.points) || 10,
    answers: answers.length > 0 ? answers : ["Ответ"],
    explanation: question.explanation || "",
    sort_order: current.length,
    options
  };

  if (sqliteDb) {
    try {
      const insert = sqliteDb.prepare(`
        INSERT INTO questions (id, text, type, points, answers, explanation, sort_order, options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        newQuestion.id,
        newQuestion.text,
        newQuestion.type,
        newQuestion.points,
        JSON.stringify(newQuestion.answers),
        newQuestion.explanation,
        newQuestion.sort_order,
        JSON.stringify(newQuestion.options || [])
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
  await initDatabase();

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/auth/status - Проверка состояния защиты паролем и авторизации текущей сессии
  app.get("/api/auth/status", (req, res) => {
    res.json({
      isProtected: isAuthRequired(),
      isAuthenticated: checkIsAuthenticated(req),
      hasEnvPassword: Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0)
    });
  });

  // POST /api/auth/login - Авторизация по паролю администратора
  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body || {};
    if (!isAuthRequired()) {
      const token = crypto.randomBytes(32).toString("hex");
      activeAdminTokens.add(token);
      res.json({ success: true, token });
      return;
    }

    if (typeof password === "string" && verifyAdminPassword(password)) {
      const token = crypto.randomBytes(32).toString("hex");
      activeAdminTokens.add(token);
      res.json({ success: true, token });
      return;
    }

    res.status(401).json({ error: "Неверный пароль администратора" });
  });

  // POST /api/auth/logout - Выход из сессии администратора
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      activeAdminTokens.delete(token);
    }
    res.json({ success: true });
  });

  // POST /api/auth/set-password - Установка или смена пароля администратора
  app.post("/api/auth/set-password", (req, res) => {
    if (isAuthRequired() && !checkIsAuthenticated(req)) {
      res.status(401).json({ error: "Для изменения пароля войдите в систему" });
      return;
    }

    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0) {
      res.status(400).json({ error: "Пароль уже зафиксирован в файле .env через переменную ADMIN_PASSWORD" });
      return;
    }

    const { password } = req.body || {};
    if (!password || typeof password !== "string" || password.trim().length < 4) {
      res.status(400).json({ error: "Пароль должен быть не менее 4 символов" });
      return;
    }

    const { hash, salt } = hashPassword(password.trim());
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(AUTH_FILE, JSON.stringify({ hash, salt, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
      const token = crypto.randomBytes(32).toString("hex");
      activeAdminTokens.add(token);
      res.json({ success: true, token });
    } catch (err) {
      console.error("Failed to save auth file:", err);
      res.status(500).json({ error: "Не удалось сохранить пароль на диск" });
    }
  });

  // POST /api/auth/remove-password - Отключение защиты паролем
  app.post("/api/auth/remove-password", requireAuth, (_req, res) => {
    if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0) {
      res.status(400).json({ error: "Нельзя отключить пароль, заданный в .env через ADMIN_PASSWORD" });
      return;
    }

    try {
      if (fs.existsSync(AUTH_FILE)) {
        fs.unlinkSync(AUTH_FILE);
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete auth file:", err);
      res.status(500).json({ error: "Не удалось отключить пароль" });
    }
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
  app.post("/api/questions", requireAuth, (req, res) => {
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
  app.post("/api/questions/add", requireAuth, (req, res) => {
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
  app.post("/api/questions/import", requireAuth, (req, res) => {
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

          const itemType = item.type === "choice" ? "choice" : item.type === "first" ? "first" : "general";
          const options = Array.isArray(item.options) && item.options.length > 0 ? item.options : undefined;

          addedItems.push({
            id: item.id || `q_${Date.now()}_${idx}`,
            text: String(item.text).trim(),
            type: itemType,
            points: Number(item.points) || 10,
            answers: answers.length > 0 ? answers : ["Ответ"],
            explanation: item.explanation ? String(item.explanation) : "",
            sort_order: current.length + idx,
            options
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
  app.delete("/api/questions/:id", requireAuth, (req, res) => {
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
      id: "choice_tests",
      name: "🔘 Тесты с вариантами ответов (1, 2, 3, 4)",
      badge: "Тесты с выбором",
      description: "Вопросы с 4 вариантами ответов: игроки нажимают инлайн-кнопки или пишут цифры 1-4 в чат.",
      questions: [
        {
          text: "В каком году человек впервые совершил посадку на поверхность Луны?",
          type: "choice",
          options: ["1961 год", "1969 год", "1972 год", "1975 год"],
          correctOptionIndex: 1,
          points: 15,
          answers: ["2", "2)", "1969", "1969 год", "б"],
          explanation: "20 июля 1969 года американские астронавты Нил Армстронг и Базз Олдрин ступили на Луну (миссия «Аполлон-11»)."
        },
        {
          text: "Какая страна является исторической родиной Олимпийских игр?",
          type: "choice",
          options: ["Италия", "Греция", "Франция", "Египет"],
          correctOptionIndex: 1,
          points: 10,
          answers: ["2", "2)", "греция", "greece", "б"],
          explanation: "Первые античные Олимпийские игры состоялись в древнегреческой Олимпии в 776 году до нашей эры."
        },
        {
          text: "Сколько клавиш у стандартного современного концертного фортепиано?",
          type: "choice",
          options: ["64 клавиши", "76 клавиш", "88 клавиш", "96 клавиш"],
          correctOptionIndex: 2,
          points: 20,
          answers: ["3", "3)", "88", "88 клавиш", "в"],
          explanation: "У стандартного фортепиано ровно 88 клавиш: 52 белых и 36 черных."
        },
        {
          text: "Какой химический элемент является самым распространённым во всей Вселенной?",
          type: "choice",
          options: ["Кислород", "Гелий", "Водород", "Углерод"],
          correctOptionIndex: 2,
          points: 15,
          answers: ["3", "3)", "водород", "hydrogen", "h", "в"],
          explanation: "Водород составляет около 75% всей элементарной массы обозримой Вселенной."
        },
        {
          text: "Какое из этих животных может дремать стоя, но видит сны только лёжа?",
          type: "choice",
          options: ["Лошадь", "Медведь", "Слон", "Жираф"],
          correctOptionIndex: 0,
          points: 15,
          answers: ["1", "1)", "лошадь", "конь", "а"],
          explanation: "Благодаря особому суставному «запорному» аппарату лошади спят стоя, но глубокая REM-фаза со снами возможна только лёжа."
        }
      ]
    },
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
  app.post("/api/questions/install-pack", requireAuth, (req, res) => {
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
        type: q.type,
        points: q.points,
        answers: q.answers,
        explanation: q.explanation || "",
        sort_order: current.length + idx,
        options: (q as any).options ? [...(q as any).options] : undefined,
        correctOptionIndex: (q as any).correctOptionIndex
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
