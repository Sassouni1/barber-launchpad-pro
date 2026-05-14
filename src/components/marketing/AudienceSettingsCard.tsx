import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useAudienceSettings,
  useUpdateAudienceSettings,
  ETHNICITY_OPTIONS,
  AGE_RANGE_OPTIONS,
  type Ethnicity,
  type AgeRange,
} from '@/hooks/useAudienceSettings';

export function AudienceSettingsCard() {
  const { data, isLoading } = useAudienceSettings();
  const update = useUpdateAudienceSettings();

  const [ethnicities, setEthnicities] = useState<Ethnicity[]>([]);
  const [ageRange, setAgeRange] = useState<AgeRange>('mixed');

  useEffect(() => {
    if (data) {
      setEthnicities(data.target_ethnicities);
      setAgeRange(data.target_age_range);
    }
  }, [data]);

  const toggleEthnicity = (val: Ethnicity) => {
    setEthnicities((prev) =>
      prev.includes(val) ? prev.filter((e) => e !== val) : [...prev, val]
    );
  };

  const handleSave = async () => {
    if (ethnicities.length === 0) {
      toast.error('Pick at least one client type');
      return;
    }
    try {
      await update.mutateAsync({
        target_ethnicities: ethnicities,
        target_age_range: ageRange,
      });
      toast.success('Audience saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
  };

  const dirty =
    !!data &&
    (JSON.stringify([...ethnicities].sort()) !==
      JSON.stringify([...data.target_ethnicities].sort()) ||
      ageRange !== data.target_age_range);

  return (
    <Card className="glass-card p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Your Typical Clients
        </h2>
        <p className="text-xs text-muted-foreground">
          We'll generate models that look like the clients walking into your shop. Pick all that apply — most barbers serve a mix.
        </p>
      </div>

      {/* Ethnicities */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Client Type (multi-select)
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {ETHNICITY_OPTIONS.map((opt) => {
            const selected = ethnicities.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleEthnicity(opt.value)}
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

      {/* Age range */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground uppercase tracking-wider">
          Typical Client Age
        </label>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGE_OPTIONS.map((opt) => {
            const selected = ageRange === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAgeRange(opt.value)}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                  selected
                    ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground'
                    : 'border-border bg-secondary/30 hover:bg-secondary/50 text-muted-foreground'
                }`}
              >
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
          'Save audience'
        ) : (
          'Saved'
        )}
      </Button>
    </Card>
  );
}
