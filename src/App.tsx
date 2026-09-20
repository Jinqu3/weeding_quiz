import { useState, useEffect } from 'react';
import { Question, UserScore, DbStatus } from './types';
import { DEFAULT_QUESTIONS } from './data/mockData';
import { Header, ActiveTab } from './components/Header';
import { TelegramSimulator } from './components/TelegramSimulator';
import { QuestionEditor } from './components/QuestionEditor';
import { CodeViewer } from './components/CodeViewer';
import { SetupGuide } from './components/SetupGuide';

const LOCAL_STORAGE_KEY_QUESTIONS = 'telegram_quiz_bot_questions_v1';

export type SyncStatus = 'synced' | 'saving' | 'offline';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Load questions from localStorage or fallback to defaults
  const [questions, setQuestions] = useState<Question[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_QUESTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_QUESTIONS;
  });

  // Функция обновления статуса БД
  const refreshDbStatus = () => {
    fetch('/api/db/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setDbStatus(data);
      })
      .catch(() => {});
  };

  // Синхронизация при первом открытии страницы: загружаем актуальные вопросы с сервера (/api/questions)
  useEffect(() => {
    refreshDbStatus();

    fetch('/api/questions')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('API unavailable');
      })
      .then((serverQuestions: Question[]) => {
        if (Array.isArray(serverQuestions) && serverQuestions.length > 0) {
          setQuestions(serverQuestions);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_QUESTIONS, JSON.stringify(serverQuestions));
          } catch {
            // ignore
          }
          setSyncStatus('synced');
        }
      })
      .catch(() => {
        // Если API недоступен, остаемся на localStorage
        setSyncStatus('offline');
      });
  }, []);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [scores, setScores] = useState<Record<string, UserScore>>({});
  const [registeredUserIds, setRegisteredUserIds] = useState<string[]>([]);

  // Сохраняем вопросы в React state, localStorage и на сервер (/api/questions -> data/questions.json)
  const handleUpdateQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    setSyncStatus('saving');

    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_QUESTIONS, JSON.stringify(newQuestions));
    } catch {
      // ignore
    }

    fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newQuestions),
    })
      .then((res) => {
        if (res.ok) {
          setSyncStatus('synced');
          refreshDbStatus();
        } else {
          setSyncStatus('offline');
        }
      })
      .catch(() => {
        setSyncStatus('offline');
      });
  };

  const handleResetToDefaults = () => {
    if (confirm('Сбросить вопросы к стандартным примерам? Ваши изменения будут заменены.')) {
      handleUpdateQuestions(DEFAULT_QUESTIONS);
      setCurrentQuestionIndex(-1);
      setScores({});
      setRegisteredUserIds([]);
    }
  };

  const handleResetQuiz = () => {
    setCurrentQuestionIndex(-1);
    setScores({});
    setRegisteredUserIds([]);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        questionsCount={questions.length}
        syncStatus={syncStatus}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'simulator' && (
          <TelegramSimulator
            questions={questions}
            currentQuestionIndex={currentQuestionIndex}
            onSetCurrentQuestionIndex={setCurrentQuestionIndex}
            scores={scores}
            onUpdateScores={setScores}
            onResetQuiz={handleResetQuiz}
            registeredUserIds={registeredUserIds}
            onSetRegisteredUserIds={setRegisteredUserIds}
          />
        )}

        {activeTab === 'questions' && (
          <QuestionEditor
            questions={questions}
            onUpdateQuestions={handleUpdateQuestions}
            onResetToDefaults={handleResetToDefaults}
            currentQuestionIndex={currentQuestionIndex}
            dbStatus={dbStatus}
            onRefreshDbStatus={refreshDbStatus}
          />
        )}

        {activeTab === 'code' && (
          <CodeViewer questions={questions} />
        )}

        {activeTab === 'guide' && (
          <SetupGuide />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <p>
          Чат-бот викторины для Telegram на <b>aiogram 3</b> • Поддержка двух режимов: общие вопросы и вопросы на скорость (первый ответивший).
        </p>
      </footer>
    </div>
  );
}
