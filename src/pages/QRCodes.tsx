import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRLinks, useCreateQRLink, useUpdateQRLink, useDeleteQRLink, QRLink } from '@/hooks/useQRLinks';
import { toast } from 'sonner';
import { Plus, Download, Copy, Pencil, Trash2, ExternalLink, QrCode, BarChart3, Check, X, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const BASE_URL = 'https://barber-launchpad-pro.lovable.app';

function getRedirectUrl(shortCode: string) {
  return `${BASE_URL}/r/${shortCode}`;
}

function QRCodeCard({ link }: { link: QRLink }) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(link.label);
  const [editUrl, setEditUrl] = useState(link.destination_url);
  const updateMutation = useUpdateQRLink();
  const deleteMutation = useDeleteQRLink();
  const qrRef = useRef<HTMLDivElement>(null);

  const redirectUrl = getRedirectUrl(link.short_code);

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      // Keep transparent background (no fill)
      ctx?.drawImage(img, 0, 0, 512, 512);
      const a = document.createElement('a');
      a.download = `${link.label.replace(/\s+/g, '-')}-qr.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [link.label]);

  const handleCopy = () => {
    navigator.clipboard.writeText(redirectUrl);
    toast.success('Link copied!');
  };

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
    <Card className="glass-card border-border/50">
      <CardContent className="p-5">
        <div className="flex gap-5">
          {/* QR Code */}
          <div ref={qrRef} className="flex-shrink-0 rounded-lg p-3" style={{ backgroundColor: 'transparent' }}>
            <QRCodeSVG value={redirectUrl} size={120} level="L" fgColor="#d8d1c4" bgColor="transparent" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {editing ? (
              <div className="space-y-2">
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="Label" className="bg-secondary/50" />
                <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="Destination URL" className="bg-secondary/50" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                    <Check className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditLabel(link.label); setEditUrl(link.destination_url); }}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-foreground truncate">{link.label}</h3>
                <a href={link.destination_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex items-center gap-1">
                  {link.destination_url} <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {link.scan_count} scan{link.scan_count !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleDownload}><Download className="w-4 h-4 mr-1" /> Download</Button>
            <Button size="sm" variant="outline" onClick={handleCopy}><Copy className="w-4 h-4 mr-1" /> Copy Link</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="w-4 h-4 mr-1" /> Edit</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete QR Code?</AlertDialogTitle>
                  <AlertDialogDescription>Anyone who scans this QR code will see "Link Not Found". This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function QRCodes() {
  const { data: links = [], isLoading } = useQRLinks();
  const createMutation = useCreateQRLink();
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !url.trim()) return;
    let dest = url.trim();
    if (!/^https?:\/\//i.test(dest)) dest = 'https://' + dest;
    try {
      await createMutation.mutateAsync({ label: label.trim(), destination_url: dest });
      toast.success('QR code created!');
      setLabel('');
      setUrl('');
    } catch { toast.error('Failed to create QR code'); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <QrCode className="w-8 h-8 text-primary" /> QR Codes
          </h1>
          <p className="text-muted-foreground mt-1">Create QR codes that work forever. Change the destination anytime without reprinting.</p>
        </div>

        {/* Create form */}
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Create New QR Code</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qr-label">Label</Label>
                  <Input id="qr-label" placeholder="e.g. Instagram, Booking Page" value={label} onChange={e => setLabel(e.target.value)} className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qr-url">Destination URL</Label>
                  <Input id="qr-url" placeholder="https://instagram.com/yourbiz" value={url} onChange={e => setUrl(e.target.value)} className="bg-secondary/50" />
                </div>
              </div>
              <Button type="submit" disabled={createMutation.isPending || !label.trim() || !url.trim()}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create QR Code
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No QR codes yet. Create your first one above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {links.map(link => <QRCodeCard key={link.id} link={link} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
