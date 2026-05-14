import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useModuleFiles, useUploadModuleFile, useDeleteModuleFile } from '@/hooks/useModuleFiles';
import { Upload, Trash2, FileText, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModuleFilesManagerProps {
  moduleId: string;
  moduleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModuleFilesManager({ moduleId, moduleName, open, onOpenChange }: ModuleFilesManagerProps) {
  const { data: files = [], isLoading } = useModuleFiles(moduleId);
  const uploadFile = useUploadModuleFile();
  const deleteFile = useDeleteModuleFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        await uploadFile.mutateAsync({ moduleId, file });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (fileId: string, fileUrl: string) => {
    await deleteFile.mutateAsync({ fileId, moduleId, fileUrl });
  };

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];

  const isImage = (fileType: string | null) =>
    !!fileType && imageExtensions.includes(fileType.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border/50 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Manage Files - {moduleName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gold-gradient text-primary-foreground"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Files
            </Button>
            <p className="text-sm text-muted-foreground">
              Upload any file type (PDF, images, videos, etc.)
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col rounded-lg bg-secondary/30 border border-border/30 overflow-hidden"
                >
                  {isImage(file.file_type) ? (
                    <div className="aspect-square bg-secondary/50">
                      <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square bg-secondary/50 flex items-center justify-center text-primary">
                      <FileText className="w-8 h-8" />
                    </div>
                  )}
                  <div className="p-2 min-w-0 space-y-2">
                    <p className="font-medium text-sm truncate">{file.file_name}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground uppercase truncate">{file.file_type || 'unknown'}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Preview
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(file.id, file.file_url)}
                          disabled={deleteFile.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
