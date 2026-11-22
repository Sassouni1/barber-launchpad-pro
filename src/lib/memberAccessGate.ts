import type { MemberAccess } from '@/contexts/AuthContext';

/**
 * Whether a signed-in account may open member pages. The server decides access
 * (verified purchase or admin grant); this only mirrors it for the UI. Database
 * rules enforce the same decision, so hiding pages is never the only guard.
 */
export function memberGate(input: { isAdmin: boolean; isManufacturer: boolean; access: MemberAccess | null }): 'allow' | 'pending' {
  if (input.isAdmin) return 'allow';
  if (input.isManufacturer) return 'allow'; // manufacturers are routed to their order pages separately
  if (!input.access) return 'pending';
  return input.access.allowed ? 'allow' : 'pending';
}
