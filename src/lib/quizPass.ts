/**
 * Quiz passing rule (project-wide): a user passes a quiz if they miss no more
 * than 1 question. On a 3-question quiz that means 2/3, on a 15-question quiz
 * that means 14/15. This is the single source of truth — do NOT check
 * percentage thresholds (80%, 90%) anywhere else.
 */
export const MAX_ALLOWED_MISSES = 1;

export function isQuizPassed(score: number, totalQuestions: number): boolean {
  if (!totalQuestions || totalQuestions <= 0) return false;
  return totalQuestions - score <= MAX_ALLOWED_MISSES;
}

/** Convenience for callers that only have a ratio + total on hand. */
export function isQuizPassedFromRatio(ratio: number, totalQuestions: number): boolean {
  if (!totalQuestions || totalQuestions <= 0) return false;
  const score = Math.round(ratio * totalQuestions);
  return isQuizPassed(score, totalQuestions);
}
