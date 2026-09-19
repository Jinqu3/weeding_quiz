import { useState, useEffect } from 'react';
import { Question, UserScore } from './types';
import { DEFAULT_QUESTIONS } from './data/mockData';
import { Header, ActiveTab } from './components/Header';
import { TelegramSimulator } from './components/TelegramSimulator';
import { QuestionEditor } from './components/QuestionEditor';
import { CodeViewer } from './components/CodeViewer';
import { SetupGuide } from './components/SetupGuide';

const LOCAL_STORAGE_KEY_QUESTIONS = 'telegram_quiz_bot_questions_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('simulator');

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

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(-1);
  const [scores, setScores] = useState<Record<string, UserScore>>({});
  const [registeredUserIds, setRegisteredUserIds] = useState<string[]>([]);

  // Save questions changes to localStorage
  const handleUpdateQuestions = (newQuestions: Question[]) => {
    setQuestions(newQuestions);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_QUESTIONS, JSON.stringify(newQuestions));
    } catch {
      // ignore
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Сбросить вопросы к стандартным примерам? Ваши изменения будут заменены.')) {
      setQuestions(DEFAULT_QUESTIONS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_QUESTIONS);
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
