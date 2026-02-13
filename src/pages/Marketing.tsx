import { useState, useCallback, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Sparkles, Copy, RefreshCw, Loader2, Download, ChevronLeft, ChevronRight, Check, Image as ImageIcon } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';

type PaletteChoice = 'gold' | 'website';
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

// Center-crop an image to target dimensions
const cropImage = (srcUrl: string, width: number, height: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      // Center-crop: scale to cover, then center
      const srcRatio = img.width / img.height;
      const dstRatio = width / height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > dstRatio) {
        sw = img.height * dstRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / dstRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = srcUrl;
  });
};

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
  const validSlides = images.filter((u): u is string => !!u);
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
  const [variations, setVariations] = useState<VariationCard[]>([]);
  const [generatedCaption, setGeneratedCaption] = useState('');

  const websiteColors = brandProfile?.branding?.colors || {};
  const hasWebsiteColors = Object.keys(websiteColors).length > 0;
  const scrapedImages = (brandProfile?.images || []).filter((u) => u.startsWith('http'));

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

      const textVariation = data.variations?.[0];
      const caption = textVariation?.content || '';
      setGeneratedCaption(caption);

      toast.success('Content generated! Creating images...');

      buildVariations(bp, caption);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const buildVariations = (bp: BrandProfile, caption: string) => {
    const realImages = (bp.images || []).filter((u) => u.startsWith('http')).slice(0, 3);

    const cards: VariationCard[] = [
      { type: 'brand-square', label: 'Brand Images (Square)', caption, images: [null, null, null], imagesLoading: true },
      { type: 'brand-story', label: 'Brand Images (Stories)', caption, images: [null, null, null], imagesLoading: true },
      { type: 'ai-square', label: 'AI Generated (Square)', caption, images: [null, null, null], imagesLoading: true },
      { type: 'ai-story', label: 'AI Generated (Stories)', caption, images: [null, null, null], imagesLoading: true },
    ];
    setVariations(cards);

    // Brand Square: crop real images to 1080x1080
    realImages.forEach((imgUrl, i) => {
      cropImage(imgUrl, 1080, 1080)
        .then(cropped => {
          setVariations(prev => prev.map(v => {
            if (v.type !== 'brand-square') return v;
            const newImgs = [...v.images];
            newImgs[i] = cropped;
            return { ...v, images: newImgs, imagesLoading: newImgs.some((x, j) => x === null && j < realImages.length) };
          }));
        })
        .catch(() => {
          setVariations(prev => prev.map(v => {
            if (v.type !== 'brand-square') return v;
            const newImgs = [...v.images];
            newImgs[i] = imgUrl; // fallback to original
            return { ...v, images: newImgs, imagesLoading: newImgs.some((x, j) => x === null && j < realImages.length) };
          }));
        });
    });
    // If fewer than 3 real images, mark remaining as done
    if (realImages.length < 3) {
      setVariations(prev => prev.map(v => {
        if (v.type !== 'brand-square') return v;
        return { ...v, images: v.images.slice(0, realImages.length).concat(Array(3 - realImages.length).fill(null)), imagesLoading: realImages.length > 0 };
      }));
    }

    // Brand Story: crop real images to 1080x1920
    realImages.forEach((imgUrl, i) => {
      cropImage(imgUrl, 1080, 1920)
        .then(cropped => {
          setVariations(prev => prev.map(v => {
            if (v.type !== 'brand-story') return v;
            const newImgs = [...v.images];
            newImgs[i] = cropped;
            return { ...v, images: newImgs, imagesLoading: newImgs.some((x, j) => x === null && j < realImages.length) };
          }));
        })
        .catch(() => {
          setVariations(prev => prev.map(v => {
            if (v.type !== 'brand-story') return v;
            const newImgs = [...v.images];
            newImgs[i] = imgUrl;
            return { ...v, images: newImgs, imagesLoading: newImgs.some((x, j) => x === null && j < realImages.length) };
          }));
        });
    });
    if (realImages.length < 3) {
      setVariations(prev => prev.map(v => {
        if (v.type !== 'brand-story') return v;
        return { ...v, images: v.images.slice(0, realImages.length).concat(Array(3 - realImages.length).fill(null)), imagesLoading: realImages.length > 0 };
      }));
    }

    // AI Square: 3 calls
    [0, 1, 2].forEach(imgIdx => {
      supabase.functions.invoke('generate-marketing-image', {
        body: {
          brandProfile: bp,
          variationTitle: 'AI Square',
          variationContent: caption,
          contentType,
          tone,
          index: imgIdx,
          palette: paletteChoice,
          size: 'square',
        },
      }).then(async ({ data, error }) => {
        let imageUrl: string | null = null;
        if (!error && data?.success && data.imageUrl) {
          try { imageUrl = await resizeImage(data.imageUrl, 1080, 1080); } catch { imageUrl = data.imageUrl; }
        }
        setVariations(prev => prev.map(v => {
          if (v.type !== 'ai-square') return v;
          const newImgs = [...v.images];
          newImgs[imgIdx] = imageUrl;
          const doneCount = newImgs.filter(x => x !== null).length + newImgs.filter(x => x === null).length - newImgs.filter(x => x === null).length;
          // Mark loading false after all 3 attempted
          const attemptedAll = imgIdx === 2 || newImgs.every(x => x !== null);
          return { ...v, images: newImgs, imagesLoading: !attemptedAll && newImgs.some(x => x === null) };
        }));
      });
    });

    // AI Story: 3 calls
    [0, 1, 2].forEach(imgIdx => {
      supabase.functions.invoke('generate-marketing-image', {
        body: {
          brandProfile: bp,
          variationTitle: 'AI Story',
          variationContent: caption,
          contentType,
          tone,
          index: imgIdx,
          palette: paletteChoice,
          size: 'story',
        },
      }).then(async ({ data, error }) => {
        let imageUrl: string | null = null;
        if (!error && data?.success && data.imageUrl) {
          try { imageUrl = await resizeImage(data.imageUrl, 1080, 1920); } catch { imageUrl = data.imageUrl; }
        }
        setVariations(prev => prev.map(v => {
          if (v.type !== 'ai-story') return v;
          const newImgs = [...v.images];
          newImgs[imgIdx] = imageUrl;
          const attemptedAll = imgIdx === 2 || newImgs.every(x => x !== null);
          return { ...v, images: newImgs, imagesLoading: !attemptedAll && newImgs.some(x => x === null) };
        }));
      });
    });
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

        {/* Brand Assets Section */}
        {brandProfile && (
          <Card className="glass-card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" /> Brand Assets
            </h2>

            {/* Palette Selector */}
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

            {/* Website Images Gallery */}
            {scrapedImages.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Website Images</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {scrapedImages.map((imgUrl, i) => (
                    <div key={i} className="relative shrink-0 w-24 h-24 rounded-lg overflow-hidden group border border-border">
                      <img src={imgUrl} alt={`Website ${i + 1}`} className="w-full h-full object-cover" />
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => downloadImage(imgUrl, `website-image-${i + 1}.jpg`)}
                        className="absolute bottom-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Loading State */}
        {isGenerating && (
          <Card className="glass-card p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-muted-foreground">Generating your marketing content...</p>
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

            <div className="grid gap-6">
              {variations.map((variation, idx) => {
                const validImages = variation.images.filter(Boolean);
                const hasContent = validImages.length > 0 || variation.imagesLoading;

                return (
                  <Card key={idx} className="glass-card overflow-hidden hover-lift">
                    {/* Header */}
                    <div className="flex items-center justify-between p-5 pb-3">
                      <span className="text-xs font-medium text-primary uppercase tracking-wider">
                        {variation.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(variation.caption)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>

                    {/* Carousel or Loading */}
                    <div className="px-5">
                      <div className={`${getMaxWidth(variation.type)} mx-auto`}>
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
                            <Loader2 className="w-3 h-3 animate-spin" /> Generating more images...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Caption */}
                    <div className="p-5 pt-4 border-t border-border mt-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {variation.caption}
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
