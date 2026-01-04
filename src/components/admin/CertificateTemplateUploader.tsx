import { useState } from 'react';
import { Upload, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import certificateTemplate from '@/assets/certificate-template.png';

export function CertificateTemplateUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadTemplate = async () => {
    setIsUploading(true);
    setError(null);

    try {
      // Fetch the template from the bundled asset
      const response = await fetch(certificateTemplate);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload('template/certificate-template.png', blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      setIsUploaded(true);
      toast.success('Certificate template uploaded successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload template';
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-4">
      <div className="flex items-center gap-3">
        <Upload className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-medium">Certificate Template</h3>
          <p className="text-sm text-muted-foreground">
            Upload the certificate template to storage for certificate generation
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <Button
        onClick={uploadTemplate}
        disabled={isUploading || isUploaded}
        className={isUploaded ? 'bg-green-600 hover:bg-green-700' : ''}
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Uploading...
          </>
        ) : isUploaded ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Template Uploaded
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Upload Template to Storage
          </>
        )}
      </Button>

      <div className="rounded-lg overflow-hidden border border-border max-w-md">
        <img 
          src={certificateTemplate} 
          alt="Certificate Template Preview" 
          className="w-full"
        />
      </div>
    </div>
  );
}
