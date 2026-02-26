import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRLinks, useCreateQRLink, useUpdateQRLink, useDeleteQRLink, QRLink } from '@/hooks/useQRLinks';
import { usePosterTemplate } from '@/hooks/usePosterTemplate';
import { toast } from 'sonner';
import { Download, Pencil, Trash2, QrCode, Check, X, Loader2, Image as ImageIcon } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const BASE_URL = 'https://barber-launchpad-pro.lovable.app';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const redirectUrl = getRedirectUrl(link.short_code);

  const handleDownload = useCallback(async () => {
    try {
      // Load poster image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = posterUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      // Render QR to canvas
      const qrSvg = qrRef.current?.querySelector('svg');
      if (qrSvg) {
        const qrCanvas = document.createElement('canvas');
        const qrSize_px = Math.round((qrSize / 100) * canvas.width);
        qrCanvas.width = qrSize_px;
        qrCanvas.height = qrSize_px;
        const qrCtx = qrCanvas.getContext('2d')!;

        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const qrImg = new Image();
        await new Promise<void>((resolve, reject) => {
          qrImg.onload = () => resolve();
          qrImg.onerror = reject;
          qrImg.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
        qrCtx.drawImage(qrImg, 0, 0, qrSize_px, qrSize_px);

        // Position QR on poster (centered on the x/y point)
        const posX = Math.round((qrX / 100) * canvas.width - qrSize_px / 2);
        const posY = Math.round((qrY / 100) * canvas.height - qrSize_px / 2);
        ctx.drawImage(qrCanvas, posX, posY);
      }

      const a = document.createElement('a');
      a.download = `${link.label.replace(/\s+/g, '-')}-poster.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast.success('Poster downloaded!');
    } catch {
      toast.error('Failed to generate poster');
    }
  }, [posterUrl, qrX, qrY, qrSize, link]);

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
        <Button onClick={handleDownload} size="lg">
          <Download className="w-4 h-4 mr-2" /> Download Poster
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
  const deleteMutation = useDeleteQRLink();

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ id: link.id, label: editLabel, destination_url: editUrl });
      toast.success('QR code updated');
      setEditing(false);
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(link.id);
      toast.success('QR code deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="space-y-5">
      {/* Destination URL — always visible */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Your Website / Link</Label>
        <div className="flex gap-2">
          <Input
            value={editUrl}
            onChange={e => { setEditUrl(e.target.value); setEditing(true); }}
            placeholder="https://instagram.com/yourbiz"
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
  const deleteMutation = useDeleteQRLink();
  const [url, setUrl] = useState('');

  const posterUrl = poster?.image_url ?? null;
  const existingLink = links[0] ?? null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    let dest = url.trim();
    if (!/^https?:\/\//i.test(dest)) dest = 'https://' + dest;
    try {
      await createMutation.mutateAsync({ label: 'My QR Code', destination_url: dest });
      toast.success('QR code created!');
      setUrl('');
    } catch { toast.error('Failed to create QR code'); }
  };

  const handleRedo = async () => {
    if (!existingLink) return;
    try {
      await deleteMutation.mutateAsync(existingLink.id);
      toast.success('QR code removed — create a new one below');
    } catch { toast.error('Failed to remove QR code'); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" /> QR Poster
          </h1>
          <p className="text-muted-foreground mt-1">Generate your QR code poster — update where it links anytime without reprinting.</p>
        </div>

        {/* No poster template warning */}
        {!posterUrl && (
          <Card className="glass-card border-border/50">
            <CardContent className="p-8 text-center space-y-3">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No poster template has been set up yet. Ask your admin to upload one.</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : existingLink ? (
          <Card className="glass-card border-border/50">
            <CardContent className="p-6">
              <QRLinkCard
                link={existingLink}
                posterUrl={posterUrl}
                qrX={poster?.qr_x ?? 50}
                qrY={poster?.qr_y ?? 50}
                qrSize={poster?.qr_size ?? 15}
              />
              <div className="flex justify-end mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Trash2 className="w-4 h-4 mr-1" /> Start Over
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start over?</AlertDialogTitle>
                      <AlertDialogDescription>This will delete your current QR code. Anyone who already scanned it will see "Link Not Found". You can create a new one right after.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRedo}>Delete &amp; Start Over</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Create Your QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-url">Your Website / Link</Label>
                  <Input id="qr-url" placeholder="https://instagram.com/yourbiz" value={url} onChange={e => setUrl(e.target.value)} className="bg-secondary/50" />
                </div>
                <Button type="submit" disabled={createMutation.isPending || !url.trim()}>
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                  Generate QR Poster
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
