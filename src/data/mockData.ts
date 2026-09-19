import { Question, SimUser } from '../types';

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'Какой химический элемент в таблице Менделеева обозначается символом Au?',
    type: 'general',
    points: 10,
    answers: ['золото', 'gold', 'аурум', 'aurum'],
    explanation: 'Au происходит от латинского Aurum (золото).'
  },
  {
    id: 'q2',
    text: '⚡ [НА СКОРОСТЬ] Назовите столицу Австралии (не Сидней!)',
    type: 'first',
    points: 20,
    answers: ['канберра', 'canberra'],
    explanation: 'Канберра была выбрана столицей в качестве компромисса между Сиднеем и Мельбурном.'
  },
  {
    id: 'q3',
    text: 'Сколько планет в Солнечной системе (без учета Плутона)?',
    type: 'general',
    points: 10,
    answers: ['8', 'восемь', 'eight'],
    explanation: 'В Солнечной системе 8 признанных планет после реклассификации Плутона в 2006 году.'
  },
  {
    id: 'q4',
    text: '⚡ [НА СКОРОСТЬ] В каком году Юрий Гагарин совершил первый в истории полет в космос?',
    type: 'first',
    points: 25,
    answers: ['1961', '1961 год', '1961г'],
    explanation: '12 апреля 1961 года на корабле «Восток-1».'
  },
  {
    id: 'q5',
    text: 'Какое озеро является самым глубоким на планете Земля?',
    type: 'general',
    points: 15,
    answers: ['байкал', 'озеро байкал', 'baikal'],
    explanation: 'Максимальная глубина Байкала составляет 1642 метра.'
  }
];

export const SIM_USERS: SimUser[] = [
  {
    id: 'user_you',
    name: 'Вы (Игрок 1)',
    username: 'you_player',
    avatarBg: 'bg-emerald-600',
    avatarText: 'ВЫ'
  },
  {
    id: 'user_alex',
    name: 'Алексей Смирнов',
    username: 'alex_pro',
    avatarBg: 'bg-sky-600',
    avatarText: 'АС'
  },
  {
    id: 'user_maria',
    name: 'Мария Иванова',
    username: 'maria_art',
    avatarBg: 'bg-violet-600',
    avatarText: 'МИ'
  },
  {
    id: 'user_dmitry',
    name: 'Дмитрий Ковалев',
    username: 'dmitry_fast',
    avatarBg: 'bg-amber-600',
    avatarText: 'ДК'
  }
];
