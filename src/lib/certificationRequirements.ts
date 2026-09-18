/**
 * The Live Client quizzes were added after the original certification cohort.
 * Members who joined before this cutoff, plus members who already have a
 * certificate, keep the requirements that applied to them at the time.
 */
export const CERTIFICATION_QUIZ_CUTOFF_ISO = '2026-06-01T00:00:00.000Z';

// These are the quizzes that were added or changed after the original
// certification cohort. Keeping the IDs here avoids accidentally
// grandfathering an unrelated quiz if a title changes.
export const NEW_CERTIFICATION_MODULE_IDS = [
  'c8b69876-591a-41cc-82e4-755ad02efd4e', // Live Client Part 4
  'ef71fd79-972e-4aca-a6eb-771dfbb1b865', // Live Client Part 3
  '7c4808e9-0b1e-40e8-b188-016d4f9398a4', // Live Client Part 2
  '582837c7-5a6e-4467-b0ff-36446de0e478', // Live Client Part 1
  'c45caf90-af21-44cd-898c-76fc8015ea00', // How and What to Charge
] as const;

export function isNewCertificationModule(moduleId: string): boolean {
  return (NEW_CERTIFICATION_MODULE_IDS as readonly string[]).includes(moduleId);
}

/**
 * A missing/invalid created_at is treated as legacy rather than blocking a
 * member whose account predates the new requirement but has incomplete data.
 */
export function requiresNewCertificationQuizzes(
  createdAt: string | null | undefined,
  hasExistingCertification: boolean,
): boolean {
  if (hasExistingCertification || !createdAt) return false;

  const createdAtMs = Date.parse(createdAt);
  const cutoffMs = Date.parse(CERTIFICATION_QUIZ_CUTOFF_ISO);
  return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
}

/**
 * Members can download and print their certificate immediately, so a database
 * proof upload never waits for a mailed copy to arrive.
 */
export function isDirectoryUploadAvailable(issuedAt: string | null | undefined): boolean {
  void issuedAt;
  return true;
}
