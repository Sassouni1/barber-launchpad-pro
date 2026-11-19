import { Check, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { guidedTemplates, type GuidedTemplate } from '@/lib/guidedWebsite';

// Presentation for each guided template in the picker. Screenshots live in
// public/website-previews/thumbs and should be re-captured when a template changes.
const pickerDetails: Record<GuidedTemplate, { name: string; tag: string; blurb: string; phone: string; desktop: string; recommended?: boolean }> = {
  'guided-charlotte': {
    name: 'Classic',
    tag: 'Warm · editorial',
    blurb: 'Warm, editorial, and focused on your story. Big headline over your photo, hair loss solutions one tap away.',
    phone: '/website-previews/thumbs/template-1-phone.jpg',
    desktop: '/website-previews/thumbs/template-1-desktop.jpg',
    recommended: true,
  },
  'guided-kait': {
    name: 'Bold',
    tag: 'Dark · modern',
    blurb: 'Bold, dark, and focused on your services and work. Shop photo up top, big gold booking buttons.',
    phone: '/website-previews/thumbs/template-2-phone.jpg',
    desktop: '/website-previews/thumbs/template-2-desktop.jpg',
  },
};

// Recommended badge is built but hidden for now. Flip to true to show it again.
const SHOW_RECOMMENDED_BADGE = false;

export const templateDisplayName = (key: GuidedTemplate) => pickerDetails[key]?.name ?? key;

type Props = {
  selected: GuidedTemplate | null;
  onChoose: (key: GuidedTemplate) => void;
  onPreview: (key: GuidedTemplate) => void;
};

export function TemplatePicker({ selected, onChoose, onPreview }: Props) {
  return <div className="space-y-5">
    <div>
      <h2 className="font-serif text-2xl sm:text-3xl">Pick the design you like best</h2>
      <p className="mt-1 text-muted-foreground">Tap a preview to see the whole site. You can change words, photos and prices later.</p>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      {guidedTemplates.map(template => {
        const details = pickerDetails[template.key];
        const isSelected = selected === template.key;
        return <article key={template.key} className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-background transition-shadow ${isSelected ? 'border-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.15)]' : 'border-border'}`}>
          <div className="relative flex justify-center bg-muted/40 px-4 pt-5 lg:px-5">
            {SHOW_RECOMMENDED_BADGE && details.recommended && <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Recommended</span>}
            <button type="button" onClick={() => onPreview(template.key)} aria-label={`Open the full ${details.name} website`} className="block w-[210px] overflow-hidden rounded-t-[28px] border-[7px] border-b-0 border-neutral-800 bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:w-full lg:rounded-t-lg lg:border-4">
              <img src={details.phone} alt="" loading="lazy" className="block h-[330px] w-full object-cover object-top lg:hidden" />
              <img src={details.desktop} alt="" loading="lazy" className="hidden aspect-[16/10] w-full object-cover object-top lg:block" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-3 border-t border-border p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-serif text-2xl">{details.name}</h3>
              <span className="text-xs text-muted-foreground">{details.tag}</span>
            </div>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{details.blurb}</p>
            <div className="mt-auto flex flex-col-reverse gap-2 pt-1 sm:flex-row">
              <Button type="button" variant="outline" className="h-12 w-full sm:w-auto" onClick={() => onPreview(template.key)}><Eye className="mr-2 h-4 w-4" />Full site</Button>
              <Button type="button" variant={isSelected ? 'default' : 'outline'} className={`h-12 w-full sm:w-auto sm:flex-1 ${isSelected ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : 'border-primary text-primary hover:bg-primary/10 hover:text-primary'}`} onClick={() => onChoose(template.key)}>
                {isSelected ? <><Check className="mr-2 h-4 w-4" />Selected</> : 'Choose this template'}
              </Button>
            </div>
          </div>
        </article>;
      })}
    </div>
  </div>;
}
