import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { GalleryPhoto } from '@/lib/websiteEditor';

export const GALLERY_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const GALLERY_MAX_BYTES = 12 * 1024 * 1024;

type Props = {
  title: string;
  photos: GalleryPhoto[];
  max?: number;
  /** True while photos are uploading — controls stay visible but disabled. */
  busy: boolean;
  onAdd: (files: File[]) => void;
  onReplace: (photo: GalleryPhoto) => void;
  onMove: (photo: GalleryPhoto, direction: 'earlier' | 'later') => void;
  onRemove: (photo: GalleryPhoto) => void;
  onDescribe: (photo: GalleryPhoto, description: string) => void;
  onReorder: (from: number, to: number) => void;
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
  onAdd,
  onReplace,
  onMove,
  onRemove,
  onDescribe,
  onReorder,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [arranging, setArranging] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragPoint, setDragPoint] = useState<{x: number; y: number; width: number} | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const dropTarget = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-photo-index]');
    return target && gridRef.current?.contains(target) ? Number(target.dataset.photoIndex) : null;
  };
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

        </div>

        <Button variant="outline" className="w-full" disabled={busy} onClick={() => setArranging(!arranging)}>
          {arranging ? 'Done arranging' : 'Arrange photos'}
        </Button>
        {arranging && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Drag a photo into place. With a keyboard, focus a photo and use the arrow keys.</p>
            {dragging !== null && dragPoint && photos[dragging] && (
              <div aria-hidden="true" className="pointer-events-none fixed z-[100] overflow-hidden rounded-md border-2 border-primary shadow-2xl ring-4 ring-primary/30"
                style={{left: dragPoint.x, top: dragPoint.y, width: dragPoint.width, height: dragPoint.width, transform: 'translate(-50%, -65%) rotate(-4deg) scale(1.12)'}}>
                <img src={photos[dragging].src} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div ref={gridRef} className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Arrange gallery photos">
              {photos.map((photo, index) => (
                <button key={photo.imageKey} type="button" data-photo-index={index}
                  aria-label={`Arrange photo ${index + 1}: ${photo.alt}`}
                  disabled={busy}
                  className={`relative aspect-square touch-none select-none overflow-hidden rounded-md border-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${over === index ? 'border-primary' : 'border-border'} ${dragging === index ? 'opacity-30 border-dashed' : 'cursor-grab active:cursor-grabbing'} ${over === index && dragging !== index ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-95' : ''} transition-transform`}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(index); setOver(index);
                    setDragPoint({x: event.clientX, y: event.clientY, width: event.currentTarget.getBoundingClientRect().width});
                  }}
                  onPointerMove={(event) => { if (dragging !== null) {
                    setOver(dropTarget(event.clientX, event.clientY));
                    setDragPoint((point) => point ? {...point, x: event.clientX, y: event.clientY} : null);
                  } }}
                  onPointerUp={(event) => {
                    const target = dropTarget(event.clientX, event.clientY);
                    if (dragging !== null && target !== null && dragging !== target) onReorder(dragging, target);
                    setDragging(null); setOver(null); setDragPoint(null);
                  }}
                  onPointerCancel={() => { setDragging(null); setOver(null); setDragPoint(null); }}
                  onKeyDown={(event) => {
                    const columns = gridRef.current ? getComputedStyle(gridRef.current).gridTemplateColumns.split(' ').length : 3;
                    const offset = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns}[event.key];
                    if (!offset) return;
                    event.preventDefault();
                    const target = index + offset;
                    if (target >= 0 && target < photos.length) onReorder(index, target);
                  }}>
                  <img src={photo.src} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
                  <span aria-hidden="true" className="pointer-events-none absolute bottom-0 inset-x-0 flex justify-center bg-black/70 py-1 text-white"><GripVertical className="h-4 w-4 rotate-90" /></span>
                  <span className="absolute left-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-xs text-white">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {atMax && (
          <p className="text-xs text-destructive">
            You have reached the {max}-photo limit. Remove a photo before adding another.
          </p>
        )}


        {!arranging && <ul className="space-y-2">
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
        </ul>}
      </CardContent>
    </Card>
  );
}
