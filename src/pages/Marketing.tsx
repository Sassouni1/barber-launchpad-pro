import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Sparkles, Copy, RefreshCw, Loader2, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

interface CarouselSlide {
  url: string;
  type: 'real' | 'ai';
}

interface Variation {
  title: string;
  content: string;
  realImages: string[];
  aiImages: (string | null)[];
  aiImagesLoading: boolean;
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

// Carousel component for each variation
function ImageCarousel({ slides }: { slides: CarouselSlide[] }) {
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

  if (slides.length === 0) return null;

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden rounded-lg">
        <div className="flex">
          {slides.map((slide, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative aspect-square group">
                <img
                  src={slide.url}
                  alt={`Slide ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <Badge
                  className={`absolute top-2 left-2 text-[10px] ${
                    slide.type === 'real'
                      ? 'bg-green-600/90 text-white border-green-500'
                      : 'bg-primary/90 text-primary-foreground border-primary'
                  }`}
                >
                  {slide.type === 'real' ? 'Website Photo' : 'AI Generated'}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => downloadImage(slide.url, `image-${i + 1}.png`)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-3 h-3 mr-1" /> Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Arrows */}
      {slides.length > 1 && (
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

      {/* Dots */}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === selectedIndex
                  ? 'w-6 bg-primary'
                  : `w-2 ${slide.type === 'real' ? 'bg-green-500/50' : 'bg-primary/30'}`
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
  const [variations, setVariations] = useState<Variation[]>([]);

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

  const generateImages = (textVariations: Variation[], bp: BrandProfile) => {
    // Pull up to 3 real images from brand profile
    const realImages = (bp.images || []).filter((u) => u.startsWith('http')).slice(0, 3);

    const withLoading = textVariations.map(v => ({
      ...v,
      realImages,
      aiImages: [null, null, null],
      aiImagesLoading: true,
    }));
    setVariations(withLoading);

    // Fire 3 AI image calls per variation
    textVariations.forEach((variation, vIdx) => {
      const body = {
        brandProfile: bp,
        variationTitle: variation.title,
        variationContent: variation.content,
        contentType,
        tone,
      };

      [0, 1, 2].forEach((imgIdx) => {
        supabase.functions.invoke('generate-marketing-image', {
          body: { ...body, index: imgIdx },
        }).then(async ({ data, error }) => {
          let imageUrl: string | null = null;
          if (!error && data?.success && data.imageUrl) {
            try {
              imageUrl = await resizeImage(data.imageUrl, 1080, 1080);
            } catch {
              imageUrl = data.imageUrl;
            }
          }
          setVariations(prev => prev.map((v, i) => {
            if (i !== vIdx) return v;
            const newAi = [...v.aiImages];
            newAi[imgIdx] = imageUrl;
            const allDone = newAi.every(x => x !== null) || newAi.filter(x => x === null).length === 0;
            // Check if we tried all 3 (even if some failed)
            const attempted = prev[i].aiImages.map((existing, ei) => ei === imgIdx ? 'done' : (existing !== null ? 'done' : 'pending'));
            return { ...v, aiImages: newAi, aiImagesLoading: attempted.includes('pending') };
          }));
          if (error || !data?.success) {
            console.error('AI image failed for variation', vIdx, 'index', imgIdx, error || data?.error);
          }
        });
      });
    });
  };

  const generateContent = async (profile?: BrandProfile) => {
    const bp = profile || brandProfile;
    if (!bp) {
      toast.error('Please analyze a website first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-marketing', {
        body: { brandProfile: bp, contentType, tone },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to generate content');

      const textVariations: Variation[] = (data.variations || []).map((v: any) => ({
        ...v,
        realImages: [],
        aiImages: [null, null, null],
        aiImagesLoading: true,
      }));
      setVariations(textVariations);
      toast.success('Content generated! Images are being created...');

      generateImages(textVariations, bp);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const getSlides = (variation: Variation): CarouselSlide[] => {
    const slides: CarouselSlide[] = [];
    variation.realImages.forEach(url => slides.push({ url, type: 'real' }));
    variation.aiImages.forEach(url => {
      if (url) slides.push({ url, type: 'ai' });
    });
    return slides;
  };

  const isLoading = isScraping || isGenerating;

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

        {/* Loading State */}
        {isGenerating && (
          <Card className="glass-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Generating your marketing content...</p>
          </Card>
        )}

        {/* Results */}
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

            <div className="grid gap-6">
              {variations.map((variation, idx) => {
                const slides = getSlides(variation);
                const hasContent = slides.length > 0 || variation.aiImagesLoading;

                return (
                  <Card key={idx} className="glass-card overflow-hidden hover-lift">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 pb-3">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">
                        {variation.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(variation.content)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>

                    {/* Carousel or Loading */}
                    <div className="px-5">
                      <div className="max-w-[400px] mx-auto">
                        {variation.aiImagesLoading && slides.length === 0 ? (
                          <Skeleton className="w-full aspect-square rounded-lg" />
                        ) : slides.length > 0 ? (
                          <ImageCarousel slides={slides} />
                        ) : (
                          <div className="w-full aspect-square rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground">
                            No images available
                          </div>
                        )}
                        {variation.aiImagesLoading && slides.length > 0 && (
                          <div className="flex items-center gap-2 justify-center mt-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" /> Generating more images...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Caption */}
                    <div className="p-5 pt-4 border-t border-border mt-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {variation.content}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
