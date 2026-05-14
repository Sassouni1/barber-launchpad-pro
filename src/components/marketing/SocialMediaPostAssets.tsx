import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Image as ImageIcon, Loader2 } from 'lucide-react';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

interface AssetFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

export function SocialMediaPostAssets() {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['social-media-post-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_files')
        .select('id, file_name, file_url, file_type')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const images = (data as AssetFile[]).filter(
        (f) => f.file_type && IMAGE_EXTS.includes(f.file_type.toLowerCase())
      );
      const seen = new Set<string>();
      return images.filter((f) => {
        const key = f.file_name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    staleTime: 300000,
  });

  const download = (url: string, name: string) => {
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-file?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Social Media Post
        </h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">{files.length} assets</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No image assets yet.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {files.map((f) => (
            <div
              key={f.id}
              className="group relative rounded-lg overflow-hidden border border-border/50 bg-secondary/30"
            >
              <div className="aspect-square">
                <img
                  src={f.file_url}
                  alt={f.file_name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => download(f.file_url, f.file_name)}
                className="absolute bottom-1.5 right-1.5 h-7 w-7"
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
