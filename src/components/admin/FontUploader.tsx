import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function FontUploader() {
  const [uploading, setUploading] = useState(false);
  const [fontUrl, setFontUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkExistingFont = async () => {
    const { data } = supabase.storage
      .from('certificates')
      .getPublicUrl('fonts/OldeEnglish.ttf');
    
    // Check if the font exists by fetching it
    try {
      const response = await fetch(data.publicUrl, { method: 'HEAD' });
      if (response.ok) {
        setFontUrl(data.publicUrl);
      }
    } catch {
      // Font doesn't exist yet
    }
  };

  useState(() => {
    checkExistingFont();
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ttf') && !file.name.endsWith('.otf')) {
      toast.error('Please upload a TTF or OTF font file');
      return;
    }

    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from('certificates')
        .upload('fonts/OldeEnglish.ttf', file, {
          contentType: 'font/ttf',
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from('certificates')
        .getPublicUrl('fonts/OldeEnglish.ttf');

      setFontUrl(data.publicUrl);
      toast.success('Font uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload font');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Certificate Font
          {fontUrl && <Check className="h-5 w-5 text-green-500" />}
        </CardTitle>
        <CardDescription>
          Upload the Old English font for certificate generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf"
          onChange={handleUpload}
          className="hidden"
        />
        
        {fontUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Font is configured
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Replace Font'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              No font uploaded - certificates will use fallback font
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload Font'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
