import { describe, it, expect } from 'bun:test';
import { summarizeQuizAttempts, type QuizHistoryAttempt } from '../src/lib/memberQuizHistory';

const attempt = (score: number, total_questions: number): QuizHistoryAttempt => ({
  id: `${score}-${total_questions}`, module_id: 'module', module_title: 'Quiz',
  lesson_title: null, score, total_questions, completed_at: '2026-08-29T17:48:59Z',
});

describe('member quiz history', () => {
  it('passes when no more than one question was missed', () => {
    expect(summarizeQuizAttempts([attempt(2, 3)]).passed).toBe(true);
    expect(summarizeQuizAttempts([attempt(1, 3)]).passed).toBe(false);
  });
  it('keeps a passing attempt even if another has a higher percentage but two misses', () => {
    expect(summarizeQuizAttempts([attempt(8, 10), attempt(2, 3)])).toMatchObject({ passed: true, attemptCount: 2, bestScore: 80 });
  });
  it('counts every historical attempt without treating an untaken quiz as passed', () => {
    expect(summarizeQuizAttempts(Array.from({ length: 1005 }, () => attempt(1, 3))).attemptCount).toBe(1005);
    expect(summarizeQuizAttempts([])).toMatchObject({ passed: false, attempted: false, bestScore: null });
  });
});