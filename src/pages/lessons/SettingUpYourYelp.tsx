import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImageOff, PlayCircle, X, ZoomIn } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  YELP_SECTIONS,
  YELP_STEPS,
  YELP_VIDEO_SRC,
  type YelpStep,
  type YelpStepSection,
} from '@/data/yelpLessonSteps';

const RED_ACCENT = 'text-primary';
const RED_BG = 'bg-primary text-primary-foreground';
const RED_BORDER = 'border-primary/30';

type FilterValue = 'all' | YelpStepSection;

function StepImage({ step, onZoom }: { step: YelpStep; onZoom: () => void }) {
  const [errored, setErrored] = useState(false);
  return (
    <button
      type="button"
      onClick={onZoom}
      className={cn(
        'group relative w-full aspect-video overflow-hidden rounded-lg border bg-secondary/30',
        RED_BORDER,
      )}
    >
      {errored ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground p-4 text-center">
          <ImageOff className="w-6 h-6" />
          <span className="text-xs">Screenshot missing</span>
          <span className="text-[10px] break-all opacity-70">{step.image.split('/').pop()}</span>
        </div>
      ) : (
        <img
          src={step.image}
          alt={`Step ${step.number}: ${step.title}`}
          loading="lazy"
          onError={() => setErrored(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <span
        className={cn(
          'absolute top-2 left-2 rounded-md px-2 py-0.5 text-xs font-semibold',
          RED_BG,
        )}
      >
        Step {step.number}
      </span>
    </button>
  );
}

function VideoBlock() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-black">
      <div className="aspect-video relative">
        <iframe
          src="https://player.vimeo.com/video/1197717624?h=50cac75931&badge=0&autopause=0&player_id=0&app_id=58479"
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          title="Setting Up your Yelp"
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}


export default function SettingUpYourYelp() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterValue>('all');
  const [zoomStep, setZoomStep] = useState<YelpStep | null>(null);

  const filteredSteps = useMemo(
    () => (filter === 'all' ? YELP_STEPS : YELP_STEPS.filter((s) => s.section === filter)),
    [filter],
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courses/business')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Business Mastery</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Setting Up your yelp</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              A click-by-click walkthrough for creating your Yelp business listing. Watch the annotated video or read
              through the 40 screenshot steps below.
            </p>
          </div>
        </div>

        {/* Video */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
            <PlayCircle className={cn('w-5 h-5', RED_ACCENT)} />
            Watch the annotated video
          </h2>
          <VideoBlock />
        </section>

        {/* Screenshot guide */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Read the screenshot guide</h2>
              <p className="text-sm text-muted-foreground">Tap any screenshot to open it larger.</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(['all', ...YELP_SECTIONS] as FilterValue[]).map((value) => {
              const active = filter === value;
              const label = value === 'all' ? 'All steps' : value;
              const count = value === 'all' ? YELP_STEPS.length : YELP_STEPS.filter((s) => s.section === value).length;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? cn(RED_BG, 'border-transparent')
                      : 'bg-secondary/40 text-muted-foreground border-border hover:text-foreground',
                  )}
                >
                  {label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSteps.map((step) => (
              <article
                key={step.number}
                className="flex flex-col rounded-xl border border-border bg-card overflow-hidden"
              >
                <StepImage step={step} onZoom={() => setZoomStep(step)} />
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', RED_ACCENT)}>STEP {step.number}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      · {step.section}
                    </span>
                  </div>
                  <h3 className="font-semibold leading-tight">{step.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    <span>
                      Annotated <span className="font-mono text-foreground">{step.annotatedTimestamp}</span>
                    </span>
                    <span>
                      Source <span className="font-mono text-foreground">{step.sourceTimestamp}</span>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic leading-snug">
                    “{step.transcript}”
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Lightbox */}
      <Dialog open={!!zoomStep} onOpenChange={(open) => !open && setZoomStep(null)}>
        <DialogContent className="max-w-5xl p-0 bg-background border-border overflow-hidden">
          {zoomStep && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div>
                  <p className={cn('text-xs font-semibold', RED_ACCENT)}>STEP {zoomStep.number} · {zoomStep.section}</p>
                  <h3 className="font-semibold">{zoomStep.title}</h3>
                </div>
                <button
                  onClick={() => setZoomStep(null)}
                  className="rounded-md p-1.5 hover:bg-secondary"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-black flex items-center justify-center max-h-[70vh]">
                <img
                  src={zoomStep.image}
                  alt={`Step ${zoomStep.number}: ${zoomStep.title}`}
                  className="max-h-[70vh] w-auto object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="p-4 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Annotated <span className="font-mono text-foreground">{zoomStep.annotatedTimestamp}</span></span>
                  <span>Source <span className="font-mono text-foreground">{zoomStep.sourceTimestamp}</span></span>
                </div>
                <p className="text-muted-foreground italic">“{zoomStep.transcript}”</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
