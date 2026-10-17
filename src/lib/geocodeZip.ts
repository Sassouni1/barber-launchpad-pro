import { supabase } from '@/integrations/supabase/client';

export async function geocodeZip(zip: string): Promise<{ latitude: number; longitude: number }> {
  const { data, error } = await supabase.functions.invoke('geocode-zip', { body: { zip } });
  if (error) {
    let message = 'ZIP lookup is temporarily unavailable. Your ZIP may be valid; please try again.';
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json();
        if (typeof body.error === 'string') message = body.error;
      } catch { /* Keep the actionable fallback. */ }
    }
    throw new Error(message);
  }
  if (!Number.isFinite(data?.latitude) || !Number.isFinite(data?.longitude)) {
    throw new Error('ZIP lookup is temporarily unavailable. Please try again.');
  }
  return data;
}