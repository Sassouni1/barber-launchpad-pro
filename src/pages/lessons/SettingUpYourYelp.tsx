import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ImageOff, X, ZoomIn } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  YELP_SECTIONS,
  YELP_STEPS,
  type YelpStep,
  type YelpStepSection,
} from '@/data/yelpLessonSteps';

const RED_ACCENT = 'text-primary';
const RED_BG = 'bg-primary text-primary-foreground';
const RED_BORDER = 'border-primary/30';

type FilterValue = 'all' | YelpStepSection;

const YELP_DESCRIPTION_TEMPLATES = [
  {
    id: 'salon',
    title: 'Hair Salon',
    text:
      "[Business Name] is a hair salon in [City, State] specializing in natural-looking hair systems, women's cuts, men's cuts, extensions, and custom styling. We help clients with everyday hair services as well as non-surgical solutions for thinning hair, hair loss, or lack of fullness.\n\n" +
      'Every hair system service is personalized through a private consultation, color matching, blending, cutting, styling, and maintenance guidance, so the final result looks seamless, feels comfortable, and fits your lifestyle.',
  },
  {
    id: 'barbershop',
    title: 'Barbershop',
    text:
      '[Business Name] is a barbershop in [City, State] specializing in men\'s cuts, fades, beard grooming, styling, and natural-looking hair systems. We help clients dealing with thinning hair, hair loss, or receding hairlines get a fuller look without surgery and without the obvious "hairpiece" look.\n\n' +
      'Our hair system services include private consultation, color matching, blending, cutting, styling, and maintenance support, so the final result looks clean, realistic, and fits your everyday style.',
  },
  {
    id: 'barber',
    title: 'Individual Barber',
    text:
      '[Business Name] is led by [Barber Name], a barber in [City, State] specializing in men\'s cuts, fades, beard grooming, styling, and natural-looking hair systems. Clients come in for clean cuts, sharp grooming, and custom solutions for thinning hair, hair loss, or receding hairlines.\n\n' +
      'Each hair system service is personalized with a private consultation, color matching, blending, cutting, styling, and maintenance guidance, so the result looks clean, realistic, and fits your everyday style.',
  },
  {
    id: 'stylist',
    title: 'Individual Stylist',
    text:
      "[Business Name] is led by [Stylist Name], a stylist in [City, State] specializing in natural-looking hair systems, women's cuts, men's cuts, extensions, and styling. Clients come in for everything from fresh cuts and fuller extensions to custom solutions for thinning hair, hair loss, or lack of fullness.\n\n" +
      'Each service is personalized with consultation, color matching, blending, cutting, styling, and maintenance guidance, so the result looks natural, feels comfortable, and gives you confidence every day.',
  },
];

const HIGHLIGHT_TERMS = [
  '[Business Name]',
  '[City, State]',
  '[Barber Name]',
  '[Stylist Name]',
];

function HighlightedTemplateText({ text }: { text: string }) {
  const escapedTerms = HIGHLIGHT_TERMS.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

  return (
    <>
      {text.split('\n').map((line, lineIndex) => (
        <p key={lineIndex} className={lineIndex > 0 ? 'mt-3' : undefined}>
          {line.split(pattern).map((part, partIndex) => {
            const shouldHighlight = HIGHLIGHT_TERMS.some((term) => term.toLowerCase() === part.toLowerCase());
            return shouldHighlight ? (
              <mark
                key={`${lineIndex}-${partIndex}`}
                className="rounded bg-primary/25 px-1 text-foreground ring-1 ring-primary/40"
              >
                {part}
              </mark>
            ) : (
              <span key={`${lineIndex}-${partIndex}`}>{part}</span>
            );
          })}
        </p>
      ))}
    </>
  );
}

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
      <div className="relative w-full" style={{ paddingTop: `${(240 / 372) * 100}%` }}>
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
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);

  const filteredSteps = useMemo(
    () => (filter === 'all' ? YELP_STEPS : YELP_STEPS.filter((s) => s.section === filter)),
    [filter],
  );

  const copyTemplate = async (templateId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTemplateId(templateId);
    window.setTimeout(() => setCopiedTemplateId(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-12">
        {/* Header */}
        <div className="order-1 flex items-start gap-3 md:order-none">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courses/business')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Business Mastery</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">Setting Up Your Yelp</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Build a Yelp listing that shows regular hair services while positioning hair systems as the main high-value offer.
            </p>
          </div>
        </div>

        {/* Video */}
        <section className="order-2 md:order-none">
          <VideoBlock />
        </section>

        <section className="order-3 md:order-none text-sm">
          <span className="font-semibold">Click Here to List on Yelp: </span>
          <a
            href="https://biz.yelp.com/home/q_-Ykm1mjZNdeGSFfvejFQ/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            https://biz.yelp.com/home/q_-Ykm1mjZNdeGSFfvejFQ/
          </a>
        </section>

        {/* Yelp profile descriptions */}
        <section className="order-4 md:order-none">
          <div className="space-y-4">
            {YELP_DESCRIPTION_TEMPLATES.map((template) => {
              const copied = copiedTemplateId === template.id;
              return (
                <article key={template.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-semibold">{template.title}</h3>
                    <Button
                      size="sm"
                      className={copied ? 'bg-green-500 text-white hover:bg-green-500' : 'gold-gradient text-primary-foreground'}
                      onClick={() => copyTemplate(template.id, template.text)}
                    >
                      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90">
                    <HighlightedTemplateText text={template.text} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Screenshot guide */}
        <section className="order-5 md:order-none">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-lg font-semibold">Follow the {YELP_STEPS.length}-step checklist</h2>
              <p className="text-sm text-muted-foreground">The small clicks are grouped together. Tap any screenshot to open it larger.</p>
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
                  <p className="text-sm text-muted-foreground leading-snug">
                    {step.transcript}
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
                  <span>Video <span className="font-mono text-foreground">{zoomStep.annotatedTimestamp}</span></span>
                  <span>Source <span className="font-mono text-foreground">{zoomStep.sourceTimestamp}</span></span>
                </div>
                <p className="text-muted-foreground">{zoomStep.transcript}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
