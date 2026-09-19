import { useState } from 'react';
import { Question } from '../types';
import { generateBotPy, generateRequirementsTxt, generateEnvExample, generateReadmeMd } from '../utils/pythonCodeGenerator';
import { Copy, Check, Download, FileCode, ShieldAlert, BookOpen, Terminal, Sparkles, Key, HelpCircle } from 'lucide-react';

interface CodeViewerProps {
  questions: Question[];
}

export function CodeViewer({ questions }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState<'bot' | 'req' | 'env' | 'readme'>('bot');
  const [copied, setCopied] = useState(false);
  const [userToken, setUserToken] = useState('');
  const [inlineToken, setInlineToken] = useState(false);

  const botPyCode = generateBotPy(questions, userToken, inlineToken);
  const requirementsTxt = generateRequirementsTxt();
  const envExample = generateEnvExample(userToken);
  const readmeMd = generateReadmeMd();

  const getActiveCode = () => {
    switch (activeTab) {
      case 'bot':
        return { filename: 'bot.py', content: botPyCode };
      case 'req':
        return { filename: 'requirements.txt', content: requirementsTxt };
      case 'env':
        return { filename: '.env', content: envExample };
      case 'readme':
        return { filename: 'README.md', content: readmeMd };
    }
  };

  const currentFile = getActiveCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = currentFile.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* "Where to add Token" Card */}
      <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>Куда добавить токен бота?</span>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  2 простых способа
                </span>
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Токен выдается в Telegram в диалоге с <b>@BotFather</b> после создания бота командой <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800">/newbot</code>.
              </p>
            </div>
          </div>

          {/* Quick Token Paste Input */}
          <div className="w-full md:w-80">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Вставьте ваш токен для генерации:
            </label>
            <div className="relative">
              <input
                type="text"
                value={userToken}
                onChange={e => setUserToken(e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
              {userToken && (
                <button
                  onClick={() => setUserToken('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2 Methods Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {/* Method 1: .env file */}
          <div
            onClick={() => setInlineToken(false)}
            className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
              !inlineToken
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-indigo-900">
                Способ 1: В отдельный файл .env (Рекомендуется)
              </span>
              {!inlineToken && (
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                  Выбран
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Создайте рядом с <code className="font-mono text-slate-800 font-bold">bot.py</code> текстовый файл с именем <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-indigo-700 font-bold">.env</code> и напишите:
            </p>
            <div className="mt-2 bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[11px] overflow-x-auto">
              BOT_TOKEN="{userToken || '1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ'}"
            </div>
          </div>

          {/* Method 2: Directly in bot.py */}
          <div
            onClick={() => setInlineToken(true)}
            className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
              inlineToken
                ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-900">
                Способ 2: Напрямую в код bot.py (Быстрый тест)
              </span>
              {inlineToken && (
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">
                  Выбран
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Вставить токен строкой в <code className="font-mono text-slate-800 font-bold">bot.py</code> (без создания файла <code className="font-mono">.env</code>):
            </p>
            <div className="mt-2 bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[11px] overflow-x-auto">
              BOT_TOKEN = "{userToken || '1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ'}"
            </div>
          </div>
        </div>
      </div>

      {/* Casino & Humor Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-amber-500/10 border border-amber-300/80 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-900 rounded-lg flex-shrink-0 text-lg">
          🎰
        </div>
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-amber-950">
              Казино, Регистрация (/join) и Автозавершение вопросов
            </h4>
            <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              Встроено в код
            </span>
          </div>
          <p className="text-amber-900/90 mt-1 leading-relaxed text-xs">
            🎟️ <b>Регистрация и постоянство стола:</b> Участники отправляют <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">/join</code> один раз и <b>остаются за столом до конца всех вопросов викторины</b>! Повторно вступать после каждого вопроса не требуется.
          </p>
          <p className="text-amber-900/90 mt-1 leading-relaxed text-xs">
            ⚡ <b>Вопросы на скорость:</b> Ждать остальных игроков не нужно! Раунд завершается мгновенно, как только первый участник назовёт правильный ответ — он сразу забирает куш.
          </p>
          <p className="text-amber-900/90 mt-1 leading-relaxed text-xs">
            👥 <b>Общие вопросы (скрытые ставки):</b> Ответы игроков держатся в секрете, пока все сидящие за столом участники не сделают ход. Затем раунд закрывается, и бот объявляет верный ответ со списком победителей.
          </p>
          <p className="text-amber-900/90 mt-1 leading-relaxed text-xs">
            🎡 <b>Метод «Хитрая Рулетка» (/roulette):</b> Ставит <b>все очки</b> игрока ва-банк! Алгоритм коварен: шарик с вероятностью ~86% уводит в убыток (множители 0.1 – 0.9x) или полный крах на Зеро (0.0x), 5% на возврат (1.0x) и лишь ~9% на прибыль, делая джекпот x2.0 редчайшим событием!
          </p>
          <p className="text-amber-900/90 mt-1 leading-relaxed text-xs">
            💰 <b>Конвертация валюты:</b> Все очки игроков считаются как <b>CasinoCoins 🪙 (фишки)</b> для ставок в казино.
          </p>
          <p className="text-amber-900/80 mt-1 text-xs">
            🃏 <b>Шутки бота:</b> В код добавлены случайные реплики крупье при верных ответах, ошибки при промахе рулетки («Мимо кассы! Зеро!»), подколы для тех, кто опоздал на скорость, и титулы в <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">/stat</code>.
          </p>
        </div>
      </div>

      {/* BotFather Warning Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3.5 shadow-xs">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-lg flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="text-sm">
          <h4 className="font-bold text-amber-900">
            Обязательный шаг в @BotFather: Отключите «Privacy Mode»!
          </h4>
          <p className="text-amber-800 mt-1 leading-relaxed text-xs">
            По умолчанию в Telegram боты в групповых чатах <b>не видят обычные сообщения пользователей</b> (видят только команды со слэшем <code className="bg-amber-200/60 px-1 py-0.5 rounded font-mono">/</code>). Чтобы бот мог проверять текстовые ответы людей на вопросы:
          </p>
          <p className="mt-1 font-semibold text-amber-900 text-xs">
            Напишите в <span className="underline">@BotFather</span> команду <code className="bg-amber-200/60 px-1 py-0.5 rounded font-mono">/setprivacy</code> → выберите вашего бота → выберите <b>Disable</b>.
          </p>
        </div>
      </div>

      {/* Code Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        {/* Editor Tabs & Actions */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('bot')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'bot'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              bot.py (Основной код)
            </button>

            <button
              onClick={() => setActiveTab('req')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'req'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              requirements.txt
            </button>

            <button
              onClick={() => setActiveTab('env')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'env'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              .env
            </button>

            <button
              onClick={() => setActiveTab('readme')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'readme'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              README.md
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
              {copied ? 'Скопировано!' : 'Копировать'}
            </button>

            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              Скачать {currentFile.filename}
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-x-auto max-h-[580px] font-mono text-xs text-slate-200 bg-slate-900 leading-relaxed select-text">
          <pre>
            <code>{currentFile.content}</code>
          </pre>
        </div>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1">
            <Terminal className="w-4 h-4 text-indigo-600" />
            aiogram 3.x архитектура
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            Использует современный синтаксис aiogram 3: <code className="text-indigo-600 font-bold">Router</code>, <code className="text-indigo-600 font-bold">CommandStart()</code>, <code className="text-indigo-600 font-bold">Command("next")</code> и фильтры сообщений.
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Защита от race conditions
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            Вопрос «на скорость» защищен асинхронным мьютексом <code className="text-amber-700 font-bold font-mono">asyncio.Lock</code>: если два игрока ответят в одну миллисекунду, баллы заберет строго первый.
          </p>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-1">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            Изоляция по чатам
          </h4>
          <p className="text-slate-600 text-xs leading-relaxed">
            Словарь состояний <code className="text-emerald-700 font-bold font-mono">chat_states</code> хранит активный вопрос и баллы для каждого группового чата отдельно по его <code className="font-mono">chat_id</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
