import { useAuth } from '@/hooks/useAuth';

// Accounts created on/after this cutoff get the simplified nav.
// IMPORTANT: Courses are ALWAYS visible to every member, regardless of account age.
// This flag only gates: Start Here visibility, Training Games, and Marketing Tools.
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
