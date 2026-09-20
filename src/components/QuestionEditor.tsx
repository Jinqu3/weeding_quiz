import { useState, useMemo, useEffect } from 'react';
import { Question, QuestionType, DbStatus } from '../types';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Zap,
  Users,
  ArrowUp,
  ArrowDown,
  Database,
  FileText,
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  ClipboardPaste,
  Search,
  Package,
  Loader2,
  Lightbulb,
  ExternalLink
} from 'lucide-react';

interface QuestionEditorProps {
  questions: Question[];
  onUpdateQuestions: (questions: Question[]) => void;
  onResetToDefaults: () => void;
  currentQuestionIndex: number;
  dbStatus?: DbStatus | null;
  onRefreshDbStatus?: () => void;
}

interface CuratedPack {
  id: string;
  name: string;
  badge: string;
  description: string;
  questions: Array<{
    text: string;
    type: string;
    points: number;
    answers: string[];
    explanation?: string;
  }>;
}

const AI_TOPIC_PRESETS = [
  '🎰 Казино, покер и рулетка',
  '🎬 Кино, сериалы и мультфильмы',
  '💻 IT, компьютеры и видеоигры',
  '🧠 Наука, космос и природа',
  '⚽ Футбол и мировой спорт',
  '⚡ Блиц-загадки с подвохом',
  '📜 История и цивилизации',
  '🚗 Автомобили и техника'
];

export function QuestionEditor({
  questions,
  onUpdateQuestions,
  onResetToDefaults,
  currentQuestionIndex,
  dbStatus,
  onRefreshDbStatus
}: QuestionEditorProps) {
  // Modal states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isPacksOpen, setIsPacksOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'general' | 'first'>('all');

  // Single Question Form state
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState<QuestionType>('general');
  const [formPoints, setFormPoints] = useState<number>(10);
  const [formAnswers, setFormAnswers] = useState<string>('');
  const [formExplanation, setFormExplanation] = useState('');
  const [error, setError] = useState('');

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [bulkNotification, setBulkNotification] = useState<string | null>(null);

  // AI Generator state
  const [aiTopic, setAiTopic] = useState('Казино, ставки и азартные игры');
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<Question[]>([]);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Curated Packs state
  const [packs, setPacks] = useState<CuratedPack[]>([]);
  const [installingPackId, setInstallingPackId] = useState<string | null>(null);
  const [packNotification, setPackNotification] = useState<string | null>(null);

  // Загружаем список доступных паков с сервера
  useEffect(() => {
    fetch('/api/questions/packs')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setPacks(data);
      })
      .catch(() => {});
  }, []);

  // Умный парсер свободного текста для вставки
  const parsedBulkQuestions = useMemo(() => {
    if (!bulkText.trim()) return [];
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const result: Question[] = [];

    lines.forEach((line, idx) => {
      // 1. Формат через вертикальную черту | или точку с запятой ;
      if (line.includes('|') || line.includes(';')) {
        const parts = line.includes('|') ? line.split('|') : line.split(';');
        const text = parts[0]?.trim();
        const rawAns = parts[1]?.trim();
        const points = parts[2] ? parseInt(parts[2].trim(), 10) || 10 : 10;
        const rawType = parts[3]?.trim().toLowerCase();
        const type: QuestionType = (rawType === 'first' || rawType === 'скорость' || rawType === 'быстро') ? 'first' : 'general';
        const explanation = parts[4]?.trim() || '';

        if (text && rawAns) {
          const answers = rawAns.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
          if (answers.length > 0) {
            result.push({
              id: `bulk_${Date.now()}_${idx}`,
              text,
              type,
              points,
              answers,
              explanation: explanation || undefined
            });
            return;
          }
        }
      }

      // 2. Формат: "Вопрос: ... Ответ: ..." или "Q: ... A: ..."
      const qaMatch = line.match(/(?:(?:Вопрос|Q|В):\s*)?(.+?)\s*(?:[-–—]|(?:\b(?:Ответ|A|О):\s*))(.+)/i);
      if (qaMatch) {
        let text = qaMatch[1].trim();
        // Убираем номер в начале: 1. 2) и т.д.
        text = text.replace(/^\d+[\.\)]\s*/, '');
        const rawAns = qaMatch[2].trim();
        const answers = rawAns.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
        const isSpeed = text.toLowerCase().includes('скорост') || text.includes('⚡');

        if (text && answers.length > 0) {
          result.push({
            id: `bulk_${Date.now()}_${idx}`,
            text,
            type: isSpeed ? 'first' : 'general',
            points: isSpeed ? 20 : 10,
            answers
          });
          return;
        }
      }

      // 3. Формат "Вопрос? (Ответ)"
      const bracketMatch = line.match(/^(.+?)\s*\((?:ответ:?\s*)?([^)]+)\)$/i);
      if (bracketMatch) {
        let text = bracketMatch[1].trim();
        text = text.replace(/^\d+[\.\)]\s*/, '');
        const rawAns = bracketMatch[2].trim();
        const answers = rawAns.split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
        if (text && answers.length > 0) {
          result.push({
            id: `bulk_${Date.now()}_${idx}`,
            text,
            type: 'general',
            points: 10,
            answers
          });
        }
      }
    });

    return result;
  }, [bulkText]);

  // Применение массового импорта
  const handleApplyBulkImport = () => {
    if (parsedBulkQuestions.length === 0) {
      alert('Не удалось распознать вопросы. Попробуйте скопировать строки вида: Вопрос | Ответ');
      return;
    }

    const updated = [...questions, ...parsedBulkQuestions];
    onUpdateQuestions(updated);
    setBulkNotification(`✅ Успешно добавлено ${parsedBulkQuestions.length} вопросов в SQLite БД!`);
    setBulkText('');
    setTimeout(() => {
      setIsBulkOpen(false);
      setBulkNotification(null);
      if (onRefreshDbStatus) onRefreshDbStatus();
    }, 1200);
  };

  // Вызов AI генерации
  const handleGenerateAi = async () => {
    setIsGeneratingAi(true);
    setAiSuccessMessage(null);
    setAiGeneratedQuestions([]);

    try {
      const res = await fetch('/api/questions/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          count: aiCount,
          difficulty: aiDifficulty,
          saveImmediately: false
        })
      });

      if (!res.ok) throw new Error('Ошибка генерации');
      const data = await res.json();

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const formatted: Question[] = data.questions.map((q: any, i: number) => ({
          id: `ai_${Date.now()}_${i}`,
          text: q.text,
          type: q.type === 'first' ? 'first' : 'general',
          points: Number(q.points) || 10,
          answers: Array.isArray(q.answers) ? q.answers : [String(q.answers)],
          explanation: q.explanation || ''
        }));
        setAiGeneratedQuestions(formatted);
      } else {
        alert('Не удалось получить вопросы от AI. Попробуйте другую тему.');
      }
    } catch (e) {
      console.error(e);
      alert('Ошибка соединения при генерации вопросов.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Сохранение всех сгенерированных AI вопросов в БД
  const handleAddAllAiQuestions = () => {
    if (aiGeneratedQuestions.length === 0) return;
    const updated = [...questions, ...aiGeneratedQuestions];
    onUpdateQuestions(updated);
    setAiSuccessMessage(`🎉 Все ${aiGeneratedQuestions.length} вопросов успешно сохранены в SQLite БД!`);
    setAiGeneratedQuestions([]);
    setTimeout(() => {
      setIsAiOpen(false);
      setAiSuccessMessage(null);
      if (onRefreshDbStatus) onRefreshDbStatus();
    }, 1200);
  };

  // Добавление одного конкретного AI вопроса
  const handleAddSingleAiQuestion = (q: Question) => {
    onUpdateQuestions([...questions, q]);
    setAiGeneratedQuestions(prev => prev.filter(item => item.id !== q.id));
    if (onRefreshDbStatus) onRefreshDbStatus();
  };

  // Установка готового тематического пака в 1 клик
  const handleInstallPack = async (pack: CuratedPack) => {
    setInstallingPackId(pack.id);
    try {
      const res = await fetch('/api/questions/install-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id })
      });

      if (res.ok) {
        const newItems: Question[] = pack.questions.map((q, idx) => ({
          id: `pack_${pack.id}_${Date.now()}_${idx}`,
          text: q.text,
          type: q.type === 'first' ? 'first' : 'general',
          points: q.points,
          answers: q.answers,
          explanation: q.explanation
        }));
        onUpdateQuestions([...questions, ...newItems]);
        setPackNotification(`✅ Пак «${pack.name}» (+${newItems.length} вопросов) добавлен в SQLite БД!`);
        setTimeout(() => {
          setPackNotification(null);
          if (onRefreshDbStatus) onRefreshDbStatus();
        }, 2000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setInstallingPackId(null);
    }
  };

  // Ручное редактирование
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
    if (onRefreshDbStatus) onRefreshDbStatus();
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
    if (onRefreshDbStatus) onRefreshDbStatus();
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

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Фильтрация и поиск вопросов
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'first' && q.type === 'first') ||
        (typeFilter === 'general' && q.type !== 'first');

      if (!matchesType) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const inText = q.text.toLowerCase().includes(query);
      const inAnswers = q.answers.some(a => a.toLowerCase().includes(query));
      const inExplanation = q.explanation ? q.explanation.toLowerCase().includes(query) : false;

      return inText || inAnswers || inExplanation;
    });
  }, [questions, typeFilter, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner with SQLite DB Status and Quick Action Buttons */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>База вопросов викторины</span>
            </h2>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
              {questions.length} вопросов в БД
            </span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200 flex items-center gap-1" title="Файл базы SQLite: data/quiz.db">
              <Database className="w-3 h-3 text-emerald-600" />
              <span>SQLite data/quiz.db</span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Любые изменения моментально сохраняются в базу данных и готовы для выдачи в Telegram-чате!
          </p>
        </div>

        {/* 4 Easy Ways to Add Questions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. AI Генератор */}
          <button
            onClick={() => {
              setIsAiOpen(!isAiOpen);
              setIsPacksOpen(false);
              setIsBulkOpen(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3.5 py-2 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="Генерация вопросов нейросетью по любой теме"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span>AI Генератор</span>
          </button>

          {/* 2. Готовые паки тем */}
          <button
            onClick={() => {
              setIsPacksOpen(!isPacksOpen);
              setIsAiOpen(false);
              setIsBulkOpen(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-2 rounded-lg transition-colors border border-amber-200"
            title="Установка готовых подборок вопросов (+5 в 1 клик)"
          >
            <Package className="w-3.5 h-3.5 text-amber-600" />
            <span>Готовые паки</span>
          </button>

          {/* 3. Умная вставка списком */}
          <button
            onClick={() => {
              setIsBulkOpen(!isBulkOpen);
              setIsAiOpen(false);
              setIsPacksOpen(false);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors border border-slate-200"
            title="Вставка вопросов списком из заметок или таблицы"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-slate-600" />
            <span>Вставить списком</span>
          </button>

          {/* 4. Обычное добавление одного вопроса */}
          <button
            onClick={startNew}
            disabled={isAddingNew}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {packNotification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs px-4 py-3 rounded-xl font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{packNotification}</span>
          </div>
          <span className="text-[11px] font-normal text-emerald-700">БД синхронизирована</span>
        </div>
      )}

      {/* --- SECTION: AI QUESTION GENERATOR --- */}
      {isAiOpen && (
        <div className="bg-gradient-to-br from-purple-50/90 via-indigo-50/50 to-white border-2 border-purple-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-purple-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  AI Генератор вопросов викторины
                </h3>
                <p className="text-xs text-slate-500">
                  Укажите тему или выберите готовый тег — искусственный интеллект составит проверенные вопросы с баллами и ответами!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAiOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preset Tags */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
              Быстрый выбор темы в 1 клик:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {AI_TOPIC_PRESETS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setAiTopic(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                    aiTopic === tag
                      ? 'bg-purple-600 text-white shadow-2xs font-bold'
                      : 'bg-white hover:bg-purple-100 text-slate-700 border border-purple-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Controls Form */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Тема или ключевые слова
              </label>
              <input
                type="text"
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                placeholder="Например: Гарри Поттер, Советские комедии, Формула 1..."
                className="w-full bg-white border border-purple-200 rounded-lg p-2.5 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Количество
              </label>
              <div className="flex items-center gap-1">
                {[3, 5, 8].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setAiCount(cnt)}
                    className={`flex-1 text-xs py-2 rounded-lg font-bold border transition-colors ${
                      aiCount === cnt
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white border-purple-200 text-slate-700 hover:bg-purple-50'
                    }`}
                  >
                    {cnt} шт.
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-sm transition-all"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Генерирую...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Сгенерировать</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Success message */}
          {aiSuccessMessage && (
            <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs px-4 py-2.5 rounded-lg font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{aiSuccessMessage}</span>
            </div>
          )}

          {/* Generated Questions Preview */}
          {aiGeneratedQuestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900">
                  Предпросмотр сгенерированных вопросов ({aiGeneratedQuestions.length} шт.):
                </span>
                <button
                  onClick={handleAddAllAiQuestions}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Добавить все {aiGeneratedQuestions.length} в SQLite БД
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {aiGeneratedQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-white border border-purple-200 rounded-lg p-3 flex items-start justify-between gap-2 text-xs shadow-2xs hover:border-purple-300"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-500">#{idx + 1}</span>
                        {q.type === 'first' ? (
                          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            ⚡ На скорость (+{q.points})
                          </span>
                        ) : (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">
                            👥 Общий (+{q.points})
                          </span>
                        )}
                        <span className="text-slate-600 font-medium">
                          Ответы: <b className="text-slate-900">{q.answers.join(', ')}</b>
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900">{q.text}</p>
                      {q.explanation && (
                        <p className="text-[11px] text-slate-500 italic">💡 {q.explanation}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleAddSingleAiQuestion(q)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 flex-shrink-0"
                      title="Добавить только этот вопрос"
                    >
                      + В базу
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- SECTION: THEMATIC PACKS (+5 IN 1 CLICK) --- */}
      {isPacksOpen && (
        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Готовые тематические наборы вопросов (1 клик для добавления в БД)
                </h3>
                <p className="text-xs text-slate-500">
                  Проверенные вопросы с точными ответами и фактами. Нажмите кнопку, чтобы мгновенно пополнить базу викторины!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPacksOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="bg-white border border-amber-200 hover:border-amber-400 rounded-xl p-3.5 flex flex-col justify-between transition-all shadow-2xs group"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold text-slate-900">{pack.name}</span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      +{pack.questions?.length || 5} вопр.
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    {pack.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleInstallPack(pack)}
                  disabled={installingPackId === pack.id}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-colors shadow-2xs"
                >
                  {installingPackId === pack.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Записываю в БД...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Добавить пак в SQLite</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- SECTION: SMART BULK PASTE --- */}
      {isBulkOpen && (
        <div className="bg-slate-900 text-slate-100 border border-slate-700 rounded-xl p-5 shadow-lg space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">
                  Умная вставка вопросов списком в SQLite БД
                </h3>
                <p className="text-xs text-slate-400">
                  Вставьте любые строки из Word, заметок, Excel или ChatGPT. Парсер автоматически определит вопрос и ответ!
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBulkOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Поддерживаемые форматы строк:</span>
              <span className="text-indigo-300 text-[11px]">
                <code>Вопрос | Ответ</code> или <code>1. Вопрос? - Ответ</code> или <code>Вопрос: ... Ответ: ...</code>
              </span>
            </div>

            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={`Пример:\nСтолица Франции? | Париж | 10\n1. Сколько планет в Солнечной системе? - 8, восемь\nВопрос: В каком году человек полетел в космос? Ответ: 1961\n⚡ Какой океан самый глубокий? | Тихий | 20`}
              rows={6}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
            />
          </div>

          {bulkNotification && (
            <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs px-3 py-2 rounded-lg font-medium">
              {bulkNotification}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-400">
              Распознано вопросов для записи в БД: <b className="text-white text-sm">{parsedBulkQuestions.length}</b>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkText(`Столица Испании? | Мадрид | 10 | общий | Крупнейший город Испании
В каком году родился Пушкин? | 1799 | 15 | общий | 6 июня 1799 года в Москве
⚡ Сколько колец на Олимпийском флаге? | 5, пять | 20 | скорость | Символизируют 5 частей света`)}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700"
              >
                Вставить образец
              </button>
              <button
                type="button"
                onClick={() => setIsBulkOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleApplyBulkImport}
                disabled={parsedBulkQuestions.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                Загрузить в БД ({parsedBulkQuestions.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SINGLE QUESTION ADD / EDIT FORM --- */}
      {(isAddingNew || editingId) && (
        <div className="bg-indigo-50/40 border-2 border-indigo-200 rounded-xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {isAddingNew ? (
                <>
                  <Plus className="w-5 h-5 text-indigo-600" /> Добавление нового вопроса в базу данных SQLite
                </>
              ) : (
                <>
                  <Edit3 className="w-5 h-5 text-indigo-600" /> Редактирование вопроса в БД
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
                  Тип начисления баллов (фишек) *
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
                      Фишки всем правильным
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
                    <span className="text-xs font-bold">2. На скорость ⚡</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Куш только первому
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Баллы за верный ответ (CasinoCoins) *
                </label>
                <div className="flex items-center gap-1.5 mb-2">
                  {[10, 15, 20, 25, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormPoints(val)}
                      className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors ${
                        formPoints === val
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={formPoints}
                  onChange={e => setFormPoints(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
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
                Пояснение крупье или интересный факт (необязательно)
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
              {isAddingNew ? '💾 Сохранить в базу данных' : '💾 Обновить в базе'}
            </button>
          </div>
        </div>
      )}

      {/* --- SEARCH & FILTER TOOLBAR --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по вопросам и ответам..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                typeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все ({questions.length})
            </button>
            <button
              onClick={() => setTypeFilter('first')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${
                typeFilter === 'first'
                  ? 'bg-amber-100 text-amber-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-600" />
              Скорость ({questions.filter(q => q.type === 'first').length})
            </button>
            <button
              onClick={() => setTypeFilter('general')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${
                typeFilter === 'general'
                  ? 'bg-indigo-100 text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3 h-3 text-indigo-600" />
              Общие ({questions.filter(q => q.type !== 'first').length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportJson}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg"
              title="Скачать вопросы в JSON формате"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button
              onClick={onResetToDefaults}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg"
              title="Восстановить исходные вопросы"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span className="hidden sm:inline">Сброс</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- QUESTIONS LIST --- */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-700">
              По запросу ничего не найдено
            </p>
            <p className="text-xs text-slate-400">
              Попробуйте изменить поисковый запрос или фильтр типа вопроса
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Сбросить фильтры
            </button>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const actualIndex = questions.findIndex(item => item.id === q.id);
            const isActive = actualIndex === currentQuestionIndex;

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
                      {actualIndex + 1}
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
                          +{q.points} фишек
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
                      onClick={() => moveQuestion(actualIndex, 'up')}
                      disabled={actualIndex === 0}
                      title="Переместить выше"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveQuestion(actualIndex, 'down')}
                      disabled={actualIndex === questions.length - 1}
                      title="Переместить ниже"
                      className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => startEdit(q)}
                      title="Редактировать в БД"
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      title="Удалить из БД"
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
