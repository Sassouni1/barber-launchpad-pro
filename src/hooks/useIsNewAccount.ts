import { useAuth } from '@/hooks/useAuth';

// Accounts created on/after this cutoff get the simplified nav
// (Start Here is hidden once all quizzes are passed; Games/Marketing stay gated until then).
const NEW_ACCOUNT_CUTOFF_ISO = '2026-06-18T00:00:00Z';

export function useIsNewAccount(): boolean {
  const { user } = useAuth() as any;
  const createdAt = user?.created_at;
  if (!createdAt) return false;
  try {
    return new Date(createdAt).getTime() >= new Date(NEW_ACCOUNT_CUTOFF_ISO).getTime();
  } catch {
    return false;
  }
}
