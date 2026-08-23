import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadWebsiteImage } from '@/hooks/useMemberWebsite';

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  /** Target dimensions of the image slot being replaced. */
  targetWidth: number;
  targetHeight: number;
  currentSrc: string;
  onApply: (url: string) => void;
};

function orientationFor(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  const ratio = width / height;
  if (ratio > 1.15) return 'landscape';
  if (ratio < 0.87) return 'portrait';
  return 'square';
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

export function StayFadedImageDialog({
  open,
  onOpenChange,
  userId,
  targetWidth,
  targetHeight,
  currentSrc,
  onApply,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const [busy, setBusy] = useState<'upload' | 'expand' | null>(null);

  const width = Math.max(320, Math.round(targetWidth || 1024));
  const height = Math.max(320, Math.round(targetHeight || 1024));

  useEffect(() => {
    if (!open) {
      setSource(null);
      setZoom(1);
      setOffsetX(50);
      setOffsetY(50);
    }
  }, [open]);

  // Redraw the crop preview whenever the framing changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(0, 0, width, height);

    const cover = Math.max(width / source.width, height / source.height) * zoom;
    const drawW = source.width * cover;
    const drawH = source.height * cover;
    const x = (width - drawW) * (offsetX / 100);
    const y = (height - drawH) * (offsetY / 100);
    ctx.drawImage(source, x, y, drawW, drawH);
  }, [source, zoom, offsetX, offsetY, width, height]);

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error('Use a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('That image is larger than 12 MB.');
      return;
    }
    try {
      const img = await loadImage(URL.createObjectURL(file));
      setSource(img);
      setZoom(1);
      setOffsetX(50);
      setOffsetY(50);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read that image.');
    }
  };

  const croppedBlob = async (): Promise<Blob> => {
    const canvas = canvasRef.current!;
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Crop failed.'))), 'image/png'),
    );
  };

  const handleUseImage = async () => {
    if (!source) return;
    setBusy('upload');
    try {
      const blob = await croppedBlob();
      const url = await uploadWebsiteImage(userId, new File([blob], 'website-image.png', { type: 'image/png' }));
      onApply(url);
      onOpenChange(false);
      toast.success('Image updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  /** Builds the opaque extension canvas + alpha mask the expansion function expects. */
  const buildExpansionPayload = async () => {
    const img = source ?? (await loadImage(currentSrc));
    const orientation = orientationFor(width, height);
    const size =
      orientation === 'landscape'
        ? { w: 1536, h: 1024 }
        : orientation === 'portrait'
          ? { w: 1024, h: 1536 }
          : { w: 1024, h: 1024 };

    const base = document.createElement('canvas');
    base.width = size.w;
    base.height = size.h;
    const ctx = base.getContext('2d')!;

    // Opaque blurred cover background so gpt-image-2 never sees transparency.
    const cover = Math.max(size.w / img.width, size.h / img.height);
    ctx.filter = 'blur(28px)';
    ctx.drawImage(img, (size.w - img.width * cover) / 2, (size.h - img.height * cover) / 2, img.width * cover, img.height * cover);
    ctx.filter = 'none';

    // Protected, centered original photo.
    const contain = Math.min(size.w / img.width, size.h / img.height) * 0.72;
    const dw = img.width * contain;
    const dh = img.height * contain;
    const dx = (size.w - dw) / 2;
    const dy = (size.h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);

    const mask = document.createElement('canvas');
    mask.width = size.w;
    mask.height = size.h;
    const mctx = mask.getContext('2d')!;
    // Transparent = editable, opaque = protected center photo.
    mctx.clearRect(0, 0, size.w, size.h);
    mctx.fillStyle = '#000000';
    mctx.fillRect(dx, dy, dw, dh);

    return {
      imageDataUrl: base.toDataURL('image/png'),
      maskDataUrl: mask.toDataURL('image/png'),
      orientation,
    };
  };

  const handleExpand = async () => {
    setBusy('expand');
    try {
      const payload = await buildExpansionPayload();
      const { data, error } = await supabase.functions.invoke('website-image-expand', { body: payload });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Image expansion failed.');
      onApply(data.url as string);
      onOpenChange(false);
      toast.success('Expanded image applied');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Image expansion failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace image</DialogTitle>
          <DialogDescription>
            This slot is {width} × {height}px. Upload a photo, frame it, then apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <Upload className="mr-2 h-4 w-4" /> Choose image
          </Button>

          {source ? (
            <div className="space-y-3">
              <canvas
                ref={canvasRef}
                className="w-full rounded-lg border border-border"
                style={{ aspectRatio: `${width} / ${height}` }}
              />
              <div className="space-y-2">
                <Label>Zoom</Label>
                <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={([v]) => setZoom(v)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Horizontal</Label>
                  <Slider value={[offsetX]} min={0} max={100} step={1} onValueChange={([v]) => setOffsetX(v)} />
                </div>
                <div className="space-y-2">
                  <Label>Vertical</Label>
                  <Slider value={[offsetY]} min={0} max={100} step={1} onValueChange={([v]) => setOffsetY(v)} />
                </div>
              </div>
            </div>
          ) : (
            <img src={currentSrc} alt="Current" className="w-full rounded-lg border border-border" />
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleExpand} disabled={!!busy}>
            {busy === 'expand' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Expand with AI
          </Button>
          <Button onClick={handleUseImage} disabled={!source || !!busy}>
            {busy === 'upload' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Use image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
