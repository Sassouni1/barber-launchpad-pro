import { useEffect, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Globe, Image as ImageIcon, Loader2, ExternalLink, Search, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  emptyPage,
  uploadWebsiteImage,
  useMemberWebsite,
  usePublishWebsite,
  useSaveWebsiteDraft,
  type WebsitePageDocument,
} from '@/hooks/useMemberWebsite';

function PageForm({
  value,
  onChange,
  onUpload,
  uploading,
}: {
  value: WebsitePageDocument;
  onChange: (next: WebsitePageDocument) => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Headline</Label>
        <Input
          value={value.headline}
          onChange={(e) => onChange({ ...value, headline: e.target.value })}
          placeholder="Look 10 years younger in one appointment"
        />
      </div>
      <div className="space-y-2">
        <Label>Subheadline</Label>
        <Input
          value={value.subheadline}
          onChange={(e) => onChange({ ...value, subheadline: e.target.value })}
          placeholder="Non-surgical hair replacement, done right"
        />
      </div>
      <div className="space-y-2">
        <Label>Page content</Label>
        <Textarea
          rows={8}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          placeholder="Tell your clients what you do and why they should book with you."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Button label</Label>
          <Input
            value={value.ctaLabel}
            onChange={(e) => onChange({ ...value, ctaLabel: e.target.value })}
            placeholder="Book a consultation"
          />
        </div>
        <div className="space-y-2">
          <Label>Button link</Label>
          <Input
            value={value.ctaUrl}
            onChange={(e) => onChange({ ...value, ctaUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Main image</Label>
        {value.imageUrl && (
          <img
            src={value.imageUrl}
            alt="Website page"
            className="w-full max-w-sm rounded-lg border border-border"
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-2 h-4 w-4" />}
          {value.imageUrl ? 'Replace image' : 'Upload image'}
        </Button>
      </div>
    </div>
  );
}

export default function WebsiteEditor() {
  const { user } = useAuth();
  const { data: website, isLoading } = useMemberWebsite();
  const publish = usePublishWebsite();

  const [home, setHome] = useState<WebsitePageDocument>(emptyPage());
  const [hairSystem, setHairSystem] = useState<WebsitePageDocument>(emptyPage());
  const [uploading, setUploading] = useState<'home' | 'hair' | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);

  const [domainQuery, setDomainQuery] = useState('');
  const [domainResult, setDomainResult] = useState<{ domain: string; available: boolean | null; price: number | null; currency: string } | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);

  useEffect(() => {
    if (!website) return;
    setHome({ ...emptyPage(), ...(website.home_document || {}) });
    setHairSystem({ ...emptyPage(), ...(website.hair_system_document || {}) });
    setLiveUrl(website.live_url);
  }, [website]);

  const handleUpload = async (which: 'home' | 'hair', file: File) => {
    if (!user) return;
    setUploading(which);
    try {
      const url = await uploadWebsiteImage(user.id, file);
      if (which === 'home') setHome((p) => ({ ...p, imageUrl: url }));
      else setHairSystem((p) => ({ ...p, imageUrl: url }));
      toast.success('Image uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  };

  const handlePublish = async () => {
    try {
      const result = await publish.mutateAsync({ home, hairSystem });
      setLiveUrl(result.liveUrl);
      toast.success('Website published');
      if (result.customDomainError) toast.warning(result.customDomainError);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  const callDomains = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('cloudflare-domains', { body });
    if (error) {
      // Non-2xx responses (e.g. not configured) still carry a JSON body.
      const ctx = (error as { context?: Response }).context;
      const parsed = ctx ? await ctx.json().catch(() => null) : null;
      throw new Error(parsed?.error || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSearchDomain = async () => {
    setDomainBusy(true);
    setDomainResult(null);
    try {
      const data = await callDomains({ action: 'search', domain: domainQuery.trim().toLowerCase() });
      setDomainResult({
        domain: data.domain,
        available: data.available,
        price: data.price,
        currency: data.currency ?? 'USD',
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Domain search failed');
    } finally {
      setDomainBusy(false);
    }
  };

  const handleBuyDomain = async () => {
    if (!domainResult?.price) return;
    const ok = window.confirm(
      `Register ${domainResult.domain} for ${domainResult.currency} ${domainResult.price}? This is a real purchase.`,
    );
    if (!ok) return;
    setDomainBusy(true);
    try {
      await callDomains({
        action: 'register',
        domain: domainResult.domain,
        confirm: true,
        confirmedDomain: domainResult.domain,
        confirmedPrice: domainResult.price,
      });
      toast.success(`${domainResult.domain} registered. Publish again to attach it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setDomainBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Website Editor</h1>
          <p className="text-muted-foreground">Edit your pages, upload images, then save &amp; publish.</p>
        </div>

        {liveUrl && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Your live website</p>
                <p className="truncate font-medium text-foreground">{liveUrl}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                  Open <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your pages</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Tabs defaultValue="home">
                <TabsList className="mb-4">
                  <TabsTrigger value="home">Home</TabsTrigger>
                  <TabsTrigger value="hair-system">Hair System</TabsTrigger>
                </TabsList>
                <TabsContent value="home">
                  <PageForm
                    value={home}
                    onChange={setHome}
                    onUpload={(f) => handleUpload('home', f)}
                    uploading={uploading === 'home'}
                  />
                </TabsContent>
                <TabsContent value="hair-system">
                  <PageForm
                    value={hairSystem}
                    onChange={setHairSystem}
                    onUpload={(f) => handleUpload('hair', f)}
                    uploading={uploading === 'hair'}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={handlePublish} disabled={publish.isPending}>
          {publish.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
          Save &amp; publish
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Custom domain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {website?.custom_domain && (
              <p className="text-sm text-muted-foreground">
                Connected: <span className="text-foreground">{website.custom_domain}</span> ({website.cloudflare_attachment_status})
              </p>
            )}
            <div className="flex gap-2">
              <Input
                value={domainQuery}
                onChange={(e) => setDomainQuery(e.target.value)}
                placeholder="yourbarbershop.com"
              />
              <Button onClick={handleSearchDomain} disabled={domainBusy || !domainQuery.trim()}>
                {domainBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {domainResult && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium text-foreground">{domainResult.domain}</p>
                {domainResult.available === false ? (
                  <p className="text-muted-foreground">Not available.</p>
                ) : domainResult.price ? (
                  <>
                    <p className="text-muted-foreground">
                      Available — {domainResult.currency} {domainResult.price}/year
                    </p>
                    <Button className="mt-3" size="sm" onClick={handleBuyDomain} disabled={domainBusy}>
                      Confirm &amp; register
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">Pricing unavailable.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
