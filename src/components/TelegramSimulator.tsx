import { useState, useRef, useEffect } from 'react';
import { Question, SimUser, UserScore, ChatMessage } from '../types';
import { SIM_USERS } from '../data/mockData';
import { Send, Trophy, ArrowRight, RotateCcw, HelpCircle, Bot as BotIcon, Zap, Users, Sparkles, CheckCircle2, Award } from 'lucide-react';

interface TelegramSimulatorProps {
  questions: Question[];
  currentQuestionIndex: number;
  onSetCurrentQuestionIndex: (idx: number) => void;
  scores: Record<string, UserScore>;
  onUpdateScores: (scores: Record<string, UserScore>) => void;
  onResetQuiz: () => void;
  registeredUserIds: string[];
  onSetRegisteredUserIds: React.Dispatch<React.SetStateAction<string[]>>;
}

const GENERAL_JOKES = [
  '🎰 Казна казино нервно задрожала, а ваши карманы потяжелели!',
  '🃏 Крупье уже вытирает холодный пот со лба! Отличный выстрел!',
  '🧠 Эйнштейн одобрительно кивает, а казино готовится к банкротству!',
  '🪙 Дзынь-дзынь! Фишечки полетели прямиком в ваш банкролл.',
  '🥂 Красиво ворвался! На эти фишки уже можно шикануть у рулетки.',
  '🎩 Интеллект 100-го уровня! Бармен наливает вам виртуальный коктейль за счёт заведения.'
];

const SPEED_JOKES = [
  '🏎️💨 Флэш нервно курит в углу! Ты сорвал весь куш раунда!',
  '⚡ Пальцы быстрее скорости звука! Крупье не успел даже моргнуть, а фишки уже твои!',
  '🤑 Остальные участники ещё шевелили губами, читая вопрос, а ты уже грабишь казино!',
  '👑 Реакция мангуста! Главный претендент на золотой VIP-стол в казино!',
  '🎯 Прямо в яблочко и первым! Остальным участникам остаётся только завидовать твоему банкроллу.'
];

const LATE_JOKES = [
  'Увы! Первый куш уже сорван другим счастливчиком. В казино слоупоков не кредитуют! 🐌',
  'Опоздал на долю секунды! Крупье уже закрыл ставки и унёс фишки первому победителю 🚪',
  'Ответ верный, но фортуна и скорость сегодня у другого. Тренируй пальцы к следующему раунду! ⏱️',
  'Ставки сделаны, ставок больше нет! Весь банк забрал самый быстрый стрелок Дикого Запада 🤠'
];

const WRONG_JOKES = [
  'Мимо рулетки! Шарик предательски упал на зеро — фишки уходят казино! 💸',
  'Ставка не зашла! Крупье с улыбкой сгребает ставки лопаткой 🎲',
  'Интуиция взяла перекур! Но в казино главное — не унывать, впереди новые раунды! 🃏',
  'Блеф не удался! Мимо кассы, зато какая смелая попытка! 🎰',
  'Бармен сочувственно качает головой и наливает воды со льдом 🍸'
];

const RANK_TITLES = [
  '👑 Олигарх вечера / Владелец казино',
  '🎩 VIP-хайроллер с полными карманами',
  '🎲 Опытный игрок, чует удачу за версту',
  '🪙 Перспективный лудоман',
  '📉 Срочно требуется микрозайм'
];

export function TelegramSimulator({
  questions,
  currentQuestionIndex,
  onSetCurrentQuestionIndex,
  scores,
  onUpdateScores,
  onResetQuiz,
  registeredUserIds,
  onSetRegisteredUserIds: setRegisteredUserIds
}: TelegramSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg_welcome',
      senderId: 'bot',
      senderName: 'QuizBot',
      senderUsername: 'quiz_master_bot',
      avatarBg: 'bg-indigo-600',
      avatarText: '🤖',
      isBot: true,
      timestamp: '12:00',
      badge: 'bot',
      type: 'system',
      text: `👋 <b>Добро пожаловать в Интеллектуальное Казино!</b> 🎰🎲\n\nЯ чат-бот на <b>aiogram 3</b>, где ваш ум конвертируется в реальные фишки!\n\n💰 <b>КУРС ВАЛЮТЫ:</b>\n1 очко = <b>1 CasinoCoin (🪙 Фишка Казино)</b>!\nВсе заработанные баллы мы подсчитаем в конце и <b>выдадим вам на руки фишками</b> для игры в рулетку и блэкджек! 🃏✨\n\n🚨 <b>ОБЯЗАТЕЛЬНОЕ ПРАВИЛО:</b>\nКаждый участник должен отправить команду <b>/join</b>, чтобы войти в игру! Игроки остаются за столом до завершения всех вопросов викторины.\n\n⚡ <b>ВОПРОС НА СКОРОСТЬ:</b>\nКак только поступает первый правильный ответ — вопрос сразу завершается, ждать остальных не нужно!\n\n🌟 <b>ОБЩИЙ ВОПРОС:</b>\nСтавки держатся в тайне, пока не ответят все игроки за столом, после чего объявляется верный ответ.\n\n👉 Нажмите <b>/join</b> или отправьте <b>/next</b>!`
    }
  ]);

  const [activeUser, setActiveUser] = useState<SimUser>(SIM_USERS[0]);
  const [inputValue, setInputValue] = useState('');
  const [attemptedUserIds, setAttemptedUserIds] = useState<string[]>([]);
  const [roundCorrectUserIds, setRoundCorrectUserIds] = useState<string[]>([]);
  const [answeredUserIds, setAnsweredUserIds] = useState<string[]>([]);
  const [firstWinnerId, setFirstWinnerId] = useState<string | null>(null);
  const [isRoundClosed, setIsRoundClosed] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [showScoresSidebar, setShowScoresSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isBotTyping]);

  const getCurrentTimeString = () => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentQuestion = currentQuestionIndex >= 0 && currentQuestionIndex < questions.length
    ? questions[currentQuestionIndex]
    : null;

  // Bot response helper
  const addBotMessage = (
    text: string,
    type: ChatMessage['type'] = 'text',
    awardedPoints?: number
  ) => {
    setIsBotTyping(true);
    setTimeout(() => {
      setIsBotTyping(false);
      setMessages(prev => [
        ...prev,
        {
          id: 'bot_' + Date.now() + Math.random(),
          senderId: 'bot',
          senderName: 'QuizBot',
          senderUsername: 'quiz_master_bot',
          avatarBg: 'bg-indigo-600',
          avatarText: '🤖',
          isBot: true,
          timestamp: getCurrentTimeString(),
          badge: 'bot',
          text,
          type,
          awardedPoints
        }
      ]);
    }, 450);
  };

  // User sends a message (either a command or an answer)
  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputValue).trim();
    if (!text) return;

    if (!textToSend) {
      setInputValue('');
    }

    const newMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      senderId: activeUser.id,
      senderName: activeUser.name,
      senderUsername: activeUser.username,
      avatarBg: activeUser.avatarBg,
      avatarText: activeUser.avatarText,
      isBot: false,
      timestamp: getCurrentTimeString(),
      text
    };

    setMessages(prev => [...prev, newMsg]);

    // Handle commands
    if (text.startsWith('/')) {
      handleCommand(text.toLowerCase());
      return;
    }

    // Handle plain text 'рулетка'
    if (['рулетка', 'spin', 'крутить'].includes(text.toLowerCase())) {
      handleCommand('/roulette');
      return;
    }

    // Handle answer to question
    handleAnswerAttempt(text);
  };

  const handleCommand = (cmd: string) => {
    if (cmd === '/join' || cmd === '/play' || cmd === '/reg') {
      if (registeredUserIds.includes(activeUser.id)) {
        addBotMessage(
          `🎲 <b>${activeUser.name}</b>, вы уже сидите за игровым столом! Ждите следующий вопрос.`
        );
        return;
      }
      const nextReg = [...registeredUserIds, activeUser.id];
      setRegisteredUserIds(nextReg);
      const userPoints = scores[activeUser.id]?.points || 0;
      addBotMessage(
        `✅ <b>${activeUser.name} успешно вступил в игру!</b> 🎰\n` +
        `За игровым столом участников: <b>${nextReg.length}</b>.\n` +
        (userPoints > 0 ? `💰 Ваш сохранённый банкролл: <b>${userPoints} CasinoCoins 🪙</b>!\n` : '') +
        `Теперь ваши ответы будут учитываться, а очки пойдут в банкролл фишек!\n` +
        `🪑 <i>Вы остаетесь за столом на все последующие вопросы викторины (для выхода используйте /leave)!</i>`
      );
      return;
    }

    if (cmd === '/leave' || cmd === '/exit' || cmd === '/выйти' || cmd === '/выход') {
      if (!registeredUserIds.includes(activeUser.id)) {
        addBotMessage(
          `⚠️ <b>${activeUser.name}</b>, вы сейчас не за игровым столом!\nОтправьте команду <b>/join</b>, чтобы войти в игру.`
        );
        return;
      }

      const nextReg = registeredUserIds.filter(id => id !== activeUser.id);
      setRegisteredUserIds(nextReg);

      const userPoints = scores[activeUser.id]?.points || 0;
      addBotMessage(
        `🚪 <b>${activeUser.name} покинул(а) игровой стол!</b>\n\n` +
        `💰 <b>Ваши очки в сохранности:</b> ${userPoints} CasinoCoins 🪙!\n` +
        `👥 За столом осталось участников: <b>${nextReg.length}</b>.\n` +
        `<i>Вы можете вернуться за игровой стол в любой момент по команде <b>/join</b> с сохранением всех накопленных фишек!</i>`
      );

      // Если в данный момент открыт общий раунд и все оставшиеся игроки уже ответили — завершаем вопрос
      if (
        currentQuestion &&
        !isRoundClosed &&
        currentQuestion.type === 'general' &&
        nextReg.length > 0 &&
        nextReg.every(id => attemptedUserIds.includes(id))
      ) {
        setIsRoundClosed(true);
        setTimeout(() => {
          const correctSample = currentQuestion.answers[0] || '';
          const expl = currentQuestion.explanation ? `\n💡 <i>${currentQuestion.explanation}</i>` : '';
          const points = currentQuestion.points;

          let resultText = `🎯 <b>Правильный ответ:</b> <b>${correctSample}</b>${expl}\n\n`;
          if (roundCorrectUserIds.length > 0) {
            let updatedScores = { ...scores };
            resultText += `🏆 <b>ПРАВИЛЬНО ОТВЕТИЛИ И ПОЛУЧАЮТ ФИШКИ:</b>\n`;
            roundCorrectUserIds.forEach(uid => {
              const userObj = SIM_USERS.find(u => u.id === uid) || { name: 'Игрок', username: 'player' };
              const prevScore = updatedScores[uid] || {
                userId: uid,
                name: userObj.name,
                username: userObj.username,
                points: 0,
                correctAnswersCount: 0,
                firstPlaceCount: 0
              };
              const newPoints = prevScore.points + points;
              updatedScores[uid] = {
                ...prevScore,
                points: newPoints,
                correctAnswersCount: prevScore.correctAnswersCount + 1
              };
              resultText += `• 👤 <b>${userObj.name}</b>: +${points} CasinoCoins 🪙 (Баланс: <b>${newPoints} фишек</b>)\n`;
            });
            onUpdateScores(updatedScores);
            setAnsweredUserIds(roundCorrectUserIds);
            const generalJoke = GENERAL_JOKES[Math.floor(Math.random() * GENERAL_JOKES.length)];
            resultText += `\n${generalJoke}\n`;
          } else {
            const wrongJoke = WRONG_JOKES[Math.floor(Math.random() * WRONG_JOKES.length)];
            resultText += `💨 <b>Никто из оставшихся за столом не угадал!</b>\nКрупье сметает все фишки себе в банк! 🧹\n${wrongJoke}\n`;
          }
          resultText += `\n👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>`;
          addBotMessage(resultText, roundCorrectUserIds.length > 0 ? 'correct' : 'wrong', points);
        }, 600);
      }
      return;
    }

    if (cmd === '/players') {
      if (registeredUserIds.length === 0) {
        addBotMessage(
          `🪑 За игровым столом пока никого нет!\nОтправьте команду <b>/join</b>, чтобы вступить в викторину!`
        );
        return;
      }
      const lines = [`👥 <b>Игроки за столом (${registeredUserIds.length} чел.):</b>\n<i>(Для выхода из-за стола с сохранением очков используйте /leave)</i>\n`];
      registeredUserIds.forEach((uid, idx) => {
        const u = SIM_USERS.find(sim => sim.id === uid) || { name: 'Игрок', username: 'user' };
        const pt = scores[uid]?.points || 0;
        lines.push(`${idx + 1}. <b>${u.name}</b> (@${u.username}) — ${pt} 🪙`);
      });
      addBotMessage(lines.join('\n'));
      return;
    }

    if (cmd === '/next') {
      if (registeredUserIds.length === 0) {
        addBotMessage(
          `⚠️ <b>За столом нет зарегистрированных игроков!</b>\n\nПусть участники напишут команду <b>/join</b>, чтобы бот мог отслеживать их ответы!`
        );
        return;
      }

      const nextIdx = currentQuestionIndex + 1;
      if (nextIdx >= questions.length) {
        onSetCurrentQuestionIndex(nextIdx);
        setIsRoundClosed(true);
        addBotMessage(
          `🏁 <b>Все вопросы викторины завершены!</b> 🎰\n\nИгровой стол закрывается! Все игроки оставались за столом до самого конца викторины.\nВремя подводить итоги и получать фишки для казино! 🪙✨\n\nОтправьте команду <b>/stat</b>, чтобы увидеть финальный баланс фишек каждого игрока! 🏆\n\n<i>Для сброса и начала новой игры крупье может отправить <b>/reset</b>.</i>`
        );
        return;
      }

      onSetCurrentQuestionIndex(nextIdx);
      setIsRoundClosed(false);
      setAttemptedUserIds([]);
      setRoundCorrectUserIds([]);
      setAnsweredUserIds([]);
      setFirstWinnerId(null);

      const q = questions[nextIdx];
      const isChoice = q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0;
      const isSpeed = q.type === 'first';

      let badge = '🌟 <b>ОБЩИЙ РАУНД</b> (Фишки каждому правильному)';
      if (isChoice) {
        badge = '🔘 <b>ВОПРОС С ВЫБОРОМ ВАРИАНТА</b> (Тест)';
      } else if (isSpeed) {
        badge = '⚡ <b>РАУНД НА СКОРОСТЬ!</b> (Куш заберёт первый правильный ответ!)';
      }

      const reward = isSpeed
        ? `+${q.points} CasinoCoins 🪙 первому правильному`
        : `+${q.points} CasinoCoins 🪙 каждому`;

      let optionsBlock = '';
      if (isChoice && q.options) {
        const optionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        optionsBlock = '\n\n' + q.options.map((opt, idx) => `${optionEmojis[idx] || `${idx + 1}.`} <b>${opt}</b>`).join('\n');
      }

      const instruction = isChoice
        ? `🔘 <i>Тест с вариантами: отправьте цифру (1, 2, 3...) прямо в чат или нажмите кнопку варианта! Ждём скрытых ответов всех ${registeredUserIds.length} игроков за столом.</i>`
        : isSpeed
        ? '⚡ <i>Вопрос на скорость: как только поступит ПЕРВЫЙ правильный ответ — вопрос сразу завершается, ждать остальных не нужно!</i>'
        : `👥 <i>Общий раунд: ждём скрытых ставок от всех <b>${registeredUserIds.length}</b> игроков за столом, затем огласим верный ответ!</i>`;

      const botText = `━━━━━━━━━━━━━━━━━━━━\n❓ <b>Вопрос ${nextIdx + 1} из ${questions.length}</b>\n${badge}\n\n<b>${q.text}</b>${optionsBlock}\n\n💰 <i>На кону: ${reward}</i>\n🪑 <i>Игроки за столом (${registeredUserIds.length} чел.): остаются до завершения всех вопросов</i>\n${instruction}\n✍️ <i>Пишите ваш ответ прямо в чат!</i>\n━━━━━━━━━━━━━━━━━━━━`;
      addBotMessage(botText, 'question');
      return;
    }

    if (cmd === '/stat') {
      const allKnownIds = Array.from(new Set([...registeredUserIds, ...Object.keys(scores)]));
      if (allKnownIds.length === 0) {
        addBotMessage(
          `📊 В кассе пока пусто — никто ещё не вступил в игру через /join! 🎰`
        );
        return;
      }

      const allScores = allKnownIds.map(uid => {
        const sim = SIM_USERS.find(s => s.id === uid);
        return (
          scores[uid] || {
            userId: uid,
            name: sim?.name || 'Игрок',
            username: sim?.username || 'user',
            points: 0,
            correctAnswersCount: 0,
            firstPlaceCount: 0
          }
        );
      });

      const sorted = [...allScores].sort(
        (a, b) => b.points - a.points || b.correctAnswersCount - a.correctAnswersCount
      );
      const medals = ['🥇', '🥈', '🥉'];
      const lines = [
        '🎰 <b>БАЛАНС ФИШЕК ДЛЯ КАЗИНО (ТАБЛИЦА ЛИДЕРОВ):</b>\n',
        '<i>Курс: 1 очко = 1 CasinoCoin 🪙 для игры в рулетку и блэкджек</i>\n'
      ];

      sorted.forEach((u, i) => {
        const medal = medals[i] || `${i + 1}.`;
        const title = RANK_TITLES[Math.min(i, RANK_TITLES.length - 1)];
        const isAtTable = registeredUserIds.includes(u.userId);
        const statusBadge = isAtTable ? ' <i>(за столом)</i>' : ' <i>(вышел, очки сохранены)</i>';
        lines.push(
          `${medal} <b>${u.name}</b> (@${u.username})${statusBadge}\n` +
          `   💰 Банкролл: <b>${u.points} CasinoCoins 🪙</b> <i>(${title})</i>\n` +
          `   📊 Верных: ${u.correctAnswersCount} | Скоростных: ${u.firstPlaceCount}\n`
        );
      });

      const totalPool = sorted.reduce((sum, u) => sum + u.points, 0);
      lines.push(
        `🎲 <i>Общий банкролл игроков: ${totalPool} фишек. Очки сохраняются при выходе из-за стола (/leave) и обмениваются у крупье перед игрой! Всё на красное! 🚀</i>`
      );
      addBotMessage(lines.join('\n'), 'stat');
      return;
    }

    if (cmd === '/current') {
      if (!currentQuestion) {
        addBotMessage('Сейчас нет активного вопроса. Напишите <b>/next</b>, чтобы запустить раунд.');
        return;
      }
      const typeLabel = currentQuestion.type === 'first'
        ? '⚡ На скорость'
        : currentQuestion.type === 'choice'
        ? '🔘 С выбором ответа'
        : '🌟 Общий';

      if (isRoundClosed || (currentQuestion.type === 'first' && firstWinnerId)) {
        const winnerName = firstWinnerId ? SIM_USERS.find(s => s.id === firstWinnerId)?.name : null;
        let correctSample = currentQuestion.answers[0];
        if (currentQuestion.type === 'choice' && currentQuestion.options) {
          const cIdx = currentQuestion.correctOptionIndex ?? 0;
          correctSample = `Вариант ${cIdx + 1}: ${currentQuestion.options[cIdx] || ''}`;
        }

        addBotMessage(
          `🛑 <b>Вопрос №${currentQuestionIndex + 1} (${typeLabel}) ЗАКРЫТ!</b> 🏁\n\n` +
          `<b>${currentQuestion.text}</b>\n\n` +
          (winnerName ? `🏆 Победитель раунда на скорость: <b>${winnerName}</b>!\n` : '') +
          `🎯 Правильный ответ: <b>${correctSample}</b>\n\n` +
          `✅ <i>Ожидание остановлено, вопрос закрыт. Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>`
        );
        return;
      }

      let optionsListText = '';
      if (currentQuestion.type === 'choice' && currentQuestion.options) {
        const optionEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        optionsListText = '\n\n' + currentQuestion.options.map((opt, i) => `${optionEmojis[i] || `${i + 1}.`} <b>${opt}</b>`).join('\n');
      }

      if (currentQuestion.type === 'first') {
        addBotMessage(
          `⚡ <b>Текущий вопрос №${currentQuestionIndex + 1} (На скорость)</b>:\n\n` +
          `<b>${currentQuestion.text}</b>\n\n` +
          `💰 На кону: +${currentQuestion.points} CasinoCoins 🪙\n` +
          `🏁 <i>Гонка за куш продолжается! Как только поступит ПЕРВЫЙ верный ответ — вопрос сразу закроется без ожидания других!</i>`
        );
        return;
      }

      const waiting = registeredUserIds
        .filter(uid => !attemptedUserIds.includes(uid))
        .map(uid => SIM_USERS.find(s => s.id === uid)?.name || uid);
      const waitingText = waiting.length > 0 ? waiting.join(', ') : 'Все ответили!';

      addBotMessage(
        `🎲 <b>Текущий вопрос №${currentQuestionIndex + 1} (${typeLabel})</b>:\n\n<b>${currentQuestion.text}</b>${optionsListText}\n\n💰 На кону: +${currentQuestion.points} фишек (CasinoCoins 🪙)\n📊 Ставок принято: <b>${attemptedUserIds.length} из ${registeredUserIds.length}</b>\n⏳ Ждём ставки: <i>${waitingText}</i>`
      );
      return;
    }

    if (cmd === '/reset') {
      onResetQuiz();
      setRegisteredUserIds([]);
      setAttemptedUserIds([]);
      setRoundCorrectUserIds([]);
      setAnsweredUserIds([]);
      setFirstWinnerId(null);
      setIsRoundClosed(false);
      addBotMessage('🔄 <b>Казино обнулило счетчики!</b>\nВсе фишки аннулированы, регистрация сброшена. Участники могут нажать <b>/join</b>, а крупье — <b>/next</b>!');
      return;
    }

    if (cmd === '/roulette' || cmd === '/spin' || cmd === '/рулетка') {
      if (!registeredUserIds.includes(activeUser.id)) {
        addBotMessage(
          `⚠️ <b>${activeUser.name}</b>, вы ещё не за игровым столом!\nСначала отправьте команду <b>/join</b>, чтобы вступить в викторину и заработать фишки!`,
          'system'
        );
        return;
      }

      const userScore = scores[activeUser.id] || {
        userId: activeUser.id,
        name: activeUser.name,
        username: activeUser.username,
        points: 0,
        correctAnswersCount: 0,
        firstPlaceCount: 0
      };

      const currentPoints = userScore.points;

      if (currentPoints <= 0) {
        addBotMessage(
          `🚫 <b>${activeUser.name}</b>, ваш банкролл: <b>0 фишек</b> (CasinoCoins 🪙)!\n\nКазино в долг не кредитует, а под честное слово фишки на рулетку не ставятся! 🙅‍♂️\nСначала заработайте баллы правильными ответами по команде <b>/next</b>! 📚`,
          'system'
        );
        return;
      }

      // Хитрый мультипликатор: взвешенное распределение, в ~86% уводящее в убыток или зеро
      const weightedConfig = [
        { mult: 0.0, weight: 14.0 }, // Сектор ЗЕРО: 14% шанс полного обнуления
        { mult: 0.1, weight: 12.0 }, // -90%
        { mult: 0.2, weight: 10.0 }, // -80%
        { mult: 0.3, weight: 10.0 }, // -70%
        { mult: 0.4, weight: 9.0 },  // -60%
        { mult: 0.5, weight: 9.0 },  // -50%
        { mult: 0.6, weight: 7.0 },  // -40%
        { mult: 0.7, weight: 6.0 },  // -30%
        { mult: 0.8, weight: 5.0 },  // -20%
        { mult: 0.9, weight: 4.0 },  // -10%
        // Суммарный убыток (< 1.0): 86%
        { mult: 1.0, weight: 5.0 },  // Ничья: 5%
        // Прибыль (> 1.0): всего ~9%
        { mult: 1.1, weight: 2.0 },
        { mult: 1.2, weight: 1.8 },
        { mult: 1.3, weight: 1.5 },
        { mult: 1.4, weight: 1.2 },
        { mult: 1.5, weight: 1.0 },
        { mult: 1.6, weight: 0.6 },
        { mult: 1.7, weight: 0.4 },
        { mult: 1.8, weight: 0.3 },
        { mult: 1.9, weight: 0.15 },
        { mult: 2.0, weight: 0.05 }, // Джекпот x2: 0.05%
      ];

      const totalWeight = weightedConfig.reduce((acc, item) => acc + item.weight, 0);
      let randomVal = Math.random() * totalWeight;
      let selectedItem = weightedConfig[0];
      for (const item of weightedConfig) {
        if (randomVal <= item.weight) {
          selectedItem = item;
          break;
        }
        randomVal -= item.weight;
      }

      const mult = selectedItem.mult;
      const newPoints = Math.round(currentPoints * mult);
      const diff = newPoints - currentPoints;

      // Update state
      const updatedScores = {
        ...scores,
        [activeUser.id]: {
          ...userScore,
          points: newPoints
        }
      };
      onUpdateScores(updatedScores);

      const zeroJokes = [
        "💀 ЗЕРО! Шарик предательски запрыгнул в зелёный сектор! Все фишки сгорели дотла! Крупье сочувственно улыбается и сметает банк лопаткой 🧹",
        "💸 Полное обнуление! Фортуна сегодня отвернулась и ушла пить кофе. Баланс 0 фишек! 💨",
        "🧲 Невидимый магнит под зеленым сукном стола сработал безукоризненно! Казино не победить 🎩"
      ];
      const lossJokes = [
        "📉 Хитрый стол казино забрал своё! Множитель меньше единицы — банкролл заметно похудел 🏛️",
        "😬 Меньше единицы — казино всегда в плюсе! Но часть фишек уцелела, держитесь! 🪙",
        "🎲 Крупье незаметно подмигнул и подкрутил колесо! Легкий минус — это инвестиция в опыт 🧹",
        "📉 Коварная гравитация заведения засосала часть фишек в фонд золотых унитазов 💸"
      ];
      const winJokes = [
        "📈 Куш в кармане! Невероятно, но вам удалось перехитрить хитрое колесо казино! 💰",
        "✨ Охрана заведения напряглась: кто-то уносит прибыль вопреки теории вероятностей! 🥂🚨",
        "🎩 Настоящий хайроллер! Колесо фортуны дрогнуло и выдало плюс! 🎰"
      ];

      let outcome = '';
      if (mult === 0.0) {
        const joke = zeroJokes[Math.floor(Math.random() * zeroJokes.length)];
        outcome = `💥 <b>ПОЛНЫЙ КРАХ! СЕКТОР ЗЕРО (x0.0)!</b>\nВсе ваши <b>${currentPoints}</b> фишек сгорели дотла! 😱\nНовый банкролл: <b>0 CasinoCoins 🪙</b>\n\n${joke}`;
      } else if (mult < 1.0) {
        const joke = lossJokes[Math.floor(Math.random() * lossJokes.length)];
        outcome = `📉 <b>УБЫТОК:</b> множитель <b>x${mult.toFixed(1)}</b>\nПотеряно: <b>-${Math.abs(diff)}</b> фишек.\nОсталось в кармане: <b>${newPoints} CasinoCoins 🪙</b>\n\n${joke}`;
      } else if (mult === 1.0) {
        outcome = `🔄 <b>НИЧЬЯ С КАЗИНО:</b> множитель <b>x1.0</b>\nВаши <b>${currentPoints}</b> фишек вернулись без изменений!\nКрупье со вздохом протёр стол тряпочкой 🍸`;
      } else if (mult === 2.0) {
        outcome = `🔥🎉 <b>ДЖЕКПОТ! МАКСИМАЛЬНЫЙ КУШ x2.0!</b> 🚀\nЧудо на 0.05%! Вы удвоили весь банк! Прибыль: <b>+${diff}</b> фишек! 🤑\nНовый банкролл: <b>${newPoints} CasinoCoins 🪙</b>!\nВладелец казино нервно пьёт валидол! 💥👑`;
      } else {
        const joke = winJokes[Math.floor(Math.random() * winJokes.length)];
        outcome = `💰📈 <b>ПОБЕДА:</b> множитель <b>x${mult.toFixed(1)}</b>!\nЧистая прибыль: <b>+${diff}</b> фишек!\nНовый банкролл: <b>${newPoints} CasinoCoins 🪙</b>!\n\n${joke}`;
      }

      addBotMessage(
        `🎰 <b>ХИТРАЯ РУЛЕТКА: СТАВКА ВА-БАНК!</b> 🔴⚫🟢\n👤 Игрок: <b>${activeUser.name}</b>\n💰 Ставка: <b>${currentPoints} CasinoCoins 🪙 (ВСЕ ОЧКИ!)</b>\n\n🎡 <i>Шарик с треском крутится по колесу рулетки...</i>\n🎯 <b>Выпавший мультипликатор: x${mult.toFixed(1)}</b>\n\n${outcome}`,
        mult >= 1.0 ? 'correct' : 'wrong'
      );
      return;
    }

    if (cmd === '/start') {
      addBotMessage(
        `👋 <b>Добро пожаловать в Интеллектуальное Казино!</b> 🎰\n\nКаждое очко = 1 фишка CasinoCoin 🪙.\n\nКоманды:\n/join — сесть за стол (участвовать)\n/leave — выйти из-за стола (очки сохраняются!)\n/players — список игроков за столом\n/next — следующий вопрос и фишки\n/current — текущий вопрос и статус\n/roulette — сыграть в рулетку ва-банк (множитель 0.0 – 2.0)\n/stat — баланс фишек и лидеры\n/reset — сбросить всё`
      );
      return;
    }

    addBotMessage(`Неизвестная команда. Доступные команды: /join, /leave, /players, /next, /roulette, /stat, /current, /reset`);
  };

  const handleAnswerAttempt = (rawText: string) => {
    if (!currentQuestion) {
      return;
    }

    // 1. Проверяем, зарегистрирован ли игрок через /join
    if (!registeredUserIds.includes(activeUser.id)) {
      addBotMessage(
        `⚠️ <b>${activeUser.name}</b>, вы ещё не за игровым столом!\nОтправьте команду <b>/join</b>, чтобы вступить в игру и копить фишки для казино!`,
        'system'
      );
      return;
    }

    // 2. Проверяем, открыт ли ещё раунд
    if (isRoundClosed || (currentQuestion.type === 'first' && firstWinnerId)) {
      addBotMessage(
        `🛑 <b>Вопрос уже закрыт!</b> ${
          firstWinnerId
            ? 'Первый верный ответ уже получен, раунд завершен.'
            : 'Ответы больше не принимаются.'
        }\n👉 Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу.`,
        'system'
      );
      return;
    }

    // 3. Проверяем, отвечал ли уже этот игрок на этот вопрос
    if (attemptedUserIds.includes(activeUser.id)) {
      if (currentQuestion.type === 'first') {
        addBotMessage(
          `⚠️ <b>${activeUser.name}</b>, вы уже сделали попытку на этот вопрос! В вопросах на скорость даётся 1 попытка.`,
          'already_answered'
        );
      } else {
        addBotMessage(
          `⚠️ <b>${activeUser.name}</b>, ваша ставка уже принята! Ждём остальных игроков за столом ⏳`,
          'already_answered'
        );
      }
      return;
    }

    // Засчитываем ход игрока
    const nextAttempted = [...attemptedUserIds, activeUser.id];
    setAttemptedUserIds(nextAttempted);

    const cleanInput = rawText.trim().toLowerCase();
    let isCorrect = false;

    if (currentQuestion.type === 'choice' && currentQuestion.options && currentQuestion.options.length > 0) {
      const cIdx = typeof currentQuestion.correctOptionIndex === 'number'
        ? currentQuestion.correctOptionIndex
        : 0;

      // Извлекаем только цифры: "1", "1)", "1.", "вариант 1" -> 1
      const numMatch = cleanInput.replace(/[^\d]/g, '');
      const userNum = numMatch ? parseInt(numMatch, 10) : null;

      const letterMap: Record<string, number> = { 'а': 1, 'б': 2, 'в': 3, 'г': 4, 'д': 5, 'a': 1, 'b': 2, 'c': 3, 'd': 4 };
      const matchedLetterNum = letterMap[cleanInput];

      const optionNum = userNum ?? matchedLetterNum;
      const isNumCorrect = optionNum !== null && optionNum === cIdx + 1;

      const targetOptText = currentQuestion.options[cIdx]?.trim().toLowerCase() || '';
      const isOptTextCorrect = Boolean(targetOptText && cleanInput === targetOptText);

      const correctVariants = currentQuestion.answers.map(a => a.trim().toLowerCase());
      const isVariantCorrect = correctVariants.includes(cleanInput);

      isCorrect = isNumCorrect || isOptTextCorrect || isVariantCorrect;
    } else {
      const correctVariants = currentQuestion.answers.map(a => a.trim().toLowerCase());
      isCorrect = correctVariants.includes(cleanInput);
    }

    const totalPlayers = registeredUserIds.length;
    const allAnswered = totalPlayers > 0 && registeredUserIds.every(id => nextAttempted.includes(id));

    // =========================================================================
    // ⚡ ВАРИАНТ 1: ВОПРОС НА СКОРОСТЬ (type === 'first')
    // В вопросах на скорость не нужно ждать, пока все ответят!
    // Вопрос заканчивается сразу, как только первый игрок даёт верный ответ!
    // =========================================================================
    if (currentQuestion.type === 'first') {
      if (isCorrect) {
        // ПЕРВЫЙ ВЕРНЫЙ ОТВЕТ: ВОПРОС ЗАКРЫВАЕТСЯ СРАЗУ!
        setIsRoundClosed(true);
        setFirstWinnerId(activeUser.id);
        setAnsweredUserIds([activeUser.id]);

        const currentScore = scores[activeUser.id] || {
          userId: activeUser.id,
          name: activeUser.name,
          username: activeUser.username,
          points: 0,
          correctAnswersCount: 0,
          firstPlaceCount: 0
        };

        const updatedScores = {
          ...scores,
          [activeUser.id]: {
            ...currentScore,
            points: currentScore.points + currentQuestion.points,
            correctAnswersCount: currentScore.correctAnswersCount + 1,
            firstPlaceCount: currentScore.firstPlaceCount + 1
          }
        };
        onUpdateScores(updatedScores);

        const correctSample = currentQuestion.answers[0] || '';
        const expl = currentQuestion.explanation ? `\n💡 <i>${currentQuestion.explanation}</i>` : '';
        const speedJoke = SPEED_JOKES[Math.floor(Math.random() * SPEED_JOKES.length)];

        addBotMessage(
          `⚡ <b>ЕСТЬ ПЕРВЫЙ ВЕРНЫЙ ОТВЕТ! РАУНД НА СКОРОСТЬ ЗАКРЫТ!</b> 🏁\n\n` +
          `👤 <b>${activeUser.name}</b> молниеносно дал правильный ответ: <b>${correctSample}</b>${expl}\n\n` +
          `🎉 <b>ДЖЕКПОТ СКОРОСТИ!</b> Забирает весь банк: <b>+${currentQuestion.points} CasinoCoins 🪙</b>\n` +
          `🎰 Баланс победителя: <b>${updatedScores[activeUser.id].points} фишек</b>\n` +
          `${speedJoke}\n\n` +
          `🛑 <b>ВОПРОС ПОЛНОСТЬЮ ЗАКРЫТ! Ожидание других участников остановлено!</b>\n` +
          `👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>`,
          'correct',
          currentQuestion.points
        );
        return;
      } else {
        // НЕПРАВИЛЬНЫЙ ОТВЕТ НА СКОРОСТЬ
        if (allAnswered) {
          // Все игроки за столом попробовали, но никто не ответил верно!
          setIsRoundClosed(true);
          const correctSample = currentQuestion.answers[0] || '';
          const expl = currentQuestion.explanation ? `\n💡 <i>${currentQuestion.explanation}</i>` : '';
          const wrongJoke = WRONG_JOKES[Math.floor(Math.random() * WRONG_JOKES.length)];

          addBotMessage(
            `❌ <b>${activeUser.name}</b>, мимо!\n\n` +
            `🛑 <b>РАУНД НА СКОРОСТЬ ЗАКРЫТ!</b> 🏁\n` +
            `Все <b>${totalPlayers}</b> игроков за столом сделали попытку, но никто не назвал верный ответ!\n\n` +
            `🎯 Правильный ответ: <b>${correctSample}</b>${expl}\n` +
            `💨 Все фишки остаются в кассе казино! 🏛️\n${wrongJoke}\n\n` +
            `👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>`,
            'wrong'
          );
          return;
        } else {
          // Кто-то ошибся, гонка продолжается!
          const wrongJoke = WRONG_JOKES[Math.floor(Math.random() * WRONG_JOKES.length)];
          addBotMessage(
            `❌ <b>${activeUser.name}</b>, мимо!\n${wrongJoke}\n\n⚡ <i>Гонка за куш скорости продолжается! Кто первым назовёт правильный ответ?</i>`,
            'wrong'
          );
          return;
        }
      }
    }

    // =========================================================================
    // 🌟 ВАРИАНТ 2: ОБЩИЙ ВОПРОС (type === 'general')
    // Ставки держатся в секрете, пока не ответят все игроки за столом!
    // =========================================================================
    const nextCorrect = isCorrect
      ? [...roundCorrectUserIds, activeUser.id]
      : roundCorrectUserIds;

    if (isCorrect) {
      setRoundCorrectUserIds(nextCorrect);
    }

    // 4. ЕСЛИ ЕЩЁ НЕ ВСЕ ОТВЕТИЛИ: ДЕРЖИМ СТАВКИ ВТАЙНЕ
    if (!allAnswered) {
      addBotMessage(
        `🎲 <b>Ставка принята от ${activeUser.name}!</b> ⏳\n📊 Принято ставок: <b>${nextAttempted.length} из ${totalPlayers}</b>.\n<i>Ждём, пока все игроки за столом сделают ход...</i>`,
        'system'
      );
      return;
    }

    // 5. ВСЕ ИГРОКИ СДЕЛАЛИ СТАВКИ: ЗАКРЫВАЕМ СТАВКИ И ПОДВОДИМ ИТОГИ
    setIsRoundClosed(true);

    addBotMessage(
      `🎲 <b>Ставка принята от ${activeUser.name}!</b> (<b>${nextAttempted.length} из ${totalPlayers}</b>)\n\n🛑 <b>СТАВКИ СДЕЛАНЫ, СТАВОК БОЛЬШЕ НЕТ!</b> 🎰\nВсе <b>${totalPlayers}</b> игроков за столом сделали свои ходы. Раунд №${currentQuestionIndex + 1} официально закрыт!`,
      'system'
    );

    // Оглашаем правильный ответ и список победителей
    setTimeout(() => {
      let correctSample = currentQuestion.answers[0] || '';
      if (currentQuestion.type === 'choice' && currentQuestion.options && currentQuestion.options.length > 0) {
        const cIdx = typeof currentQuestion.correctOptionIndex === 'number'
          ? currentQuestion.correctOptionIndex
          : 0;
        const optText = currentQuestion.options[cIdx] || '';
        correctSample = `Вариант ${cIdx + 1}: ${optText}`;
      }

      const expl = currentQuestion.explanation ? `\n💡 <i>${currentQuestion.explanation}</i>` : '';
      const points = currentQuestion.points;

      let resultText = `🎯 <b>Правильный ответ:</b> <b>${correctSample}</b>${expl}\n\n`;

      if (nextCorrect.length > 0) {
        let updatedScores = { ...scores };
        resultText += `🏆 <b>ПРАВИЛЬНО ОТВЕТИЛИ И ПОЛУЧАЮТ ФИШКИ:</b>\n`;

        nextCorrect.forEach(uid => {
          const userObj = SIM_USERS.find(u => u.id === uid) || { name: 'Игрок', username: 'player' };
          const prevScore = updatedScores[uid] || {
            userId: uid,
            name: userObj.name,
            username: userObj.username,
            points: 0,
            correctAnswersCount: 0,
            firstPlaceCount: 0
          };
          const newPoints = prevScore.points + points;
          updatedScores[uid] = {
            ...prevScore,
            points: newPoints,
            correctAnswersCount: prevScore.correctAnswersCount + 1
          };
          resultText += `• 👤 <b>${userObj.name}</b>: +${points} CasinoCoins 🪙 (Баланс: <b>${newPoints} фишек</b>)\n`;
        });

        onUpdateScores(updatedScores);
        setAnsweredUserIds(nextCorrect);

        const generalJoke = GENERAL_JOKES[Math.floor(Math.random() * GENERAL_JOKES.length)];
        resultText += `\n${generalJoke}\n`;
      } else {
        const wrongJoke = WRONG_JOKES[Math.floor(Math.random() * WRONG_JOKES.length)];
        resultText += `💨 <b>Никто из игроков не угадал!</b>\nКрупье сметает все фишки себе в банк! 🧹\n${wrongJoke}\n`;
      }

      resultText += `\n👉 <i>Крупье, отправьте команду <b>/next</b> для перехода к следующему вопросу!</i>`;
      addBotMessage(resultText, nextCorrect.length > 0 ? 'correct' : 'wrong', points);
    }, 700);
  };

  const sortedLeaderboard = Object.values(scores).sort((a, b) => b.points - a.points);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
      {/* Left / Main: Telegram Chat Simulator */}
      <div className="lg:col-span-8 flex flex-col bg-slate-100 rounded-2xl border border-slate-300 shadow-sm overflow-hidden min-h-[620px]">
        {/* Telegram Chat Header */}
        <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-base shadow-xs text-white">
              🧠
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-white">Квиз-Клуб • Telegram Чат</h2>
                <span className="text-[10px] bg-sky-500/20 text-sky-300 font-semibold px-2 py-0.5 rounded-full border border-sky-400/30">
                  Группа
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {SIM_USERS.length} участников, бот <span className="text-sky-300 font-mono">@QuizBot</span> онлайн
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScoresSidebar(!showScoresSidebar)}
              className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors border border-slate-600"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Лидеры</span> ({Object.keys(scores).length})
            </button>
          </div>
        </div>

        {/* Telegram Chat Wallpaper & Messages Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#e4e8ed] relative bg-opacity-95">
          {/* Subtle chat background pattern accent */}
          <div className="text-center my-1">
            <span className="bg-slate-700/60 text-white text-[11px] font-medium px-3 py-1 rounded-full shadow-xs backdrop-blur-xs">
              Сегодня • Режим симулятора aiogram 3.x
            </span>
          </div>

          {messages.map(msg => {
            const isSelf = msg.senderId === activeUser.id;
            const isBot = msg.isBot;

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
              >
                {!isSelf && (
                  <div
                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-xs ${msg.avatarBg}`}
                  >
                    {msg.avatarText}
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-sm shadow-xs transition-all ${
                    isBot
                      ? msg.type === 'question'
                        ? 'bg-white border-2 border-indigo-300 text-slate-900'
                        : msg.type === 'correct'
                        ? 'bg-emerald-50 border border-emerald-300 text-emerald-950'
                        : 'bg-white border border-slate-200 text-slate-900'
                      : isSelf
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
                  }`}
                >
                  {/* Sender Name */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        isBot
                          ? 'text-indigo-600 flex items-center gap-1'
                          : isSelf
                          ? 'text-indigo-200'
                          : 'text-slate-600'
                      }`}
                    >
                      {msg.senderName}
                      {msg.badge === 'bot' && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-bold">
                          BOT
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isSelf ? 'text-indigo-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {/* Message Body (HTML simulation) */}
                  <div
                    className="leading-relaxed whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                      __html: msg.text
                        .replace(/<b>/g, '<strong>')
                        .replace(/<\/b>/g, '</strong>')
                        .replace(/<i>/g, '<em>')
                        .replace(/<\/i>/g, '</em>')
                    }}
                  />
                </div>

                {isSelf && (
                  <div
                    className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-xs ${activeUser.avatarBg}`}
                  >
                    {activeUser.avatarText}
                  </div>
                )}
              </div>
            );
          })}

          {isBotTyping && (
            <div className="flex items-center gap-2 text-slate-500 text-xs italic pl-10">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              QuizBot печатает ответ...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Testing Context Bar (If Question Active) */}
        {currentQuestion && (
          <div className="bg-amber-50/90 border-t border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-900">
                {currentQuestion.type === 'first'
                  ? '⚡ На скорость:'
                  : currentQuestion.type === 'choice'
                  ? '🔘 С выбором ответа:'
                  : '🌟 Общий вопрос:'}
              </span>
              <span className="text-amber-800 truncate max-w-xs font-medium">
                «{currentQuestion.text}»
              </span>
              {isRoundClosed || (currentQuestion.type === 'first' && firstWinnerId) ? (
                <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-300">
                  🛑 Раунд закрыт {currentQuestion.type === 'first' && firstWinnerId ? '(победитель найден)' : ''}
                </span>
              ) : currentQuestion.type === 'first' ? (
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  ⚡ До 1-го верного ответа (без ожидания)
                </span>
              ) : (
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  Ставок: {attemptedUserIds.length} из {registeredUserIds.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-amber-700 font-medium">Тестовый клик:</span>
              <button
                onClick={() => {
                  if (currentQuestion.type === 'choice' && currentQuestion.options) {
                    const cIdx = currentQuestion.correctOptionIndex ?? 0;
                    handleSendMessage(String(cIdx + 1));
                  } else {
                    handleSendMessage(currentQuestion.answers[0]);
                  }
                }}
                disabled={isRoundClosed || (currentQuestion.type === 'first' && Boolean(firstWinnerId))}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-2.5 py-1 rounded-md font-semibold text-[11px] shadow-xs flex items-center gap-1"
                title="Отправить правильный ответ"
              >
                <CheckCircle2 className="w-3 h-3" />
                {currentQuestion.type === 'choice'
                  ? `Верно: Вариант ${(currentQuestion.correctOptionIndex ?? 0) + 1}`
                  : `Верно: «${currentQuestion.answers[0]}»`}
              </button>
              <button
                onClick={() => {
                  if (currentQuestion.type === 'choice' && currentQuestion.options) {
                    const cIdx = currentQuestion.correctOptionIndex ?? 0;
                    const wrongIdx = cIdx === 0 ? 1 : 0;
                    handleSendMessage(String(wrongIdx + 1));
                  } else {
                    handleSendMessage('Неправильный ответ');
                  }
                }}
                disabled={isRoundClosed || (currentQuestion.type === 'first' && Boolean(firstWinnerId))}
                className="bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-700 px-2 py-1 rounded-md font-medium text-[11px]"
                title="Отправить неправильный ответ"
              >
                Неверно (ошибка)
              </button>
            </div>
          </div>
        )}

        {/* Participant Switcher & Registration Bar */}
        <div className="bg-slate-200/90 border-t border-slate-300 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <span>Отвечать от:</span>
            {!registeredUserIds.includes(activeUser.id) ? (
              <button
                onClick={() => handleCommand('/join')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs animate-pulse"
                title="Зарегистрировать текущего пользователя в игре"
              >
                + /join (Сесть за стол)
              </button>
            ) : (
              <button
                onClick={() => handleCommand('/leave')}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs transition-colors"
                title="Покинуть стол с сохранением очков"
              >
                🚪 /leave (Выйти из стола)
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {SIM_USERS.map(u => {
              const isSelected = u.id === activeUser.id;
              const isRegistered = registeredUserIds.includes(u.id);
              const hasAttempted = attemptedUserIds.includes(u.id);
              const uScore = scores[u.id]?.points || 0;

              return (
                <button
                  key={u.id}
                  onClick={() => setActiveUser(u)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-slate-800 text-white shadow-xs ring-2 ring-indigo-400'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${u.avatarBg} text-[9px] text-white flex items-center justify-center font-bold`}>
                    {u.avatarText.slice(0, 1)}
                  </span>
                  <span>{u.name.split(' ')[0]}</span>
                  {isRegistered ? (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        hasAttempted && currentQuestion
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                      title={hasAttempted ? 'Сделал ход в этом раунде' : 'В игре'}
                    >
                      {hasAttempted && currentQuestion ? '✓' : `${uScore}🪙`}
                    </span>
                  ) : (
                    <span className="text-[9px] bg-rose-100 text-rose-700 px-1 py-0.2 rounded font-bold" title="Не за столом (/join чтобы сесть)">
                      {uScore > 0 ? `${uScore}🪙 (вне)` : 'не в игре'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Command Pills */}
        <div className="bg-white border-t border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider flex-shrink-0">
            Команды:
          </span>
          <button
            onClick={() => handleSendMessage('/join')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-lg border border-emerald-200 transition-colors"
            title="Войти в игру (сесть за стол)"
          >
            /join (Вступить)
          </button>
          <button
            onClick={() => handleSendMessage('/leave')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-lg border border-rose-200 transition-colors"
            title="Выйти из-за стола (очки сохраняются!)"
          >
            🚪 /leave (Выйти)
          </button>
          <button
            onClick={() => handleSendMessage('/players')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
          >
            /players ({registeredUserIds.length})
          </button>
          <button
            onClick={() => handleSendMessage('/next')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg border border-indigo-200 transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            /next (Следующий вопрос)
          </button>
          <button
            onClick={() => handleSendMessage('/stat')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-lg border border-amber-200 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
            /stat (Банкролл)
          </button>
          <button
            onClick={() => handleSendMessage('/roulette')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs rounded-lg border border-rose-200 transition-colors"
            title="Поставить все очки на рулетку (множитель 0.0 – 2.0)"
          >
            <span>🎰</span>
            /roulette (Ва-банк)
          </button>
          <button
            onClick={() => handleSendMessage('/current')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors"
          >
            /current
          </button>
          <button
            onClick={() => handleSendMessage('/reset')}
            className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-medium text-xs rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            /reset
          </button>
        </div>

        {/* Choice Question Interactive Option Buttons (Simulating Telegram inline buttons) */}
        {currentQuestion?.type === 'choice' && currentQuestion.options && currentQuestion.options.length > 0 && !isRoundClosed && (
          <div className="bg-sky-50/95 border-t border-sky-200 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                <span>🔘</span> Выберите вариант ответа (кнопка Telegram или отправьте цифру):
              </span>
              <span className="text-[10px] bg-sky-200/80 text-sky-900 font-semibold px-2 py-0.5 rounded-full">
                {attemptedUserIds.includes(activeUser.id) ? 'Вы уже ответили ✓' : 'Сделайте ставку'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentQuestion.options.map((optionText, optIdx) => {
                const optNum = optIdx + 1;
                const isSelectedByUser = attemptedUserIds.includes(activeUser.id);
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSendMessage(String(optNum))}
                    disabled={isSelectedByUser}
                    className="flex items-center gap-2.5 px-3 py-2 bg-white hover:bg-sky-100 disabled:opacity-50 text-slate-800 rounded-xl border border-sky-300 font-medium text-xs text-left shadow-2xs transition-all hover:scale-[1.01] active:scale-[0.99]"
                    title={`Отправить вариант ${optNum}: ${optionText}`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-sky-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                      {optNum}
                    </span>
                    <span className="truncate">{optionText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isRoundClosed || (currentQuestion?.type === 'first' && Boolean(firstWinnerId))
                ? 'Вопрос закрыт. Отправьте /next для перехода к следующему вопросу...'
                : `Отправить сообщение или ответ от имени ${activeUser.name}...`
            }
            className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right / Sidebar: Live Leaderboard & Question Tracker */}
      <div className="lg:col-span-4 space-y-5">
        {/* Registered Players & Auto-close Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>За игровым столом (/join)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {registeredUserIds.length} из {SIM_USERS.length} игроков за столом
              </p>
            </div>
            <button
              onClick={() => {
                const allIds = SIM_USERS.map(u => u.id);
                setRegisteredUserIds(allIds);
                addBotMessage(
                  `🎰 <b>Все участники сели за игровой стол!</b>\nТеперь в игре ${allIds.length} участников. Крупье, отправляйте <b>/next</b>!`
                );
              }}
              className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold px-2 py-1 rounded-lg border border-emerald-200 transition-colors"
              title="Зарегистрировать всех тестовых пользователей сразу"
            >
              Зарегистрировать всех
            </button>
          </div>

          <div className="space-y-2">
            {SIM_USERS.map(u => {
              const isRegistered = registeredUserIds.includes(u.id);
              const hasAttempted = attemptedUserIds.includes(u.id);
              const isSpeedClosed = Boolean(currentQuestion && currentQuestion.type === 'first' && (isRoundClosed || firstWinnerId));
              const isWinner = firstWinnerId === u.id;

              return (
                <div
                  key={u.id}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-colors ${
                    isRegistered ? 'bg-slate-50 border-slate-200' : 'bg-slate-100/50 border-slate-200/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full ${u.avatarBg} text-[10px] text-white flex items-center justify-center font-bold`}>
                      {u.avatarText}
                    </span>
                    <span className="font-semibold text-slate-800">{u.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentQuestion && isRegistered && (
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          isSpeedClosed
                            ? isWinner
                              ? 'bg-emerald-100 text-emerald-800 font-bold'
                              : 'bg-slate-200 text-slate-600'
                            : currentQuestion.type === 'first'
                            ? hasAttempted
                              ? 'bg-rose-100 text-rose-800 font-bold'
                              : 'bg-amber-100 text-amber-900 font-medium'
                            : hasAttempted
                            ? 'bg-emerald-100 text-emerald-800 font-bold'
                            : 'bg-amber-100 text-amber-900 animate-pulse'
                        }`}
                      >
                        {isSpeedClosed
                          ? isWinner
                            ? '🏆 Победитель'
                            : 'Раунд закрыт'
                          : currentQuestion.type === 'first'
                          ? hasAttempted
                            ? '✗ Ошибка'
                            : '⚡ Скорость'
                          : hasAttempted
                          ? '✓ Ставка сделана'
                          : '⏳ Ждём ставку'}
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setActiveUser(u);
                        if (isRegistered) {
                          handleCommand('/leave');
                        } else {
                          handleCommand('/join');
                        }
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${
                        isRegistered
                          ? 'bg-slate-200 text-slate-700 hover:bg-rose-100 hover:text-rose-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                      title={isRegistered ? 'Выйти из-за стола (/leave, очки сохраняются)' : 'Сесть за стол (/join)'}
                    >
                      {isRegistered ? '🚪 Выйти' : '+ /join'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/70 text-[11px] text-emerald-950 leading-relaxed space-y-1">
            <div>
              ⚡ <b>Вопросы на скорость:</b> завершаются сразу при первом верном ответе — никакого ожидания остальных игроков!
            </div>
            <div>
              👥 <b>Общие вопросы:</b> закрываются автоматически только после того, как все участники за столом сделают ход.
            </div>
            <div>
              🚪 <b>Выход из стола:</b> команда <b>/leave</b> позволяет покинуть стол, при этом все заработанные фишки полностью сохраняются!
            </div>
          </div>
        </div>

        {/* Leaderboard Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <span>🎰</span>
                <span>Банкролл Казино (/stat)</span>
              </h3>
              <p className="text-[11px] text-amber-800 font-semibold mt-0.5">
                Курс: 1 балл = 1 CasinoCoin 🪙 для рулетки
              </p>
            </div>
            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300/50">
              Касса открыта
            </span>
          </div>

          {sortedLeaderboard.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Фишки еще не заработаны.<br />Нажмите <code className="text-indigo-600 font-bold">/next</code> и ответьте на вопрос!
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedLeaderboard.map((user, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                return (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center text-sm font-bold">{medal}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{user.name}</p>
                        <p className="text-[10px] text-slate-500">
                          {user.correctAnswersCount} верных • {user.firstPlaceCount} на скорость
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <span>{user.points}</span>
                        <span className="text-xs">🪙</span>
                      </div>
                      <span className="text-[9px] text-slate-400">фишек</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Roulette All-In Card */}
        <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-orange-50 rounded-2xl border border-rose-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎡</span>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950">
                  Хитрая рулетка (House Edge)
                </h4>
                <p className="text-[11px] text-rose-800">
                  Коварное колесо: ~86% уводит в убыток или зеро!
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-rose-200/70 text-rose-900 px-2 py-0.5 rounded-full">
              0.0x – 2.0x (Хитрый)
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed">
            Команда <code className="bg-white px-1.5 py-0.5 rounded text-rose-700 font-mono font-bold border border-rose-200">/roulette</code> ставит <b>все очки</b> ва-банк. Мультипликатор <b>хитро взвешен по законам казино</b>: в большинстве случаев шарик падает в убыточные сектора (от 0.1 до 0.9) или в сектор Зеро (0.0x)!
          </p>

          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="bg-white/80 p-1.5 rounded-lg border border-rose-200">
              <span className="text-rose-700 font-bold block">0.0x – 0.9x (~86%)</span>
              <span className="text-slate-500">Убыток / Зеро 💸</span>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-amber-200">
              <span className="text-amber-700 font-bold block">1.0x (~5%)</span>
              <span className="text-slate-500">Возврат фишек</span>
            </div>
            <div className="bg-white/80 p-1.5 rounded-lg border border-emerald-200">
              <span className="text-emerald-700 font-bold block">1.1x – 2.0x (~9%)</span>
              <span className="text-slate-500">Редкий куш 🍀</span>
            </div>
          </div>

          <button
            onClick={() => handleSendMessage('/roulette')}
            className="w-full mt-3.5 py-2 px-3 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
          >
            <span>🎰</span>
            <span>Крутить за {activeUser.name} ({scores[activeUser.id]?.points || 0} 🪙)</span>
          </button>
        </div>

        {/* Active Question Mechanics Box */}
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-5 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Как работают 2 типа вопросов
          </h4>

          <div className="space-y-3 text-xs text-slate-700">
            <div className="bg-white p-3 rounded-xl border border-indigo-100">
              <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                1. Общий вопрос
              </p>
              <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                Каждый участник, который напишет верный ответ, получает баллы. Повторный ввод правильного ответа тем же человеком баллы повторно не начисляет.
              </p>
            </div>

            <div className="bg-white p-3 rounded-xl border border-amber-200">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                2. Вопрос на скорость (Кто первый)
              </p>
              <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                Баллы получает <b>только первый</b> участник, давший правильный ответ. Всем остальным бот вежливо сообщает, что первый ответ уже дан.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-indigo-100/70 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Прогресс:</span>
            <span className="font-bold text-indigo-700">
              Вопрос {Math.min(currentQuestionIndex + 1, questions.length)} из {questions.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
