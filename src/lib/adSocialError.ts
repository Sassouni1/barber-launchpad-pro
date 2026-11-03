export async function adSocialErrorMessage(
  data: { error?: string } | null,
  error: Error | null,
  fallback: string,
): Promise<string> {
  if (typeof data?.error === 'string' && data.error) return data.error;
  const context = error && 'context' in error ? error.context : null;
  if (context instanceof Response) {
    try {
      const body: unknown = await context.clone().json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      // Use the ordinary function error when the response has no JSON body.
    }
  }
  return error?.message || fallback;
}
