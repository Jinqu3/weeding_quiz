export type QuestionType = 'general' | 'first' | 'choice';

export interface Question {
  id: string;
  text: string;
  type: QuestionType; // 'general' = баллы всем, 'first' = только первому, 'choice' = тест с вариантами (1, 2, 3...)
  options?: string[]; // варианты ответа, например ["Париж", "Рим", "Берлин", "Мадрид"]
  correctOptionIndex?: number; // 0-based индекс верного варианта (0, 1, 2, 3...)
  answers: string[];  // варианты правильных ответов (например ["1", "париж"])
  points: number;     // количество очков
  explanation?: string;
}

export interface DbStatus {
  connected: boolean;
  engine: string;
  dbPath: string;
  jsonBackupPath: string;
  totalQuestions: number;
  sizeBytes: number;
  sizeKb: string;
}

export interface SimUser {
  id: string;
  name: string;
  username: string;
  avatarBg: string;
  avatarText: string;
}

export interface UserScore {
  userId: string;
  name: string;
  username: string;
  points: number;
  correctAnswersCount: number;
  firstPlaceCount: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  avatarBg: string;
  avatarText: string;
  isBot: boolean;
  text: string;
  timestamp: string;
  badge?: string;
  type?: 'text' | 'question' | 'correct' | 'wrong' | 'already_answered' | 'stat' | 'system';
  awardedPoints?: number;
}
