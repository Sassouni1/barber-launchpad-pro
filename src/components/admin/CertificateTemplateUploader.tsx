import { useRef, useState } from 'react';
import { Upload, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import certificateTemplate from '@/assets/certificate-template.jpg';

export function CertificateTemplateUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadBlob = async (blob: Blob, contentType: string) => {
    setIsUploading(true);
    setError(null);
    try {
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload('template/certificate-template.png', blob, {
          contentType,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('certificates')
        .getPublicUrl('template/certificate-template.png');
      setUploadedUrl(`${data.publicUrl}?t=${Date.now()}`);
      toast.success('Certificate template uploaded successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload template';
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const uploadDefault = async () => {
    const response = await fetch(certificateTemplate);
    const blob = await response.blob();
    await uploadBlob(blob, 'image/png');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadBlob(file, file.type || 'image/png');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-4">
      <div className="flex items-center gap-3">
        <Upload className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-medium">Certificate Template</h3>
          <p className="text-sm text-muted-foreground">
            Upload your own certificate template, or use the default bundled template.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {uploadedUrl && !error && (
        <div className="flex items-center gap-2 text-green-500 text-sm">
          <Check className="w-4 h-4" />
          Template uploaded
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload New Template
            </>
          )}
        </Button>
        <Button variant="outline" onClick={uploadDefault} disabled={isUploading}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Default
        </Button>
      </div>

      <div className="rounded-lg overflow-hidden border border-border max-w-md">
        <img
          src={uploadedUrl ?? certificateTemplate}
          alt="Certificate Template Preview"
          className="w-full"
        />
      </div>
    </div>
  );
}
