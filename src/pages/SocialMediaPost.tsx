import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SocialMediaPostAssets } from '@/components/marketing/SocialMediaPostAssets';

export default function SocialMediaPost() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">Hair System Content</h1>
          <p className="text-muted-foreground mt-2">
            Ready-to-use image assets for your social posts. Tap any image to download.
          </p>
        </div>
        <SocialMediaPostAssets />
      </div>
    </DashboardLayout>
  );
}
