import { useState, useRef } from 'react';
import { Upload, Loader2, Image as ImageIcon, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { usePosterTemplate, useUpdatePosterTemplate, PosterTemplate } from '@/hooks/usePosterTemplate';
import { QRCodeSVG } from 'qrcode.react';

export function PosterTemplateManager() {
  const { data: template, isLoading } = usePosterTemplate();
  const updateMutation = useUpdatePosterTemplate();
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [localTemplate, setLocalTemplate] = useState<PosterTemplate | null>(null);
  const current = localTemplate ?? template ?? { image_url: null, qr_x: 50, qr_y: 50, qr_size: 15 };

  // Sync when template loads
  if (template && !localTemplate) {
    // Will set on next interaction
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `poster-template.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('poster-templates')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('poster-templates').getPublicUrl(path);
      const newTemplate = { ...current, image_url: urlData.publicUrl + '?t=' + Date.now() };
      setLocalTemplate(newTemplate);
      await updateMutation.mutateAsync(newTemplate);
      toast.success('Poster template uploaded!');
    } catch (err) {
      toast.error('Failed to upload poster template');
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePositionChange = (field: 'qr_x' | 'qr_y' | 'qr_size', value: number) => {
    setLocalTemplate({ ...current, [field]: value });
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(current);
      toast.success('Poster settings saved!');
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const handlePosterClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Use the image container (currentTarget) for bounding rect
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
    const updated = { ...current, qr_x: x, qr_y: y };
    setLocalTemplate(updated);
  };

  if (isLoading) return <Loader2 className="w-5 h-5 animate-spin text-primary" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <ImageIcon className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-medium">QR Code Poster Template</h3>
          <p className="text-sm text-muted-foreground">
            Upload a poster image and set where the QR code will appear for members.
          </p>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={isUploading}>
        {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        {current.image_url ? 'Replace Image' : 'Upload Poster Image'}
      </Button>

      {current.image_url && (
        <>
          {/* Preview with QR overlay — click to reposition */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Click on the poster to set QR position</Label>
            <div
              className="relative w-full max-w-md rounded-lg overflow-hidden border border-border cursor-crosshair"
              onClick={handlePosterClick}
            >
              <img src={current.image_url} alt="Poster template" className="w-full pointer-events-none select-none" draggable={false} />
              {/* QR preview indicator */}
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none border-2 border-primary rounded-sm bg-primary/10"
                style={{
                  left: `${current.qr_x}%`,
                  top: `${current.qr_y}%`,
                  width: `${current.qr_size}%`,
                  paddingBottom: `${current.qr_size}%`,
                }}
              />
            </div>
          </div>

          {/* QR size slider */}
          <div className="space-y-2 max-w-md">
            <Label>QR Code Size: {current.qr_size}%</Label>
            <Slider
              value={[current.qr_size]}
              onValueChange={([v]) => handlePositionChange('qr_size', v)}
              min={5}
              max={40}
              step={1}
            />
          </div>

          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Position
          </Button>
        </>
      )}
    </div>
  );
}
