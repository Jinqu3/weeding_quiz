import { useState, useEffect } from 'react';
import { Question, UserScore, DbStatus, AuthStatus } from './types';
import { DEFAULT_QUESTIONS } from './data/mockData';
import { Header, ActiveTab } from './components/Header';
import { TelegramSimulator } from './components/TelegramSimulator';
import { QuestionEditor } from './components/QuestionEditor';
import { CodeViewer } from './components/CodeViewer';
import { SetupGuide } from './components/SetupGuide';
import { AdminLockScreen } from './components/AdminLockScreen';
import { SecurityModal } from './components/SecurityModal';
import { fetchAuthStatus, logoutAdmin, getAuthHeader } from './services/auth';

const LOCAL_STORAGE_KEY_QUESTIONS = 'telegram_quiz_bot_questions_v1';

export type SyncStatus = 'synced' | 'saving' | 'offline';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Authentication state
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    isProtected: false,
    isAuthenticated: true,
    hasEnvPassword: false,
  });
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState<boolean>(false);

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
    fetch('/api/db/status', {
      headers: { ...getAuthHeader() }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setDbStatus(data);
      })
      .catch(() => {});
  };

  // Проверка статуса авторизации при старте
  const checkAuth = async () => {
    try {
      const status = await fetchAuthStatus();
      setAuthStatus(status);
    } catch (e) {
      console.error('Failed to fetch auth status:', e);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Синхронизация при первом открытии страницы: загружаем актуальные вопросы с сервера (/api/questions)
  const syncQuestionsFromServer = () => {
    refreshDbStatus();

    fetch('/api/questions', {
      headers: { ...getAuthHeader() }
    })
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
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthLoading && (!authStatus.isProtected || authStatus.isAuthenticated)) {
      syncQuestionsFromServer();
    }
  }, [isAuthLoading, authStatus.isAuthenticated, authStatus.isProtected]);

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
        ...getAuthHeader(),
      },
      body: JSON.stringify(newQuestions),
    })
      .then((res) => {
        if (res.ok) {
          setSyncStatus('synced');
          refreshDbStatus();
        } else if (res.status === 401) {
          setSyncStatus('offline');
          // Сессия истекла или требуется пароль
          checkAuth();
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

  const handleLogout = async () => {
    await logoutAdmin();
    setAuthStatus(prev => ({ ...prev, isAuthenticated: false }));
  };

  const handleLoginSuccess = () => {
    setAuthStatus(prev => ({ ...prev, isAuthenticated: true }));
    syncQuestionsFromServer();
  };

  // Если защита включена и пользователь не авторизован — показываем экран блокировки
  if (!isAuthLoading && authStatus.isProtected && !authStatus.isAuthenticated) {
    return (
      <AdminLockScreen
        onLoginSuccess={handleLoginSuccess}
        hasEnvPassword={authStatus.hasEnvPassword}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 flex flex-col font-sans text-slate-900">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        questionsCount={questions.length}
        syncStatus={syncStatus}
        authStatus={authStatus}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        onLogout={handleLogout}
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

      {/* Security & Docker Volume Modal */}
      {isSecurityModalOpen && (
        <SecurityModal
          isOpen={isSecurityModalOpen}
          authStatus={authStatus}
          onClose={() => setIsSecurityModalOpen(false)}
          onAuthStatusChange={(updated: AuthStatus) => setAuthStatus(updated)}
          onLogout={handleLogout}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
          <p>
            Чат-бот викторины для Telegram на <b>aiogram 3</b> • База SQLite + Постоянный том Docker (Volume).
          </p>
          <button
            onClick={() => setIsSecurityModalOpen(true)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
          >
            🔒 Защита доступа и Docker Volume
          </button>
        </div>
      </footer>
    </div>
  );
}

