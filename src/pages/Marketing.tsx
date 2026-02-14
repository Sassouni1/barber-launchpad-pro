import { useState, useCallback, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Sparkles, Copy, RefreshCw, Loader2, Download, ChevronLeft, ChevronRight, Check, Image as ImageIcon, Plus, X, Scissors, User, Store, Sparkle, Clock, Trash2 } from 'lucide-react';
import { useMarketingImages } from '@/hooks/useMarketingImages';
import useEmblaCarousel from 'embla-carousel-react';

type PaletteChoice = 'gold' | 'website';
type FormatChoice = 'square' | 'story';
type ImageMode = 'both' | 'brand' | 'ai';
type VariationType = 'brand-square' | 'brand-story' | 'ai-square' | 'ai-story';

interface VariationCard {
  type: VariationType;
  label: string;
  caption: string;
  images: (string | null)[];
  imagesLoading: boolean;
}

interface BrandProfile {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
  branding?: {
    colors: Record<string, string>;
    fonts: Array<{ family: string }>;
    logo: string | null;
  } | null;
  images?: string[];
  screenshot?: string | null;
}

// cropImage removed — all variations now use AI generation

const resizeImage = (dataUrl: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};


function ImageCarousel({ images, aspectClass }: { images: (string | null)[]; aspectClass: string }) {
  const validSlides = images.filter((u): u is string => !!u && u !== 'failed');
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (validSlides.length === 0) return null;

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden rounded-lg">
        <div className="flex">
          {validSlides.map((url, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className={`relative ${aspectClass} group`}>
                <img src={url} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadImage(url, `image-${i + 1}.png`)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {validSlides.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!canScrollPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-80 hover:opacity-100"
            onClick={() => emblaApi?.scrollNext()}
            disabled={!canScrollNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {validSlides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {validSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === selectedIndex ? 'w-6 bg-primary' : 'w-2 bg-primary/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Marketing() {
  const [url, setUrl] = useState('');
  const [contentType, setContentType] = useState('instagram');
  const [tone, setTone] = useState('professional');
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [paletteChoice, setPaletteChoice] = useState<PaletteChoice>('gold');
  const [formatChoice, setFormatChoice] = useState<FormatChoice>('square');
  const [variations, setVariations] = useState<VariationCard[]>([]);
  const [generatedCaption, setGeneratedCaption] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [removedImages, setRemovedImages] = useState<Set<string>>(new Set());
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [imageMode, setImageMode] = useState<ImageMode>('both');
  const [businessCategory, setBusinessCategory] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { savedImages, isLoading: savedLoading, saveImage, deleteImage } = useMarketingImages();

  const websiteColors = brandProfile?.branding?.colors || {};
  const hasWebsiteColors = Object.keys(websiteColors).length > 0;
  const scrapedImages = (brandProfile?.images || []).filter((u) => u.startsWith('http'));
  const allBrandImages = [...scrapedImages, ...uploadedImages].filter(url => !removedImages.has(url));

  const handleScrape = async () => {
    if (!url.trim()) {
      toast.error('Please enter a website URL');
      return;
    }

    setIsScraping(true);
    setBrandProfile(null);
    setVariations([]);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', {
        body: { url: url.trim() },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to scrape website');

      setBrandProfile(data.brandProfile);
      toast.success('Website analyzed! Now generate your content.');

      await generateContent(data.brandProfile);
    } catch (err: any) {
      toast.error(err.message || 'Failed to analyze website');
    } finally {
      setIsScraping(false);
    }
  };

  const generateContent = async (profile?: BrandProfile) => {
    const bp = profile || brandProfile || {
      title: '',
      description: '',
      content: '',
      sourceUrl: '',
      images: [],
    };
    if (!bp) {
      toast.error('Please analyze a website first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-marketing', {
        body: { brandProfile: bp, contentType, tone, businessCategory },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate content');

      const textVariation = data.variations?.[0];
      const caption = textVariation?.content || '';
      setGeneratedCaption(caption);

      toast.success('Content generated! Creating images...');

      // Compute fresh image list to avoid stale closure
      const freshScraped = (bp.images || []).filter((u: string) => u.startsWith('http'));
      const freshAllImages = [...freshScraped, ...uploadedImages].filter(u => !removedImages.has(u));
      buildVariations(bp, caption, freshAllImages);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const buildVariations = (bp: BrandProfile, caption: string, imagesForGeneration: string[]) => {
    const realImages = imagesForGeneration.slice(0, 3);
    const sizeVal = formatChoice;
    const sizeLabel = formatChoice === 'square' ? 'Square' : 'Stories';
    const brandType: VariationType = `brand-${sizeVal}` as VariationType;
    const aiType: VariationType = `ai-${sizeVal}` as VariationType;

    const cards: VariationCard[] = [];
    if (imageMode === 'both' || imageMode === 'brand') {
      cards.push({ type: brandType, label: `Brand Images (${sizeLabel})`, caption, images: [null, null, null], imagesLoading: true });
    }
    if (imageMode === 'both' || imageMode === 'ai') {
      cards.push({ type: aiType, label: `AI Generated (${sizeLabel})`, caption, images: [null, null, null], imagesLoading: true });
    }
    setVariations(cards);

    // Helper to generate an AI image and update variation state (returns a promise)
    const generateSlot = async (type: VariationType, imgIdx: number, size: string, refUrl?: string) => {
      const targetW = size === 'story' ? 1080 : 1080;
      const targetH = size === 'story' ? 1920 : 1080;
      const maxAttempts = 3;
      const retryDelays = [0, 5000, 10000];

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          console.log(`Slot ${type}[${imgIdx}]: retry attempt ${attempt + 1} after ${retryDelays[attempt] / 1000}s...`);
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
        }

        try {
          const { data, error } = await supabase.functions.invoke('generate-marketing-image', {
            body: {
              brandProfile: bp,
              variationTitle: type,
              variationContent: caption,
              contentType,
              tone,
              index: imgIdx,
              palette: paletteChoice,
              size,
              businessCategory,
              ...(refUrl ? { referenceImageUrl: refUrl } : {}),
            },
          });

          if (!error && data?.success && data.imageUrl) {
            let imageUrl: string | null = null;
            try { imageUrl = await resizeImage(data.imageUrl, targetW, targetH); } catch { imageUrl = data.imageUrl; }



            if (imageUrl && imageUrl !== 'failed') {
              saveImage(imageUrl, type, caption, bp.sourceUrl || '').catch(() => {});
              setVariations(prev => prev.map(v => {
                if (v.type !== type) return v;
                const newImgs = [...v.images];
                newImgs[imgIdx] = imageUrl;
                const done = newImgs.filter(x => x !== null).length;
                return { ...v, images: newImgs, imagesLoading: done < 3 };
              }));
              return; // Success — exit retry loop
            }
          }

          // Response came back but no usable image — retry
          console.warn(`Slot ${type}[${imgIdx}]: attempt ${attempt + 1} returned no usable image`);
        } catch (err) {
          console.warn(`Slot ${type}[${imgIdx}]: attempt ${attempt + 1} threw error:`, err);
        }
      }

      // All retries exhausted — mark as failed
      console.error(`Slot ${type}[${imgIdx}]: all ${maxAttempts} attempts failed`);
      setVariations(prev => prev.map(v => {
        if (v.type !== type) return v;
        const newImgs = [...v.images];
        newImgs[imgIdx] = 'failed';
        const done = newImgs.filter(x => x !== null).length;
        return { ...v, images: newImgs, imagesLoading: done < 3 };
      }));
    };

    // Build jobs based on imageMode
    const jobs: Array<() => Promise<void>> = [];
    if (imageMode === 'both' || imageMode === 'brand') {
      for (let i = 0; i < 3; i++) {
        const idx = i;
        // Reuse reference images cyclically if fewer than 3
        const refUrl = realImages.length > 0 ? realImages[i % realImages.length] : undefined;
        jobs.push(() => generateSlot(brandType, idx, sizeVal, refUrl));
      }
    }
    if (imageMode === 'both' || imageMode === 'ai') {
      for (let i = 0; i < 3; i++) {
        const idx = i;
        jobs.push(() => generateSlot(aiType, idx, sizeVal));
      }
    }

    // Process in pairs of 2 with 3s delay between batches
    const BATCH_SIZE = 2;
    const DELAY_MS = 3000;
    setGenerationProgress({ current: 0, total: jobs.length });

    (async () => {
      for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(fn => fn()));
        const completed = Math.min(i + BATCH_SIZE, jobs.length);
        setGenerationProgress({ current: completed, total: jobs.length });
        if (i + BATCH_SIZE < jobs.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      setGenerationProgress(null);
    })();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = isScraping || isGenerating;

  const getAspectClass = (type: VariationType) => {
    return type.includes('story') ? 'aspect-[9/16]' : 'aspect-square';
  };

  const getMaxWidth = (type: VariationType) => {
    return type.includes('story') ? 'max-w-[280px]' : 'max-w-[400px]';
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">AI Marketing Generator</h1>
          <p className="text-muted-foreground mt-2">
            Paste your website URL and get AI-generated marketing content & visuals tailored to your brand.
          </p>
        </div>

        {/* Input Section */}
        <Card className="glass-card p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="https://yourbusiness.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleScrape()}
                />
              </div>
              <Button
                onClick={handleScrape}
                disabled={isLoading || !url.trim()}
                className="gold-gradient text-primary-foreground font-semibold min-w-[140px]"
              >
                {isScraping ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Analyze & Generate</>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Content Type</label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram Post</SelectItem>
                    <SelectItem value="facebook">Facebook Post</SelectItem>
                    <SelectItem value="google-ad">Google Ad</SelectItem>
                    <SelectItem value="social">General Social Post</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Tone</label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="bg-secondary/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {brandProfile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>Analyzed: <span className="text-foreground font-medium">{brandProfile.title || brandProfile.sourceUrl}</span></span>
            </div>
          )}
        </Card>

        {/* Business Category Selector */}
        <Card className="glass-card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Business Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { value: 'haircut', label: 'Haircut', icon: Scissors },
              { value: 'hair-system', label: 'Hair System', icon: User },
              { value: 'salon', label: 'Salon', icon: Store },
              { value: 'extensions', label: 'Extensions', icon: Sparkle },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setBusinessCategory(opt.value)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  businessCategory === opt.value
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                {businessCategory === opt.value && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                )}
                <opt.icon className="w-6 h-6 text-foreground" />
                <span className="text-xs font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>

          {/* Generate without URL */}
          {!brandProfile && (
            <Button
              onClick={() => generateContent()}
              disabled={isLoading || !businessCategory}
              className="w-full gold-gradient text-primary-foreground font-semibold"
            >
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Content</>
              )}
            </Button>
          )}
        </Card>

        {/* Upload Your Images - Always visible */}
        <Card className="glass-card p-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> Your Images
          </h2>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Images</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {allBrandImages.map((imgUrl, i) => (
                <div key={imgUrl + i} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden group border border-border">
                  <img src={imgUrl} alt={`Brand ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => setRemovedImages(prev => new Set([...prev, imgUrl]))}
                    className="absolute top-1 left-1 h-6 w-6 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-destructive-foreground" />
                  </button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => downloadImage(imgUrl, `brand-image-${i + 1}.jpg`)}
                    className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="text-[10px]">Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      if (ev.target?.result) {
                        setUploadedImages(prev => [...prev, ev.target!.result as string]);
                      }
                    };
                    reader.readAsDataURL(file);
                  });
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Image Type Selector */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Image Type</label>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'brand' as ImageMode, label: 'Brand Images', desc: 'Uses your reference photos' },
                { value: 'ai' as ImageMode, label: 'AI Generated', desc: 'Fully AI-generated' },
                { value: 'both' as ImageMode, label: 'Both', desc: 'Brand + AI sets' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setImageMode(opt.value)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                    imageMode === opt.value
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  {imageMode === opt.value && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <span className="text-xs font-medium text-foreground">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormatChoice('square')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  formatChoice === 'square'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                {formatChoice === 'square' && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                )}
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-foreground">
                  <rect x="4" y="4" width="24" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Square (1:1)</span>
                  <span className="text-[10px] text-muted-foreground">1080 × 1080</span>
                </div>
              </button>

              <button
                onClick={() => setFormatChoice('story')}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  formatChoice === 'story'
                    ? 'border-primary bg-primary/10 ring-1 ring-primary'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                {formatChoice === 'story' && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                )}
                <svg width="20" height="32" viewBox="0 0 20 32" fill="none" className="text-foreground">
                  <rect x="1" y="1" width="18" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <div className="text-center">
                  <span className="text-xs font-medium text-foreground block">Story (9:16)</span>
                  <span className="text-[10px] text-muted-foreground">1080 × 1920</span>
                </div>
              </button>
            </div>
          </div>

          {/* Palette Selector - only after website analysis */}
          {brandProfile && (
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Color Palette</label>
              <div className="grid grid-cols-2 gap-3">
                {/* Gold option */}
                <button
                  onClick={() => setPaletteChoice('gold')}
                  className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    paletteChoice === 'gold'
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  {paletteChoice === 'gold' && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: '#D4AF37' }} />
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: '#1A1A1A' }} />
                  </div>
                  <span className="text-xs font-medium text-foreground">Premium Gold/Dark</span>
                </button>

                {/* Website colors option */}
                <button
                  onClick={() => hasWebsiteColors && setPaletteChoice('website')}
                  className={`relative flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    !hasWebsiteColors ? 'opacity-40 cursor-not-allowed border-border bg-secondary/20' :
                    paletteChoice === 'website'
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border bg-secondary/30 hover:bg-secondary/50'
                  }`}
                  disabled={!hasWebsiteColors}
                >
                  {paletteChoice === 'website' && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className="flex gap-1">
                    {hasWebsiteColors ? (
                      Object.values(websiteColors).slice(0, 3).map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded border border-border" style={{ backgroundColor: c }} />
                      ))
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded bg-muted" />
                        <div className="w-6 h-6 rounded bg-muted" />
                      </>
                    )}
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {hasWebsiteColors ? 'Website Colors' : 'No colors found'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Loading State */}
        {isGenerating && (
          <Card className="glass-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Generating your marketing content...</p>
          </Card>
        )}

        {/* Image Generation Progress */}
        {generationProgress && !isGenerating && (
          <Card className="glass-card p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground font-medium">
                  Generating image {generationProgress.current} of {generationProgress.total}...
                </p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Results - 4 Variation Cards */}
        {variations.length > 0 && !isGenerating && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-foreground">Generated Content</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateContent()}
                disabled={isLoading}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
              </Button>
            </div>

            <div className={`grid ${variations.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-2'} gap-6`}>
              {variations.map((variation, idx) => {
                const validImages = variation.images.filter(x => x && x !== 'failed');

                return (
                  <Card key={idx} className="glass-card overflow-hidden hover-lift">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 pb-2">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">
                        {variation.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(variation.caption)}
                        className="text-muted-foreground hover:text-primary h-7 px-2"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                    </div>

                    {/* Carousel or Loading */}
                    <div className="px-4">
                      {variation.imagesLoading && validImages.length === 0 ? (
                        <Skeleton className={`w-full ${getAspectClass(variation.type)} rounded-lg`} />
                      ) : validImages.length > 0 ? (
                        <ImageCarousel images={variation.images} aspectClass={getAspectClass(variation.type)} />
                      ) : (
                        <div className={`w-full ${getAspectClass(variation.type)} rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground`}>
                          No images available
                        </div>
                      )}
                      {variation.imagesLoading && validImages.length > 0 && (
                        <div className="flex items-center gap-2 justify-center mt-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Generating more...
                        </div>
                      )}
                    </div>

                    {/* Caption */}
                    <div className="p-4 pt-3 border-t border-border mt-3">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
                        {variation.caption}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Previously Generated Images */}
        {savedImages.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> Previously Generated
              </h2>
              <span className="text-xs text-muted-foreground">Auto-deletes after 24 hours</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {savedImages.map((img) => (
                <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border">
                  <img
                    src={img.public_url}
                    alt="Generated marketing image"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                    <a
                      href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-file?url=${encodeURIComponent(img.public_url)}&name=${encodeURIComponent(`marketing-${img.id}.png`)}`}
                      download={`marketing-${img.id}.png`}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    >
                    </a>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteImage(img.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {img.caption && (
                    <div className="absolute top-2 left-2 right-2">
                      <span className="text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full line-clamp-1">
                        {img.variation_type}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
