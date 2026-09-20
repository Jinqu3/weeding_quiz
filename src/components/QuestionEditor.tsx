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
  CheckSquare,
  ArrowUp,
  ArrowDown,
  Database,
  FileText,
  Download,
  RotateCcw,
  CheckCircle2,
  ClipboardPaste,
  Search,
  Package,
  Lightbulb,
  ExternalLink,
  ListOrdered,
  Loader2
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
    options?: string[];
    correctOptionIndex?: number;
    explanation?: string;
  }>;
}

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
  const [isPacksOpen, setIsPacksOpen] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'general' | 'first' | 'choice'>('all');

  // Single Question Form state
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState<QuestionType>('general');
  const [formPoints, setFormPoints] = useState<number>(10);
  const [formAnswers, setFormAnswers] = useState<string>('');
  const [formOptions, setFormOptions] = useState<string[]>(['', '', '', '']);
  const [formCorrectOptionIndex, setFormCorrectOptionIndex] = useState<number>(0);
  const [formExplanation, setFormExplanation] = useState('');
  const [error, setError] = useState('');

  // Bulk Import state
  const [bulkText, setBulkText] = useState('');
  const [bulkNotification, setBulkNotification] = useState<string | null>(null);

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
          const rawType = parts[3]?.trim().toLowerCase();
          const isChoice = rawType === 'choice' || rawType === 'выбор' || rawType === 'тест';
          const isSpeed = rawType === 'first' || rawType === 'скорость' || rawType === 'быстро';
          const type: QuestionType = isChoice ? 'choice' : isSpeed ? 'first' : 'general';

          if (isChoice) {
            // rawAns contains options separated by comma or semicolon
            const options = rawAns.split(/[,;]/).map(o => o.trim()).filter(Boolean);
            const correctOptStr = parts[2]?.trim() || '1';
            const correctIdx = Math.max(0, parseInt(correctOptStr, 10) - 1);
            const correctText = options[correctIdx] || options[0] || '';
            const correctNum = String(correctIdx + 1);

            if (options.length >= 2) {
              result.push({
                id: `bulk_${Date.now()}_${idx}`,
                text,
                type: 'choice',
                points: parts[4] ? parseInt(parts[4].trim(), 10) || 10 : 10,
                options,
                correctOptionIndex: correctIdx,
                answers: [correctNum, `${correctNum})`, correctText.toLowerCase()],
                explanation: parts[5]?.trim() || undefined
              });
              return;
            }
          }

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
          type: (q.type === 'choice' ? 'choice' : q.type === 'first' ? 'first' : 'general') as QuestionType,
          points: q.points,
          answers: q.answers,
          options: q.options ? [...q.options] : undefined,
          correctOptionIndex: q.correctOptionIndex,
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
    setFormType(q.type || 'general');
    setFormPoints(q.points);
    setFormAnswers(q.answers.join(', '));
    setFormExplanation(q.explanation || '');
    if (q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0) {
      setFormOptions(q.options.length >= 2 ? [...q.options] : [...q.options, '', '']);
      setFormCorrectOptionIndex(typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0);
    } else {
      setFormOptions(['', '', '', '']);
      setFormCorrectOptionIndex(0);
    }
    setError('');
  };

  const startNew = (preferredType: QuestionType = 'general') => {
    setIsAddingNew(true);
    setEditingId(null);
    setFormText('');
    setFormType(preferredType);
    setFormPoints(10);
    setFormAnswers('');
    setFormExplanation('');
    setFormOptions(['', '', '', '']);
    setFormCorrectOptionIndex(0);
    setError('');
  };

  const cancelForm = () => {
    setIsAddingNew(false);
    setEditingId(null);
    setError('');
  };

  const handleAddOption = () => {
    if (formOptions.length < 6) {
      setFormOptions([...formOptions, '']);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (formOptions.length <= 2) return;
    const next = formOptions.filter((_, i) => i !== index);
    setFormOptions(next);
    if (formCorrectOptionIndex >= next.length) {
      setFormCorrectOptionIndex(next.length - 1);
    }
  };

  const handleOptionChange = (index: number, val: string) => {
    const next = [...formOptions];
    next[index] = val;
    setFormOptions(next);
  };

  const saveQuestion = () => {
    if (!formText.trim()) {
      setError('Введите текст вопроса');
      return;
    }

    let answersList = formAnswers
      .split(',')
      .map(a => a.trim().toLowerCase())
      .filter(Boolean);

    let optionsList: string[] | undefined = undefined;
    let correctIdx: number | undefined = undefined;

    if (formType === 'choice') {
      const validOptions = formOptions.map(o => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setError('Для вопроса с выбором ответа укажите как минимум 2 непустых варианта');
        return;
      }
      optionsList = validOptions;
      correctIdx = Math.max(0, Math.min(validOptions.length - 1, formCorrectOptionIndex));
      const correctNum = String(correctIdx + 1);
      const correctText = validOptions[correctIdx].toLowerCase();

      // Автоматически гарантируем, что номер правильного варианта (1, 2, 3...) есть в ответах
      if (answersList.length === 0) {
        answersList = [correctNum, `${correctNum})`, correctText];
      } else {
        if (!answersList.includes(correctNum)) {
          answersList.unshift(correctNum);
        }
      }
    } else {
      if (answersList.length === 0) {
        setError('Укажите хотя бы один правильный вариант ответа через запятую');
        return;
      }
    }

    if (isAddingNew) {
      const newQuestion: Question = {
        id: 'q_' + Date.now(),
        text: formText.trim(),
        type: formType,
        points: Number(formPoints) || 10,
        answers: answersList,
        options: optionsList,
        correctOptionIndex: correctIdx,
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
            options: optionsList,
            correctOptionIndex: correctIdx,
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
        (typeFilter === 'general' && q.type === 'general') ||
        (typeFilter === 'choice' && q.type === 'choice');

      if (!matchesType) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      const inText = q.text.toLowerCase().includes(query);
      const inAnswers = q.answers.some(a => a.toLowerCase().includes(query));
      const inOptions = q.options ? q.options.some(o => o.toLowerCase().includes(query)) : false;
      const inExplanation = q.explanation ? q.explanation.toLowerCase().includes(query) : false;

      return inText || inAnswers || inOptions || inExplanation;
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

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Добавить вопрос с выбором варианта */}
          <button
            onClick={() => startNew('choice')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="Создать вопрос с 4 вариантами ответа"
          >
            <ListOrdered className="w-3.5 h-3.5 text-purple-600" />
            <span>+ Тест (выбор 1-4)</span>
          </button>

          {/* 2. Готовые паки тем */}
          <button
            onClick={() => {
              setIsPacksOpen(!isPacksOpen);
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
            onClick={() => startNew('general')}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Тип вопроса и проверка ответа *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('general')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                      formType === 'general'
                        ? 'border-indigo-600 bg-white shadow-xs text-indigo-700 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Users className="w-4 h-4 mb-1 text-indigo-500" />
                    <span className="text-xs font-bold">1. Общий</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Баллы всем
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('first')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                      formType === 'first'
                        ? 'border-amber-500 bg-white shadow-xs text-amber-800 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <Zap className="w-4 h-4 mb-1 text-amber-500" />
                    <span className="text-xs font-bold">2. Скорость ⚡</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Куш первому
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('choice')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all ${
                      formType === 'choice'
                        ? 'border-purple-600 bg-white shadow-xs text-purple-800 ring-2 ring-purple-500/20'
                        : 'border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <ListOrdered className="w-4 h-4 mb-1 text-purple-600" />
                    <span className="text-xs font-bold">3. С выбором 🔘</span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Варианты 1, 2, 3..
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Баллы за ответ (CasinoCoins) *
                </label>
                <div className="flex items-center gap-1.5 mb-2">
                  {[10, 15, 20, 25, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormPoints(val)}
                      className={`text-xs px-2 py-1 rounded-md font-bold transition-colors ${
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

            {/* Блок вариантов ответов для типа 'choice' */}
            {formType === 'choice' && (
              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-xs font-bold text-purple-950 uppercase tracking-wider">
                    🔘 Варианты ответов (игроки вводят цифру 1, 2, 3... или нажимают кнопку) *
                  </label>
                  <span className="text-[11px] text-purple-700 font-medium">
                    Нажмите на кружок слева от правильного варианта
                  </span>
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormCorrectOptionIndex(oIdx)}
                        className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                          formCorrectOptionIndex === oIdx
                            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400'
                            : 'bg-white text-slate-600 border border-slate-300 hover:border-slate-400'
                        }`}
                        title="Сделать этот вариант правильным ответом"
                      >
                        {formCorrectOptionIndex === oIdx ? '✓' : oIdx + 1}
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={opt}
                          onChange={e => handleOptionChange(oIdx, e.target.value)}
                          placeholder={`Вариант ${oIdx + 1} (например: ${oIdx === 0 ? 'Париж' : oIdx === 1 ? 'Лондон' : oIdx === 2 ? 'Рим' : 'Берлин'})`}
                          className={`w-full bg-white rounded-lg px-3 py-2 text-xs font-medium border focus:outline-none focus:ring-2 ${
                            formCorrectOptionIndex === oIdx
                              ? 'border-emerald-400 ring-1 ring-emerald-300'
                              : 'border-slate-300 focus:ring-purple-500'
                          }`}
                        />
                        {formCorrectOptionIndex === oIdx && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            ВЕРНЫЙ ОТВЕТ
                          </span>
                        )}
                      </div>
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(oIdx)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 rounded"
                          title="Удалить вариант"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  {formOptions.length < 6 ? (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Добавить ещё вариант
                    </button>
                  ) : <span />}
                  <span className="text-[11px] text-slate-500">
                    Бот примет и номер (<b>{formCorrectOptionIndex + 1}</b>), и текст ответа.
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                {formType === 'choice'
                  ? 'Дополнительные синонимы правильного ответа (необязательно)'
                  : 'Варианты правильного ответа (через запятую) *'}
              </label>
              <input
                type="text"
                value={formAnswers}
                onChange={e => setFormAnswers(e.target.value)}
                placeholder={formType === 'choice' ? `Автоматически: ${formCorrectOptionIndex + 1}, ${formOptions[formCorrectOptionIndex] || ''}` : 'меркурий, mercury, планета меркурий'}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {formType === 'choice'
                  ? 'По умолчанию игроки могут вводить цифру варианта (1, 2, 3...) или нажимать кнопку в Telegram.'
                  : 'Бот автоматически убирает лишние пробелы и игнорирует регистр букв (большие/маленькие).'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                Пояснение ведущего или интересный факт (необязательно)
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
            placeholder="Поиск по вопросам, ответам и вариантам..."
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
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 flex-wrap">
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
              onClick={() => setTypeFilter('choice')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ${
                typeFilter === 'choice'
                  ? 'bg-purple-100 text-purple-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListOrdered className="w-3 h-3 text-purple-600" />
              С выбором ({questions.filter(q => q.type === 'choice').length})
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
              Общие ({questions.filter(q => q.type === 'general' || (!q.type && q.type !== 'first' && q.type !== 'choice')).length})
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
          filteredQuestions.map((q) => {
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
                  <div className="flex items-start gap-3 flex-1">
                    <span className="flex-shrink-0 w-7 h-7 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center font-bold text-xs">
                      {actualIndex + 1}
                    </span>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {q.type === 'choice' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                            <ListOrdered className="w-3 h-3 text-purple-600" /> С выбором (варианты 1, 2, 3...)
                          </span>
                        ) : q.type === 'first' ? (
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
                      
                      {/* Если это вопрос с выбором варианта — показываем интерактивный список вариантов */}
                      {q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = typeof q.correctOptionIndex === 'number'
                              ? q.correctOptionIndex === oIdx
                              : q.answers.some(a => a === String(oIdx + 1) || a.toLowerCase() === opt.toLowerCase());
                            return (
                              <div
                                key={oIdx}
                                className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 ${
                                  isCorrect
                                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 font-normal'
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                  }`}>
                                    {oIdx + 1}
                                  </span>
                                  <span>{opt}</span>
                                </span>
                                {isCorrect && (
                                  <span className="text-[10px] font-bold text-emerald-700 uppercase">
                                    Верный ✓
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-slate-400 font-medium">
                          {q.type === 'choice' ? 'Ответы для бота:' : 'Ответы:'}
                        </span>
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
                        <p className="mt-1 text-xs text-slate-500 italic">
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
