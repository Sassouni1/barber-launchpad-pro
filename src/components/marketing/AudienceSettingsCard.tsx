import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAudienceSettings,
  useUpdateAudienceSettings,
  ETHNICITY_OPTIONS,
  type Ethnicity,
} from '@/hooks/useAudienceSettings';

export function AudienceSettingsCard() {
  const { data, isLoading } = useAudienceSettings();
  const update = useUpdateAudienceSettings();

  const [ethnicity, setEthnicity] = useState<Ethnicity>('mixed');

  useEffect(() => {
    if (data) setEthnicity(data.target_ethnicity);
  }, [data]);

  const handleSave = async () => {
    try {
      await update.mutateAsync({ target_ethnicity: ethnicity });
      toast.success('Saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const dirty = !!data && ethnicity !== data.target_ethnicity;

  return (
    <Card className="glass-card p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Choose AI Avatar
        </h2>
        <p className="text-xs text-muted-foreground">
          Pick the client type your AI-generated model should look like.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Client Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ETHNICITY_OPTIONS.map((opt) => {
            const selected = ethnicity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEthnicity(opt.value)}
                disabled={isLoading}
                className={`relative flex items-center justify-center text-center px-3 py-3 rounded-lg border text-xs font-medium transition-all ${
                  selected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50 text-muted-foreground'
                }`}
              >
                {selected && (
                  <Check className="w-3 h-3 text-primary absolute top-1.5 right-1.5" />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={!dirty || update.isPending || isLoading}
        className="w-full gold-gradient text-primary-foreground font-semibold"
      >
        {update.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : dirty ? (
          'Save'
        ) : (
          'Saved'
        )}
      </Button>
    </Card>
  );
}
