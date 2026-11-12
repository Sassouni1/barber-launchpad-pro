import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileDownloadButton } from '@/components/ui/file-download-button';
import { supabase } from '@/integrations/supabase/client';
import { renderAnnouncementPostImage } from '@/lib/announcementPostImage';

export function AnnouncementPostImage({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { data: city, isPending: loadingCity, error: cityError } = useQuery({
    queryKey: ['announcement-post-city', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_onboarding_profiles')
        .select('service_city').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data?.service_city?.trim() || '';
    },
    staleTime: 0,
    refetchInterval: 10_000,
  });
  const { data: imageUrl, isPending: rendering, error: imageError } = useQuery({
    queryKey: ['announcement-post-image', userId, city],
    queryFn: () => renderAnnouncementPostImage(city!),
    enabled: !!city,
    staleTime: Infinity,
  });

  return <section className="glass-card rounded-2xl p-4 sm:p-6 space-y-4" aria-labelledby="announcement-image-title">
    <div>
      <h2 id="announcement-image-title" className="font-display text-lg font-semibold">Your first carousel post</h2>
      <p className="text-sm text-muted-foreground">Save both images and upload them in this order.</p>
    </div>
    {loadingCity && <p className="text-sm text-muted-foreground">Loading your location…</p>}
    {cityError && <p role="alert" className="text-sm text-destructive">Could not load your dashboard city. Please try again.</p>}
    {!loadingCity && !cityError && !city && <div className="space-y-3">
      <p className="text-sm">Add your city and state on the dashboard to make your announcement image.</p>
      <Button variant="outline" onClick={() => navigate('/dashboard')}>Go to dashboard</Button>
    </div>}
    {city && rendering && <p className="text-sm text-muted-foreground">Preparing your image…</p>}
    {imageError && <p role="alert" className="text-sm text-destructive">Could not prepare the image. Please try again.</p>}
    {imageUrl && <div className="grid gap-4 sm:gap-6 sm:grid-cols-[repeat(2,minmax(0,247px))]">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Slide 1 · Announcement</p>
        <img src={imageUrl} alt={`Hair systems announcement for ${city}`} className="w-full max-w-[195px] sm:max-w-[247px] rounded-lg" />
        <FileDownloadButton url={imageUrl} filename="01-hair-systems-announcement.png" label="Save slide 1" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Slide 2 · Before and after</p>
        <img src="/lesson-assets/posts/hair-system-before-after-slide-2.png" alt="Before and after hair system result" className="w-full max-w-[195px] sm:max-w-[247px] rounded-lg" />
        <FileDownloadButton url="/lesson-assets/posts/hair-system-before-after-slide-2.png" filename="02-hair-system-before-after.png" label="Save slide 2" />
      </div>
    </div>}
  </section>;
}
