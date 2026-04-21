import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRLinks, useCreateQRLink, useUpdateQRLink, useDeleteQRLink, type QRLink } from '@/hooks/useQRLinks';
import { Loader2, Download, Copy, Trash2, Save, QrCode } from 'lucide-react';
import { toast } from 'sonner';

const REDIRECT_BASE = `${window.location.origin}/r`;

export default function QRCodes() {
  const { data: links = [], isLoading } = useQRLinks();
  const createMut = useCreateQRLink();

  const [label, setLabel] = useState('');
  const [destination, setDestination] = useState('');

  const handleCreate = async () => {
    if (!label.trim() || !destination.trim()) {
      toast.error('Label and destination URL are required');
      return;
    }
    try {
      await createMut.mutateAsync({ label: label.trim(), destination_url: destination.trim() });
      setLabel('');
      setDestination('');
      toast.success('QR code created — short code is permanent');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create QR code');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <QrCode className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">QR Codes</h1>
            <p className="text-sm text-muted-foreground">
              Create permanent QR codes. The QR image never changes — only the destination URL does.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create New QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="label">Label (internal name)</Label>
                <Input
                  id="label"
                  placeholder="e.g. Booth Banner"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dest">Destination URL</Label>
                <Input
                  id="dest"
                  placeholder="https://example.com/landing"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create QR Code
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No QR codes yet. Create one above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {links.map((link) => (
              <QRCodeRow key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function QRCodeRow({ link }: { link: QRLink }) {
  const updateMut = useUpdateQRLink();
  const deleteMut = useDeleteQRLink();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [label, setLabel] = useState(link.label);
  const [destination, setDestination] = useState(link.destination_url);
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [transparent, setTransparent] = useState(true);

  const qrUrl = `${REDIRECT_BASE}/${link.short_code}`;
  const dirty = label !== link.label || destination !== link.destination_url;
  const previewBg = transparent ? 'transparent' : bgColor;

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({ id: link.id, label, destination_url: destination });
      toast.success('Updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrUrl);
    toast.success('Link copied');
  };

  const handleDownloadPNG = () => {
    // Render a high-res off-screen canvas for crisp print quality
    const SIZE = 1024;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = SIZE;
    offCanvas.height = SIZE;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    // Find the on-screen QR canvas to use as a source
    const sourceCanvas = canvasRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!sourceCanvas) return;

    if (!transparent) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }
    // Draw QR scaled up — qrcode.react renders with the bg color we passed,
    // so when transparent=true we set bg to 'transparent' on the component.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sourceCanvas, 0, 0, SIZE, SIZE);

    const a = document.createElement('a');
    a.href = offCanvas.toDataURL('image/png');
    a.download = `qr-${link.label.replace(/\s+/g, '-').toLowerCase()}-${link.short_code}.png`;
    a.click();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${link.label}"? The QR code printed anywhere will stop working.`)) return;
    try {
      await deleteMut.mutateAsync(link.id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 grid md:grid-cols-[auto_1fr] gap-6">
        <div className="flex flex-col items-center gap-3">
          <div
            ref={canvasRef}
            className="p-3 rounded-lg border border-border"
            style={{
              background: transparent
                ? 'repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--background)) 0% 50%) 50% / 16px 16px'
                : bgColor,
            }}
          >
            <QRCodeCanvas
              value={qrUrl}
              size={160}
              level="H"
              includeMargin={false}
              fgColor={fgColor}
              bgColor={transparent ? 'rgba(0,0,0,0)' : bgColor}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Download PNG
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Destination URL (you can change this anytime)</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">QR color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer"
                />
                <Input value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Background</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={transparent}
                  className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer disabled:opacity-40"
                />
                <Input
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={transparent}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transparent BG</Label>
              <label className="flex items-center gap-2 h-9 px-3 rounded border border-border cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                  className="accent-primary"
                />
                <span className="text-xs">{transparent ? 'On (true PNG)' : 'Off'}</span>
              </label>
            </div>
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
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || updateMut.isPending}>
                {updateMut.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                )}
                Save
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
