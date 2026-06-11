import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import postImage from '@/assets/hair-system-post-1.png.asset.json';

const CAPTION = `Big news! I'm excited to officially announce that I'm now offering Hair Systems — a non-surgical, same-day solution for men dealing with hair loss.

Helping men look and feel their best is what I love to do, and hair systems can make a huge difference in your confidence, appearance, and daily life.

To celebrate, I'm offering FREE Hair System Consultations.

So if you're tired of hiding under hats, struggling with thinning hair, or looking for a real solution to male hair loss, this could be exactly what you've been looking for.

Send me a message or comment "HAIR" to book your free consultation or learn more.`;

export function FeaturedSocialPost() {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CAPTION);
    setCopied(true);
    toast.success('Caption copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const download = async () => {
    setSaving(true);
    try {
      const res = await fetch(postImage.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hair-systems-announcement.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card p-6 space-y-4 border-primary/30">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          First Social Media Post
        </h2>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-lg overflow-hidden border border-border/50 bg-secondary/30">
          <img
            src={postImage.url}
            alt="Now Offering Hair Systems announcement"
            className="w-full h-auto"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={download}
            disabled={saving}
            className="h-10 w-full rounded-none border-t border-border/50"
          >
            <Download className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Image'}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex-1 rounded-lg border border-border/50 bg-secondary/20 p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {CAPTION}
          </div>
          <Button
            onClick={copy}
            className="gold-gradient text-primary-foreground font-semibold"
          >
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Caption'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
