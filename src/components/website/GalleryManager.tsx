import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDown, ArrowUp, ImagePlus, Link2, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { GalleryPhoto } from '@/lib/websiteEditor';

export const GALLERY_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const GALLERY_MAX_BYTES = 12 * 1024 * 1024;

type Props = {
  title: string;
  photos: GalleryPhoto[];
  max?: number;
  /** True while photos are uploading — controls stay visible but disabled. */
  busy: boolean;
  shareUrl: string | null;
  onAdd: (files: File[]) => void;
  onReplace: (photo: GalleryPhoto) => void;
  onMove: (photo: GalleryPhoto, direction: 'earlier' | 'later') => void;
  onRemove: (photo: GalleryPhoto) => void;
  onDescribe: (photo: GalleryPhoto, description: string) => void;
  onShare: () => void;
};

/**
 * Photo-gallery workflow for a configured repeatable image group: add real
 * photos, arrange them, describe them, remove them, and share the published
 * gallery. Rendered inline under the preview so small screens never get another
 * full-screen modal.
 */
export function GalleryManager({
  title,
  photos,
  max,
  busy,
  shareUrl,
  onAdd,
  onReplace,
  onMove,
  onRemove,
  onDescribe,
  onShare,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const atMax = !!max && photos.length >= max;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {photos.length} photo{photos.length === 1 ? '' : 's'}
          {max ? ` of up to ${max}` : ''}. Changes here are saved to your draft — only{' '}
          <span className="font-medium text-foreground">Save &amp; publish</span> puts them on your live website.
        </p>

        <input
          ref={fileRef}
          type="file"
          multiple
          accept={GALLERY_MIME.join(',')}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (files.length) onAdd(files);
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-9"
            onClick={() => fileRef.current?.click()}
            disabled={busy || atMax}
            aria-label="Add photos to the gallery"
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            Add photos
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9"
            onClick={onShare}
            disabled={!shareUrl}
            aria-label="Copy the link to your published photo gallery"
          >
            <Link2 className="mr-2 h-4 w-4" /> Copy gallery link
          </Button>
        </div>

        {atMax && (
          <p className="text-xs text-destructive">
            You have reached the {max}-photo limit. Remove a photo before adding another.
          </p>
        )}
        {!shareUrl && (
          <p className="text-xs text-muted-foreground">
            The gallery link becomes available once your website has been published.
          </p>
        )}

        <ul className="space-y-2">
          {photos.map((photo, index) => (
            <li
              key={photo.imageKey}
              className="flex flex-wrap items-start gap-2 rounded-md border border-border bg-muted/30 p-2"
            >
              <img
                src={photo.src}
                alt={photo.alt || `Gallery photo ${index + 1}`}
                className="h-16 w-16 shrink-0 rounded object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-foreground">Photo {index + 1}</p>
                <Input
                  className="h-9 text-base"
                  disabled={busy}
                  value={photo.alt}
                  placeholder="Describe this photo"
                  aria-label={`Description for photo ${index + 1}`}
                  onChange={(event) => onDescribe(photo, event.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-9"
                    disabled={busy}
                    onClick={() => onReplace(photo)}
                    aria-label={`Replace photo ${index + 1}`}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Replace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-9 px-2"
                    disabled={busy || index === 0}
                    onClick={() => onMove(photo, 'earlier')}
                    aria-label={`Move photo ${index + 1} earlier`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-9 px-2"
                    disabled={busy || index === photos.length - 1}
                    onClick={() => onMove(photo, 'later')}
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="min-h-9 px-2"
                    disabled={busy || photos.length <= 1}
                    onClick={() => onRemove(photo)}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
