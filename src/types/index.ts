export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'member' | 'admin';
  joinedAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  type: 'course' | 'personal';
  dueDate?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  duration: string;
  completed: boolean;
  hasQuiz: boolean;
  hasDownload: boolean;
  hasHomework: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  progress: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  modules: Module[];
  progress: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface Quiz {
  id: string;
  lessonId: string;
  title: string;
  questions: QuizQuestion[];
}

export interface Member {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  progress: number;
  joinedAt: string;
  lastActive: string;
}

export interface InviteCode {
  id: string;
  code: string;
  used: boolean;
  usedBy?: string;
  createdAt: string;
  expiresAt?: string;
}
