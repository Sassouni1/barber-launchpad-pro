import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Loader2, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCourses } from '@/hooks/useCourses';
import { useCertificateLayout, useUpdateCertificateLayout } from '@/hooks/useCertificateLayout';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Draft = {
  name_x: number;
  name_y: number;
  name_font_size: number;
  date_x: number;
  date_y: number;
  date_font_size: number;
  date_font_family: string;
};

export function CertificateLayoutEditor() {
  const { data: courses = [] } = useCourses({ includeUnpublished: true });
  const [courseId, setCourseId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!courseId && courses.length > 0) setCourseId(courses[0].id);
  }, [courses, courseId]);

  const { data: layout, isLoading } = useCertificateLayout(courseId);
  const updateLayout = useUpdateCertificateLayout();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [nudge, setNudge] = useState(10);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [baseRendered, setBaseRendered] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [testName, setTestName] = useState('Recipient Name');
  const [testDate, setTestDate] = useState('');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    if (layout) {
      setDraft({
        name_x: layout.name_x,
        name_y: layout.name_y,
        name_font_size: layout.name_font_size,
        date_x: layout.date_x,
        date_y: layout.date_y,
        date_font_size: layout.date_font_size,
        date_font_family: layout.date_font_family || 'name',
      });
    } else {
      setDraft(null);
    }
  }, [layout?.id, layout?.name_x, layout?.name_y, layout?.name_font_size, layout?.date_x, layout?.date_y, layout?.date_font_size, layout?.date_font_family]);

  // Measure actual rendered size when zoom or image changes
  const templateUrl = layout
    ? `https://ynooatjtgstgwfssnira.supabase.co/storage/v1/object/public/certificates/${layout.template_path || 'template/certificate-template.png'}?t=${layout.id}`
    : null;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const measure = () => {
      setBaseRendered({ w: img.clientWidth, h: img.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(img);
    return () => ro.disconnect();
  }, [zoom, templateUrl]);

  const previewDate = testDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const patch = (p: Partial<Draft>) => setDraft((c) => (c ? { ...c, ...p } : c));

  const handleSave = async () => {
    if (!courseId || !draft) return;
    try {
      await updateLayout.mutateAsync({ courseId, updates: draft });
      toast.success('Layout saved');
    } catch (e) {
      toast.error('Failed to save layout');
    }
  };

  const rendered = baseRendered;

  return (
    <div className="p-4 rounded-lg border border-border bg-secondary/20 space-y-4">
      <div className="flex items-center gap-3">
        <Move className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-medium">Name & Date Position</h3>
          <p className="text-sm text-muted-foreground">
            Adjust where the recipient name and date are placed on the certificate.
          </p>
        </div>
      </div>

      {/* Course selector */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Course:</label>
        <select
          value={courseId ?? ''}
          onChange={(e) => setCourseId(e.target.value)}
          className="flex-1 h-9 px-2 rounded-md border border-input bg-background text-sm"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !layout || !draft ? (
        <div className="text-sm text-muted-foreground py-4">
          No layout exists for this course yet. Generate a certificate once to create one.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Left: Preview */}
          <div className="space-y-2 min-w-0">
            {/* Zoom bar */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
                disabled={zoom <= 1}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                disabled={zoom >= 4}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{zoom.toFixed(1)}x</span>
              {zoom > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>Reset</Button>
              )}
            </div>

            {/* Preview canvas */}
            <div
              className={cn(
                'rounded-lg border border-primary/30 bg-background relative',
                zoom > 1 ? 'overflow-auto max-h-[70vh]' : 'overflow-hidden'
              )}
              ref={wrapperRef}
            >
              {templateUrl && (
                <div
                  className="relative"
                  style={{ width: `${zoom * 100}%` }}
                >
                  <img
                    ref={imgRef}
                    src={templateUrl}
                    alt="Certificate template"
                    className="w-full block"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setBaseRendered({ w: img.clientWidth, h: img.clientHeight });
                      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                  />
                  {natural.w > 0 && rendered.w > 0 && (
                    <>
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${(draft.name_x / natural.w) * 100}%`,
                          top: `${(draft.name_y / natural.h) * 100}%`,
                          transform: 'translate(-50%, -50%)',
                          fontFamily: '"Cinzel", serif',
                          fontWeight: 600,
                          fontSize: `${(draft.name_font_size / natural.w) * rendered.w}px`,
                          color: layout.name_color || '#1A1A1A',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}
                      >
                        {testName || 'Recipient Name'}

                      </div>
                      <div
                        className="absolute pointer-events-none"
                        style={{
                          left: `${(draft.date_x / natural.w) * 100}%`,
                          top: `${(draft.date_y / natural.h) * 100}%`,
                          transform: 'translateY(-50%)',
                          fontFamily:
                            draft.date_font_family === 'name'
                              ? '"Cinzel", serif'
                              : draft.date_font_family === 'sans-serif'
                              ? 'sans-serif'
                              : draft.date_font_family === 'serif'
                              ? 'serif'
                              : `"${draft.date_font_family}", sans-serif`,
                          fontWeight: draft.date_font_family === 'name' ? 600 : 400,
                          fontSize: `${(draft.date_font_size / natural.w) * rendered.w}px`,
                          color: draft.date_font_family === 'name' ? layout.name_color || '#1A1A1A' : layout.date_color || '#1A1A1A',
                          whiteSpace: 'nowrap',
                          lineHeight: 1,
                        }}
                      >
                        {previewDate}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            {/* Test preview values */}
            <div className="p-3 rounded-md border border-border space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test Preview</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input
                    type="text"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Jonathan Alexander Rodriguez"
                    className="w-full h-8 px-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Date (leave empty for today)</label>
                  <input
                    type="text"
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    placeholder="e.g. December 31, 2025"
                    className="w-full h-8 px-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Preview only — does not save.</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Nudge:</span>
              <input
                type="number"
                value={nudge}
                onChange={(e) => setNudge(Math.max(1, Number(e.target.value) || 1))}
                className="w-16 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                min={1}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>


            {/* Name controls */}
            <div className="p-3 rounded-md border border-border space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">X</span>
                <input
                  type="number"
                  value={draft.name_x}
                  onChange={(e) => patch({ name_x: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
                <span className="text-sm text-muted-foreground">Y</span>
                <input
                  type="number"
                  value={draft.name_y}
                  onChange={(e) => patch({ name_y: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
                <span className="text-sm text-muted-foreground">Font</span>
                <input
                  type="number"
                  value={draft.name_font_size}
                  onChange={(e) => patch({ name_font_size: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => patch({ name_x: draft.name_x - nudge })}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => patch({ name_x: draft.name_x + nudge })}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => patch({ name_y: draft.name_y - nudge })}><ChevronLeft className="w-4 h-4 rotate-90" /> Up</Button>
                <Button variant="outline" size="sm" onClick={() => patch({ name_y: draft.name_y + nudge })}><ChevronRight className="w-4 h-4 rotate-90" /> Down</Button>
                {natural.w > 0 && (
                  <Button variant="outline" size="sm" onClick={() => patch({ name_x: Math.round(natural.w / 2) })}>
                    <RotateCw className="w-4 h-4 mr-1" /> Center
                  </Button>
                )}
              </div>
            </div>

            {/* Date controls */}
            <div className="p-3 rounded-md border border-border space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">X</span>
                <input
                  type="number"
                  value={draft.date_x}
                  onChange={(e) => patch({ date_x: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
                <span className="text-sm text-muted-foreground">Y</span>
                <input
                  type="number"
                  value={draft.date_y}
                  onChange={(e) => patch({ date_y: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
                <span className="text-sm text-muted-foreground">Font</span>
                <input
                  type="number"
                  value={draft.date_font_size}
                  onChange={(e) => patch({ date_font_size: Number(e.target.value) || 0 })}
                  className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => patch({ date_x: draft.date_x - nudge })}><ChevronLeft className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => patch({ date_x: draft.date_x + nudge })}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => patch({ date_y: draft.date_y - nudge })}><ChevronLeft className="w-4 h-4 rotate-90" /> Up</Button>
                <Button variant="outline" size="sm" onClick={() => patch({ date_y: draft.date_y + nudge })}><ChevronRight className="w-4 h-4 rotate-90" /> Down</Button>
              </div>
            </div>

            <Button
              className="w-full gold-gradient"
              onClick={handleSave}
              disabled={updateLayout.isPending}
            >
              {updateLayout.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                'Save Position'
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Saved positions apply to all newly generated certificates. Existing certificates need to be regenerated to pick up the new layout.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
