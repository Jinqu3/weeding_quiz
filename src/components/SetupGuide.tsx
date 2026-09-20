import { useState } from 'react';
import { CheckCircle2, ChevronRight, Copy, Check, ShieldAlert, Terminal, MessageSquare, Bot } from 'lucide-react';

export function SetupGuide() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      number: '01',
      title: 'Создание бота в Telegram через @BotFather',
      icon: <Bot className="w-5 h-5 text-indigo-600" />,
      content: (
        <div className="space-y-2 text-xs text-slate-600">
          <p>
            1. Откройте Telegram и найдите официального бота <b>@BotFather</b>.
          </p>
          <p>
            2. Нажмите <b>Start</b> и отправьте команду:
          </p>
          <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono flex items-center justify-between">
            <span>/newbot</span>
            <button
              onClick={() => copyToClipboard('/newbot', 1)}
              className="text-slate-400 hover:text-white"
            >
              {copiedIndex === 1 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p>
            3. Задайте имя (например, <i>Мой Квиз Бот</i>) и юзернейм (например, <i>my_super_quiz_bot</i>).
          </p>
          <p>
            4. Скопируйте полученный <b>HTTP API Token</b> (он понадобится для запуска).
          </p>
        </div>
      )
    },
    {
      number: '02',
      title: 'КРИТИЧНО: Отключение Privacy Mode в группах',
      icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
      highlight: true,
      content: (
        <div className="space-y-2 text-xs text-slate-700">
          <div className="bg-amber-100/70 border border-amber-300 p-3 rounded-lg text-amber-900">
            <b>Зачем это нужно:</b> По умолчанию боты в группах Telegram получают <i>только команды</i> (/next, /stat). Обычные ответы участников (например, «Париж») Telegram блокирует в целях конфиденциальности, пока вы не отключите Privacy Mode.
          </div>
          <p className="font-semibold text-slate-900">Инструкция в диалоге с @BotFather:</p>
          <ol className="list-decimal list-inside space-y-1.5 pl-1">
            <li>Отправьте команду <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">/setprivacy</code></li>
            <li>Выберите вашего созданного бота из списка</li>
            <li>Нажмите кнопку <b>«Disable»</b> (Отключить)</li>
            <li>BotFather ответит: <i>«Success! The new status is: DISABLED»</i></li>
          </ol>
        </div>
      )
    },
    {
      number: '03',
      title: 'Добавление бота в групповой чат',
      icon: <MessageSquare className="w-5 h-5 text-sky-600" />,
      content: (
        <div className="space-y-2 text-xs text-slate-600">
          <p>
            1. Создайте группу в Telegram или откройте существующий чат с друзьями / коллегами.
          </p>
          <p>
            2. Нажмите «Добавить участников» и введите юзернейм вашего бота.
          </p>
          <p>
            3. Разрешите боту отправку сообщений (при желании можно назначить его администратором группы).
          </p>
        </div>
      )
    },
    {
      number: '04',
      title: 'Куда вставить токен и как запустить скрипт',
      icon: <Terminal className="w-5 h-5 text-emerald-600" />,
      content: (
        <div className="space-y-3 text-xs text-slate-600">
          <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl space-y-2">
            <p className="font-bold text-indigo-950 flex items-center gap-1.5">
              <span>🔑 Куда именно вставить токен:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="font-bold text-indigo-800">Вариант А (через файл .env):</span>
                <p className="text-slate-600 mt-1">
                  Создайте файл с именем <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">.env</code> в одной папке с <code className="font-mono">bot.py</code> и напишите:
                </p>
                <p className="bg-slate-900 text-emerald-300 font-mono p-1.5 rounded mt-1.5 text-[10px]">
                  BOT_TOKEN="ваш_токен_от_botfather"
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="font-bold text-indigo-800">Вариант Б (прямо в bot.py):</span>
                <p className="text-slate-600 mt-1">
                  Откройте <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold">bot.py</code> и на строке 28 укажите строку:
                </p>
                <p className="bg-slate-900 text-emerald-300 font-mono p-1.5 rounded mt-1.5 text-[10px]">
                  BOT_TOKEN = "ваш_токен_от_botfather"
                </p>
              </div>
            </div>
          </div>

          <p>Команды для установки библиотек и запуска:</p>
          <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Команды терминала:</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    'pip install -r requirements.txt\npython bot.py',
                    4
                  )
                }
                className="hover:text-white"
              >
                {copiedIndex === 4 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-emerald-400"># 1. Установите библиотеки (aiogram и python-dotenv)</p>
            <p>pip install -r requirements.txt</p>
            <p className="text-emerald-400 mt-2"># 2. Запустите бота</p>
            <p className="text-indigo-300 font-bold">python bot.py</p>
          </div>
          <p className="text-slate-500">
            После запуска в консоли появится: <span className="font-mono text-slate-700 font-semibold">«🚀 Бот викторины успешно запущен! Ожидание сообщений...»</span>
          </p>
        </div>
      )
    },
    {
      number: '05',
      title: 'Запуск в Docker (Веб-интерфейс + Бот с авто-синхронизацией)',
      icon: <Terminal className="w-5 h-5 text-sky-600" />,
      highlight: true,
      content: (
        <div className="space-y-3 text-xs text-slate-700">
          <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-sky-950">
            <b>🐳 Всё в одном:</b> При запуске через Docker Compose поднимаются сразу 2 сервиса:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li><b>web (порт 3000):</b> этот визуальный редактор вопросов и REST API.</li>
              <li><b>bot (в фоне):</b> Telegram-бот на Python (aiogram 3), непрерывно слушающий чаты.</li>
              <li><b>Общий том (./data):</b> любые вопросы, созданные или отредактированные в веб-интерфейсе, сохраняются в SQLite БД <code className="bg-sky-100 font-bold px-1 rounded">data/quiz.db</code> и резервный <code className="bg-sky-100 font-bold px-1 rounded">data/questions.json</code> и мгновенно доступны боту!</li>
            </ul>
          </div>

          <p className="font-semibold text-slate-900">Команды для запуска в Docker на вашем сервере или компьютере:</p>

          <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span>Запуск в фоновом режиме (-d):</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    '# 1. Задайте токен вашего бота\nexport BOT_TOKEN="ваш_токен_от_BotFather"\n\n# 2. Запустите всё одной командой в фоне\ndocker compose up -d --build\n\n# 3. Просмотр логов бота\ndocker compose logs -f bot',
                    5
                  )
                }
                className="hover:text-white"
              >
                {copiedIndex === 5 ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-emerald-400"># 1. Задайте токен Telegram бота (или запишите в .env):</p>
            <p className="text-amber-300">echo 'BOT_TOKEN="ваш_токен_от_BotFather"' &gt; .env</p>
            <p className="text-emerald-400 mt-2"># 2. Запустите в фоне (работает 24/7 даже при закрытии терминала):</p>
            <p className="text-sky-300 font-bold">docker compose up -d --build</p>
            <p className="text-emerald-400 mt-2"># 3. Просмотр логов бота в реальном времени:</p>
            <p>docker compose logs -f bot</p>
            <p className="text-emerald-400 mt-2"># 4. Остановка контейнеров:</p>
            <p>docker compose down</p>
          </div>

          <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200">
            <span className="font-bold text-slate-900">🌐 Как попасть в Веб-интерфейс на сервере:</span>
            <p className="text-slate-600 mt-0.5">
              Откройте в браузере <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-indigo-700 font-bold">http://IP_ВАШЕГО_СЕРВЕРА:3000</code>. Все добавленные вопросы сразу запишутся в файл и передадутся боту!
            </p>
          </div>
        </div>
      )
    },
    {
      number: '06',
      title: 'Проведение викторины в чате',
      icon: <CheckCircle2 className="w-5 h-5 text-violet-600" />,
      content: (
        <div className="space-y-2 text-xs text-slate-600">
          <p>
            В чате викторины участники регистрируются, а бот автоматически завершает вопросы:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="font-mono font-bold text-emerald-800">/join</span>
              <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">
                Обязательно! Вход в игру. Только от игроков за столом принимаются ответы.
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-mono font-bold text-slate-700">/players</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Показывает список всех участников за игровым столом.
              </p>
            </div>
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="font-mono font-bold text-indigo-700">/next</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Выдает следующий вопрос. Бот ждет ответов от всех игроков.
              </p>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="font-mono font-bold text-amber-700">/stat</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Банкролл фишек казино (CasinoCoins 🪙) и таблица лидеров с шуточными титулами.
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-mono font-bold text-slate-700">/current</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Текущий вопрос и статус: сколько игроков ответили и кого ждём.
              </p>
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
              <span className="font-mono font-bold text-rose-800">/roulette</span>
              <p className="text-[11px] text-rose-700 mt-0.5 font-medium">
                Хитрая рулетка ва-банк! Ставит ВСЕ фишки. Коварный алгоритм казино: в ~86% уводит в убыток или зеро (0.0 – 0.9x), и лишь ~9% на редкий куш!
              </p>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="font-mono font-bold text-rose-700">/reset</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Обнуляет фишки, регистрацию и начинает викторину заново.
              </p>
            </div>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 mt-2 text-[11px]">
            ⚡ <b>Автозавершение вопроса:</b> Как только все зарегистрированные участники дали ответ (верно или неверно) — раунд объявляется закрытым, выводится правильный ответ, и бот больше не принимает сообщения до команды <b>/next</b>.
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900">
          Пошаговый гайд: от идеи до работающего бота в Telegram
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Все шаги для быстрого запуска вашего квиз-бота на Python и aiogram 3.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`bg-white rounded-xl border p-5 shadow-xs transition-all ${
              step.highlight ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs flex-shrink-0">
                {step.number}
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {step.icon}
                  <h3 className="font-bold text-sm text-slate-900">{step.title}</h3>
                </div>
                {step.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
