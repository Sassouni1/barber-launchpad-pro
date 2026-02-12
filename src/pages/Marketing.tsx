import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Globe, Sparkles, Copy, RefreshCw, Loader2 } from 'lucide-react';

interface Variation {
  title: string;
  content: string;
}

interface BrandProfile {
  title: string;
  description: string;
  content: string;
  sourceUrl: string;
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

      // Auto-generate after scraping
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

      setVariations(data.variations || []);
      toast.success('Marketing content generated!');
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

  const isLoading = isScraping || isGenerating;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold gold-text">AI Marketing Generator</h1>
          <p className="text-muted-foreground mt-2">
            Paste your website URL and get AI-generated marketing content tailored to your brand.
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

            <div className="grid gap-4">
              {variations.map((variation, idx) => (
                <Card key={idx} className="glass-card p-5 space-y-3 hover-lift">
                  <div className="flex items-center justify-between">
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
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {variation.content}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
