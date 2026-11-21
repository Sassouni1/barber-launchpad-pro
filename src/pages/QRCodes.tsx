import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRLinks, useCreateQRLink, useUpdateQRLink, QRLink } from '@/hooks/useQRLinks';
import { usePosterTemplate } from '@/hooks/usePosterTemplate';
import { toast } from 'sonner';
import { Download, QrCode, Check, X, Loader2 } from 'lucide-react';

const BASE_URL = 'https://member.thebarberlaunch.com';

function getRedirectUrl(shortCode: string) {
  return `${BASE_URL}/r/${shortCode}`;
}

/* ─── Poster Preview with QR overlay ─── */
function PosterPreview({ link, posterUrl, qrX, qrY, qrSize }: {
  link: QRLink;
  posterUrl: string;
  qrX: number;
  qrY: number;
  qrSize: number;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const preparedDownloadUrlRef = useRef<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPreparingDownload, setIsPreparingDownload] = useState(true);
  const redirectUrl = getRedirectUrl(link.short_code);
  const fileName = `${link.label.replace(/\s+/g, '-')}-poster.png`;

  useEffect(() => {
    let isCancelled = false;
    let sourceObjectUrl: string | null = null;
    let nextDownloadUrl: string | null = null;

    const preparePosterDownload = async () => {
      setIsPreparingDownload(true);

      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        const qrSvg = qrRef.current?.querySelector('svg');
        if (!qrSvg) throw new Error('QR preview not ready');

        const posterResponse = await fetch(posterUrl);
        if (!posterResponse.ok) throw new Error('Failed to fetch poster template');

        const posterBlob = await posterResponse.blob();
        sourceObjectUrl = URL.createObjectURL(posterBlob);

        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Failed to load poster image'));
          img.src = sourceObjectUrl!;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to create canvas context');
        ctx.drawImage(img, 0, 0);

        const qrCanvas = document.createElement('canvas');
        const qrSizePx = Math.round((qrSize / 100) * canvas.width);
        qrCanvas.width = qrSizePx;
        qrCanvas.height = qrSizePx;
        const qrCtx = qrCanvas.getContext('2d');
        if (!qrCtx) throw new Error('Failed to create QR canvas context');

        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const qrImg = new Image();
        await new Promise<void>((resolve, reject) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = () => reject(new Error('Failed to render QR image'));
          qrImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
        qrCtx.drawImage(qrImg, 0, 0, qrSizePx, qrSizePx);

        const posX = Math.round((qrX / 100) * canvas.width - qrSizePx / 2);
        const posY = Math.round((qrY / 100) * canvas.height - qrSizePx / 2);
        ctx.drawImage(qrCanvas, posX, posY);

        const finalBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to export poster image'));
          }, 'image/png');
        });

        nextDownloadUrl = URL.createObjectURL(finalBlob);
        if (isCancelled) return;

        if (preparedDownloadUrlRef.current) {
          URL.revokeObjectURL(preparedDownloadUrlRef.current);
        }
        preparedDownloadUrlRef.current = nextDownloadUrl;
        setDownloadUrl(nextDownloadUrl);
        nextDownloadUrl = null;
      } catch (error) {
        console.error(error);
        if (!isCancelled) {
          setDownloadUrl(null);
        }
      } finally {
        if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
        if (nextDownloadUrl) URL.revokeObjectURL(nextDownloadUrl);
        if (!isCancelled) setIsPreparingDownload(false);
      }
    };

    preparePosterDownload();

    return () => {
      isCancelled = true;
      if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
      if (nextDownloadUrl) URL.revokeObjectURL(nextDownloadUrl);
    };
  }, [posterUrl, qrX, qrY, qrSize, redirectUrl]);

  useEffect(() => {
    return () => {
      if (preparedDownloadUrlRef.current) {
        URL.revokeObjectURL(preparedDownloadUrlRef.current);
      }
    };
  }, []);

  const handleDownload = useCallback(() => {
    if (!downloadUrl) {
      toast.error(isPreparingDownload ? 'Still preparing poster...' : 'Poster is not ready to download yet');
      return;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('Poster downloaded!');
  }, [downloadUrl, fileName, isPreparingDownload]);

  return (
    <div className="space-y-4">
      {/* Visual preview */}
      <div className="relative w-full max-w-xs mx-auto rounded-xl overflow-hidden border border-border/50 shadow-lg">
        <img src={posterUrl} alt="Poster" className="w-full" draggable={false} />
        <div
          ref={qrRef}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${qrX}%`,
            top: `${qrY}%`,
            width: `${qrSize}%`,
          }}
        >
          <QRCodeSVG value={redirectUrl} size={512} level="L" fgColor="#d8d1c4" bgColor="transparent" className="w-full h-auto" />
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={handleDownload} size="lg" disabled={isPreparingDownload || !downloadUrl}>
          {isPreparingDownload ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Poster...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" /> Download Poster
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─── QR Link Manager Card ─── */
function QRLinkCard({ link, posterUrl, qrX, qrY, qrSize }: {
  link: QRLink;
  posterUrl: string | null;
  qrX: number;
  qrY: number;
  qrSize: number;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(link.label);
  const [editUrl, setEditUrl] = useState(link.destination_url);
  const updateMutation = useUpdateQRLink();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: link.id, label: editLabel, destination_url: editUrl });
      toast.success('QR code updated');
      setEditing(false);
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-semibold">{link.label}</h2>
      {/* Destination URL — always visible */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">QR destination link</Label>
        <div className="flex gap-2">
          <Input
            value={editUrl}
            onChange={e => { setEditUrl(e.target.value); setEditing(true); }}
            placeholder="Paste your Google review link"
            className="bg-secondary/50 flex-1"
          />
          {editing && (
            <>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                <Check className="w-4 h-4 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditUrl(link.destination_url); }}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
        
      </div>

      {/* Compact poster preview */}
      {posterUrl && (
        <PosterPreview link={link} posterUrl={posterUrl} qrX={qrX} qrY={qrY} qrSize={qrSize} />
      )}

    </div>
  );
}

/* ─── Main Page ─── */
export default function QRCodes() {
  const { data: links = [], isLoading } = useQRLinks();
  const { data: poster } = usePosterTemplate();
  const createMutation = useCreateQRLink();
  const [url, setUrl] = useState('');

  const posterUrl = poster?.image_url ?? null;
  const hasReviewLink = links.some(
    (link) => /review/i.test(link.label) && link.destination_url !== 'https://example.com',
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    let dest = url.trim();
    if (!/^https?:\/\//i.test(dest)) dest = 'https://' + dest;
    try {
      await createMutation.mutateAsync({ label: 'Google Reviews', destination_url: dest });
      toast.success('QR code created!');
      setUrl('');
    } catch { toast.error('Failed to create QR code'); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" /> QR Section
          </h1>
          <p className="text-muted-foreground mt-1">Set the destination for your QR code. For your review sign, use your Google review link. You can update where it points later without reprinting.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {links.map((link) => (
              <Card key={link.id} className="glass-card border-border/50">
                <CardContent className="p-6">
                  <QRLinkCard
                    link={link}
                    posterUrl={posterUrl}
                    qrX={poster?.qr_x ?? 50}
                    qrY={poster?.qr_y ?? 50}
                    qrSize={poster?.qr_size ?? 15}
                  />
                </CardContent>
              </Card>
            ))}
            {!hasReviewLink && (
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Add a Google review QR code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-url">Google review link</Label>
                  <Input id="qr-url" placeholder="Paste your Google review link" value={url} onChange={e => setUrl(e.target.value)} className="bg-secondary/50" />
                </div>
                <Button type="submit" disabled={createMutation.isPending || !url.trim()}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Create QR Code
                </Button>
              </form>
            </CardContent>
          </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
