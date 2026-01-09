import { useState, useRef } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  file_name: string;
  file_url: string;
}

interface PhotoUploaderProps {
  photos: Photo[];
  onUpload: (file: File) => void;
  onDelete: (photoId: string) => void;
  isUploading: boolean;
  isDeleting: boolean;
}

export function PhotoUploader({
  photos,
  onUpload,
  onDelete,
  isUploading,
  isDeleting,
}: PhotoUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        onUpload(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => onUpload(file));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Upload Photo of Hair System Template</h4>
        <span className={cn(
          "text-sm font-medium px-2 py-0.5 rounded-full",
          photos.length > 0 
            ? "bg-green-500/20 text-green-400" 
            : "bg-amber-500/20 text-amber-400"
        )}>
          {photos.length} uploaded
        </span>
      </div>

      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          isUploading && "opacity-50 pointer-events-none"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        {isUploading ? (
          <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
        ) : (
          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground mt-2">
          {isUploading ? 'Uploading...' : 'Drop images here or click to upload'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload a photo of your hair system template
        </p>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square">
              <img
                src={photo.file_url}
                alt={photo.file_name}
                className="w-full h-full object-cover rounded-lg"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(photo.id);
                }}
                disabled={isDeleting}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upload at least one photo of your hair system template to qualify for certification.
      </p>
    </div>
  );
}
