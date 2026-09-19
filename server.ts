import express from "express";
import path from "path";
import fs from "fs";
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

function ensureQuestionsFile() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(QUESTIONS_FILE)) {
      fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(DEFAULT_QUESTIONS_BACKUP, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("Error ensuring questions file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  ensureQuestionsFile();

  // API Health Check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // GET /api/questions - Возвращает текущий список вопросов
  app.get("/api/questions", (_req, res) => {
    try {
      ensureQuestionsFile();
      const rawData = fs.readFileSync(QUESTIONS_FILE, "utf-8");
      const questions = JSON.parse(rawData);
      res.json(questions);
    } catch (err) {
      console.error("Failed to read questions.json:", err);
      res.status(500).json({ error: "Failed to read questions", fallback: DEFAULT_QUESTIONS_BACKUP });
    }
  });

  // POST /api/questions - Сохраняет обновлённый список вопросов из UI
  app.post("/api/questions", (req, res) => {
    try {
      const body = req.body;
      const questionsToSave = Array.isArray(body) ? body : (body?.questions || []);

      if (!Array.isArray(questionsToSave)) {
        res.status(400).json({ error: "Invalid questions payload: must be an array" });
        return;
      }

      ensureQuestionsFile();
      fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questionsToSave, null, 2), "utf-8");

      res.json({
        success: true,
        count: questionsToSave.length,
        savedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("Failed to save questions.json:", err);
      res.status(500).json({ error: "Failed to save questions" });
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
