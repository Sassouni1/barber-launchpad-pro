import { isQuizPassed } from './quizPass';

export interface QuizHistoryAttempt {
  id: string;
  module_id: string;
  module_title: string;
  lesson_title: string | null;
  score: number;
  total_questions: number;
  completed_at: string;
}

export function summarizeQuizAttempts(attempts: QuizHistoryAttempt[]) {
  const valid = attempts.filter(a => a.total_questions > 0);
  const best = valid.reduce<QuizHistoryAttempt | null>((current, a) =>
    !current || a.score / a.total_questions > current.score / current.total_questions ? a : current, null);
  return {
    bestScore: best ? Math.round(Math.min(best.score / best.total_questions, 1) * 100) : null,
    totalQuestions: best?.total_questions ?? 0,
    passed: valid.some(a => isQuizPassed(a.score, a.total_questions)),
    attempted: attempts.length > 0,
    attemptCount: attempts.length,
  };
}