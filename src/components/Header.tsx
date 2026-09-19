import { MessageSquare, ListPlus, Code2, BookOpen, Bot } from 'lucide-react';

export type ActiveTab = 'simulator' | 'questions' | 'code' | 'guide';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  questionsCount: number;
}

export function Header({ activeTab, onSelectTab, questionsCount }: HeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Telegram Quiz Bot Studio
                </h1>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md border border-indigo-200">
                  aiogram 3.x
                </span>
                <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                  <span>🎰</span>
                  <span>1 балл = 1 CasinoCoin</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Конструктор викторины, интерактивный симулятор чата и генератор Python-кода
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => onSelectTab('simulator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'simulator'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Симулятор чата
            </button>

            <button
              onClick={() => onSelectTab('questions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'questions'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              Вопросы
              <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full">
                {questionsCount}
              </span>
            </button>

            <button
              onClick={() => onSelectTab('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'code'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Python-код aiogram
            </button>

            <button
              onClick={() => onSelectTab('guide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Гайд по запуску
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
