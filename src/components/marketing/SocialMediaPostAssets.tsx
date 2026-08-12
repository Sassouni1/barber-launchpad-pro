import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Image as ImageIcon, Loader2, MapPin } from 'lucide-react';

const LOCATION_KEY = 'hair-system-content-location';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

interface AssetFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

const normalizeAssetKey = (file: AssetFile) => {
  const decodedUrl = decodeURIComponent(file.file_url).toLowerCase().split('?')[0];
  const storagePath = decodedUrl.split('/course-files/').pop() || decodedUrl;
  const normalizedPath = storagePath.replace(/^\/?[^/]+\/\d{10,}-/, '').replace(/^\/?shared-marketing\//, '');
  return `${normalizedPath}|${file.file_name.toLowerCase().trim()}`;
};

export function SocialMediaPostAssets() {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCATION_KEY) || '{}');
      if (saved.city) setCity(saved.city);
      if (saved.state) setStateCode(saved.state);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCATION_KEY, JSON.stringify({ city, state: stateCode }));
  }, [city, stateCode]);

  const locationLabel = [city.trim(), stateCode.trim().toUpperCase()].filter(Boolean).join(', ');

  const displayName = (name: string) =>
    locationLabel
      ? name.replace(/\(\s*your\s+city(?:\s*,?\s*your\s+state)?\s*\)/gi, `(${locationLabel})`)
      : name;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['social-media-post-assets', 'deduped-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('module_files')
        .select('id, file_name, file_url, file_type')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const images = (data as AssetFile[]).filter(
        (f) => {
          const type = f.file_type?.toLowerCase();
          const ext = f.file_url.split('?')[0].split('.').pop()?.toLowerCase();
          return (type && IMAGE_EXTS.includes(type)) || (ext && IMAGE_EXTS.includes(ext));
        }
      );
      const seen = new Set<string>();
      return images.filter((f) => {
        const key = normalizeAssetKey(f);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    staleTime: 300000,
  });

  const download = (file: AssetFile) => {
    setSavingId(file.id);
    const outName = displayName(file.file_name);
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-file?url=${encodeURIComponent(file.file_url)}&name=${encodeURIComponent(outName)}`;
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.download = outName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => setSavingId(null), 600);
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Hair System Content
        </h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">{files.length} assets</span>
        )}
      </div>

      <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <MapPin className="w-3.5 h-3.5 text-primary" /> Your Location
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="asset-city" className="text-xs">City</Label>
            <Input
              id="asset-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Dallas"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asset-state" className="text-xs">State</Label>
            <Input
              id="asset-state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.slice(0, 2))}
              placeholder="TX"
              maxLength={2}
              className="h-10 uppercase"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {locationLabel
            ? `Downloads will be named for ${locationLabel} automatically.`
            : 'Add your city and state and downloads will use it instead of "Your City".'}
        </p>
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
            <div key={f.id} className="rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
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
                size="sm"
                onClick={() => download(f)}
                disabled={savingId === f.id}
                className="h-9 w-full rounded-none border-t border-border/50"
              >
                {savingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {savingId === f.id ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
