import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SavedMarketingImage {
  id: string;
  public_url: string;
  variation_type: string;
  caption: string | null;
  website_url: string | null;
  created_at: string;
}

export function useMarketingImages() {
  const { user } = useAuth();
  const [savedImages, setSavedImages] = useState<SavedMarketingImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchImages = useCallback(async () => {
    if (!user) { setSavedImages([]); setIsLoading(false); return; }
    const { data } = await supabase
      .from('marketing_images')
      .select('*')
      .order('created_at', { ascending: false });
    setSavedImages((data as SavedMarketingImage[]) || []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchImages();
    // Trigger cleanup on load (fire-and-forget)
    supabase.functions.invoke('cleanup-marketing-images').catch(() => {});
  }, [fetchImages]);

  const saveImage = useCallback(async (
    base64DataUrl: string,
    variationType: string,
    caption: string,
    websiteUrl: string
  ): Promise<string | null> => {
    if (!user) return null;
    try {
      // Convert base64 data URL to blob
      const res = await fetch(base64DataUrl);
      const blob = await res.blob();
      const ext = blob.type.includes('png') ? 'png' : 'jpg';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(fileName, blob, { contentType: blob.type });

      if (uploadError) { console.error('Upload error:', uploadError); return null; }

      const { data: urlData } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: insertError } = await supabase
        .from('marketing_images')
        .insert({
          user_id: user.id,
          storage_path: fileName,
          public_url: publicUrl,
          variation_type: variationType,
          caption,
          website_url: websiteUrl,
        });

      if (insertError) { console.error('Insert error:', insertError); return null; }

      // Add to local state
      setSavedImages(prev => [{
        id: crypto.randomUUID(),
        public_url: publicUrl,
        variation_type: variationType,
        caption,
        website_url: websiteUrl,
        created_at: new Date().toISOString(),
      }, ...prev]);

      return publicUrl;
    } catch (err) {
      console.error('Save image error:', err);
      return null;
    }
  }, [user]);

  const deleteImage = useCallback(async (id: string) => {
    await supabase.from('marketing_images').delete().eq('id', id);
    setSavedImages(prev => prev.filter(img => img.id !== id));
  }, []);

  return { savedImages, isLoading, saveImage, deleteImage, refetch: fetchImages };
}
