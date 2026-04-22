import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRLinks, useCreateQRLink, useUpdateQRLink, type QRLink } from '@/hooks/useQRLinks';
import { Loader2, Download, Copy, Save, QrCode } from 'lucide-react';
import { toast } from 'sonner';

// Static HTML redirect page — bypasses the React app entirely for instant redirects.
const REDIRECT_BASE = 'https://member.thebarberlaunch.com/r.html?c=';

// The two permanent QR slots — colors are locked to brand spec.
const SLOTS = [
  { key: 'tan', label: 'Tan QR', color: '#E8D4B8' },
  { key: 'white', label: 'White QR', color: '#FFFFFF' },
] as const;

export default function QRCodes() {
  const { data: links = [], isLoading } = useQRLinks();
  const createMut = useCreateQRLink();
  const [bootstrapping, setBootstrapping] = useState(false);

  // Auto-create the two slots on first visit if they don't exist yet.
  useEffect(() => {
    if (isLoading || bootstrapping) return;
    const missing = SLOTS.filter((s) => !links.some((l) => l.label === s.label));
    if (missing.length === 0) return;

    setBootstrapping(true);
    (async () => {
      for (const slot of missing) {
        try {
          await createMut.mutateAsync({
            label: slot.label,
            destination_url: 'https://example.com',
          });
        } catch (e) {
          console.error('Failed to create slot', slot.label, e);
        }
      }
      setBootstrapping(false);
    })();
  }, [isLoading, links, bootstrapping, createMut]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <QrCode className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">QR Codes</h1>
            <p className="text-sm text-muted-foreground">
              Two permanent QR codes. The QR images never change — only the destination URLs do.
              Both export as true transparent PNGs.
            </p>
          </div>
        </div>

        {isLoading || bootstrapping ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {SLOTS.map((slot) => {
              const link = links.find((l) => l.label === slot.label);
              if (!link) return null;
              return (
                <QRCodeRow
                  key={slot.key}
                  link={link}
                  slotLabel={slot.label}
                  fgColor={slot.color}
                />
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function QRCodeRow({
  link,
  slotLabel,
  fgColor,
}: {
  link: QRLink;
  slotLabel: string;
  fgColor: string;
}) {
  const updateMut = useUpdateQRLink();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [destination, setDestination] = useState(link.destination_url);

  const qrUrl = `${REDIRECT_BASE}/${link.short_code}`;
  const dirty = destination !== link.destination_url;

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ id: link.id, destination_url: destination });
      toast.success('Destination updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrUrl);
    toast.success('Link copied');
  };

  const handleDownloadPNG = () => {
    const SIZE = 1024;
    const off = document.createElement('canvas');
    off.width = SIZE;
    off.height = SIZE;
    const ctx = off.getContext('2d');
    if (!ctx) return;

    const source = canvasRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!source) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, SIZE, SIZE);

    const a = document.createElement('a');
    a.href = off.toDataURL('image/png');
    a.download = `qr-${slotLabel.toLowerCase().replace(/\s+/g, '-')}-${link.short_code}.png`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{slotLabel}</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-[auto_1fr] gap-6">
        <div className="flex flex-col items-center gap-3">
          <div
            ref={canvasRef}
            className="p-3 rounded-lg border border-border"
            style={{
              background:
                'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%) 50% / 16px 16px',
            }}
          >
            <QRCodeCanvas
              value={qrUrl}
              size={180}
              level="L"
              includeMargin={false}
              fgColor={fgColor}
              bgColor="rgba(0,0,0,0)"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download PNG
          </Button>
          <span className="text-xs text-muted-foreground font-mono">{fgColor}</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Destination URL (change this anytime — the QR image stays the same)
            </Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Permanent QR URL (encoded in the image)</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">{qrUrl}</code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {link.scan_count} scan{link.scan_count === 1 ? '' : 's'}
            </span>
            <Button size="sm" onClick={handleSave} disabled={!dirty || updateMut.isPending}>
              {updateMut.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save Destination
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
