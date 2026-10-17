import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Image as ImageIcon, Loader2, MapPin } from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';
import { FileDownloadButton } from '@/components/ui/file-download-button';
import { deliverFile, fetchDownload } from '@/lib/fileDownloads';

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
  const [archive, setArchive] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
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

  useEffect(() => { setArchive(null); }, [locationLabel]);

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

  const downloadAll = async () => {
    if (archive) { void deliverFile(archive, `Hair System Content${locationLabel ? ` - ${locationLabel}` : ''}.zip`); return; }
    setPreparing(true);
    setProgress(0);
    try {
      const zip = new JSZip();
      for (let i = 0; i < files.length; i += 3) {
        await Promise.all(files.slice(i, i + 3).map(async (file, offset) => {
          const blob = await fetchDownload(file.file_url);
          zip.file(`${String(i + offset + 1).padStart(3, '0')}-${displayName(file.file_name).replace(/[/\\]/g, '-')}`, blob);
          setProgress(value => value + 1);
        }));
      }
      setArchive(await zip.generateAsync({ type: 'blob', compression: 'STORE' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not prepare images');
    } finally { setPreparing(false); }
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Hair System Content
        </h2>
        {!isLoading && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{files.length} assets</span>
            <Button size="sm" onClick={downloadAll} disabled={preparing || files.length === 0}>
              {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {preparing ? `${progress}/${files.length}` : archive ? 'Download All' : 'Download All'}
            </Button>
          </div>
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
              disabled={preparing}
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
              disabled={preparing}
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

      {archive && <p role="status" className="text-xs text-muted-foreground">Images ready. Tap Download All to save the ZIP file.</p>}


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
                  alt={displayName(f.file_name)}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
              <FileDownloadButton
                url={f.file_url}
                filename={displayName(f.file_name)}
                className="h-9 w-full rounded-none border-t border-border/50"
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
