import { useState } from 'react';
import { Question, QuestionType } from '../types';
import { Plus, Trash2, Edit3, Check, X, Sparkles, Zap, Users, HelpCircle, ArrowUp, ArrowDown } from 'lucide-react';

interface QuestionEditorProps {
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
  onResetToDefaults: () => void;
  currentQuestionIndex: number;
}

export function QuestionEditor({
  questions,
  onUpdateQuestions,
  onResetToDefaults,
  currentQuestionIndex
}: QuestionEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState<QuestionType>('general');
  const [formPoints, setFormPoints] = useState<number>(10);
  const [formAnswers, setFormAnswers] = useState<string>('');
  const [formExplanation, setFormExplanation] = useState('');
  const [error, setError] = useState('');

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setIsAddingNew(false);
    setFormText(q.text);
    setFormType(q.type);
    setFormPoints(q.points);
    setFormAnswers(q.answers.join(', '));
    setFormExplanation(q.explanation || '');
    setError('');
  };

  const startNew = () => {
    setIsAddingNew(true);
    setEditingId(null);
    setFormText('');
    setFormType('general');
    setFormPoints(10);
    setFormAnswers('');
    setFormExplanation('');
    setError('');
  };

  const cancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setError('');
  };

  const saveQuestion = () => {
    if (!formText.trim()) {
      setError('Введите текст вопроса');
      return;
    }
    const answersList = formAnswers
      .split(',')
      .map(a => a.trim().toLowerCase())
      .filter(Boolean);

    if (answersList.length === 0) {
      setError('Укажите хотя бы один правильный вариант ответа через запятую');
      return;
    }

    if (isAddingNew) {
      const newQuestion: Question = {
        id: 'q_' + Date.now(),
        text: formText.trim(),
        type: formType,
        points: Number(formPoints) || 10,
        answers: answersList,
        explanation: formExplanation.trim() || undefined
      };
      onUpdateQuestions([...questions, newQuestion]);
      setIsAddingNew(false);
    } else if (editingId) {
      const updated = questions.map(q => {
        if (q.id === editingId) {
          return {
            ...q,
            text: formText.trim(),
            type: formType,
            points: Number(formPoints) || 10,
            answers: answersList,
            explanation: formExplanation.trim() || undefined
          };
        }
        return q;
      });
      onUpdateQuestions(updated);
      setEditingId(null);
    }
    setError('');
  };

  const deleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      alert('Должен остаться хотя бы один вопрос в викторине.');
      return;
    }
    onUpdateQuestions(questions.filter(q => q.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const copy = [...questions];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    onUpdateQuestions(copy);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>База вопросов викторины</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-medium border border-indigo-200">
              {questions.length} вопросов
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Настройте вопросы, которые бот будет отправлять участникам чата по команде <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-xs">/next</code>.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onResetToDefaults}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors"
          >
            Восстановить примеры
          </button>
          <button
            onClick={startNew}
            disabled={isAddingNew}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Добавить вопрос
          </button>
        </div>
      </div>

      {/* Editor Modal / Inline Form */}
      {(isAddingNew || editingId) && (
        <div className="bg-indigo-50/40 border-2 border-indigo-200 rounded-xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {isAddingNew ? (
                <>
                  <Plus className="w-5 h-5 text-indigo-600" /> Новый вопрос викторины
                </>
              ) : (
                <>
                  <Edit3 className="w-5 h-5 text-indigo-600" /> Редактирование вопроса
                </>
              )}
            </h3>
            <button
              onClick={cancelForm}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2 rounded-md font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Текст вопроса *
              </label>
              <textarea
                value={formText}
                onChange={e => setFormText(e.target.value)}
                placeholder="Например: Какая планета ближе всего к Солнцу?"
                rows={2}
                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Тип начисления баллов *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('general')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                      formType === 'general'
                        ? 'border-indigo-600 bg-white shadow-xs text-indigo-700 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Users className="w-4 h-4 mb-1 text-indigo-500" />
                    <span className="text-xs font-bold">1. Общий</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Баллы всем правильным
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('first')}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                      formType === 'first'
                        ? 'border-amber-500 bg-white shadow-xs text-amber-800 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Zap className="w-4 h-4 mb-1 text-amber-500" />
                    <span className="text-xs font-bold">2. На скорость</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Баллы только первому
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Баллы за верный ответ *
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={formPoints}
                  onChange={e => setFormPoints(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Рекомендуется от 10 до 50 очков за вопрос.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Варианты правильного ответа (через запятую) *
              </label>
              <input
                type="text"
                value={formAnswers}
                onChange={e => setFormAnswers(e.target.value)}
                placeholder="меркурий, mercury, планета меркурий"
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Бот автоматически убирает лишние пробелы и игнорирует регистр букв (большие/маленькие).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Пояснение или интересный факт (необязательно)
              </label>
              <input
                type="text"
                value={formExplanation}
                onChange={e => setFormExplanation(e.target.value)}
                placeholder="Меркурий обращается вокруг Солнца всего за 88 земных суток."
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelForm}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={saveQuestion}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
            >
              <Check className="w-4 h-4" />
              {isAddingNew ? 'Добавить в базу' : 'Сохранить изменения'}
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const isActive = idx === currentQuestionIndex;
          return (
            <div
              key={q.id}
              className={`bg-white border rounded-xl p-4 transition-all duration-200 shadow-xs ${
                isActive ? 'border-indigo-400 ring-2 ring-indigo-500/15' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center font-bold text-xs">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {q.type === 'first' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Zap className="w-3 h-3" /> На скорость (первому)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Users className="w-3 h-3" /> Общий (каждому)
                        </span>
                      )}
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        +{q.points} очков
                      </span>
                      {isActive && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          Текущий в симуляторе
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{q.text}</p>
                    
                    <div className="mt-2 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Ответы:</span>
                      {q.answers.map((ans, aIdx) => (
                        <span
                          key={aIdx}
                          className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-[11px] border border-slate-200"
                        >
                          {ans}
                        </span>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="mt-1.5 text-xs text-slate-500 italic">
                        💡 {q.explanation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveQuestion(idx, 'up')}
                    disabled={idx === 0}
                    title="Переместить выше"
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveQuestion(idx, 'down')}
                    disabled={idx === questions.length - 1}
                    title="Переместить ниже"
                    className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startEdit(q)}
                    title="Редактировать"
                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    title="Удалить"
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
