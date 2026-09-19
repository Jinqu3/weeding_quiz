export type QuestionType = 'general' | 'first';

export interface Question {
  id: string;
  text: string;
  type: QuestionType; // 'general' = баллы всем, 'first' = только первому
  answers: string[];  // варианты правильных ответов
  points: number;     // количество очков
  explanation?: string;
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
