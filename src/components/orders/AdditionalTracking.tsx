import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { extraPackages, MAX_ADDITIONAL_PACKAGES, type ExtraChange, type TrackingCarrier } from '../../../supabase/functions/_shared/supplierTracking';
import { shippingLocations, shipmentProgress, type ShippingLocations } from '../../../supabase/functions/_shared/supplierShippingLocations';

export function AdditionalTracking({ details, primaryCarrier, onChange, onModeChange, pending = false, isPreview = false }: {
  details: unknown; primaryCarrier: TrackingCarrier | null; onChange: (change: ExtraChange) => Promise<void>;
  onModeChange?: (mode: ShippingLocations) => Promise<void>; pending?: boolean; isPreview?: boolean;
}) {
  const packages = extraPackages(details);
  const mode = shippingLocations(details);
  const progress = shipmentProgress(details, primaryCarrier ? 'primary' : null, primaryCarrier);
  const suggestedCarrier: TrackingCarrier = primaryCarrier === 'DHL' ? 'FedEx' : 'DHL';
  const [editing, setEditing] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [carrier, setCarrier] = useState<TrackingCarrier>('DHL');
  const [saving, setSaving] = useState(false);
  const busy = pending || saving;
  const save = async () => {
    if (editing === null) return;
    if (editing && !isPreview && !window.confirm('Save corrections to this additional package?')) return;
    setSaving(true);
    try {
      await onChange({ action: editing ? 'edit_additional_tracking' : 'add_additional_tracking', originalNumber: editing || undefined,
        trackingNumber: number, carrier, trackingUrl: carrier === 'Other' ? customUrl : undefined });
      setEditing(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save package'); }
    finally { setSaving(false); }
  };
  return <div className="flex min-w-0 flex-wrap items-center gap-3 py-2" aria-label="Additional package tracking">
    {onModeChange && mode && <Button type="button" variant="outline" size="sm" aria-pressed={mode === 'two'} disabled={busy}
      className={`w-fit max-w-full whitespace-normal text-xs font-semibold ${mode === 'two' ? 'border-amber-400 bg-amber-400/25 text-amber-300 hover:bg-amber-400/35 hover:text-amber-200' : 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'}`}
      onClick={() => onModeChange(mode === 'two' ? 'one' : 'two')}>{mode === 'two' && <Check className="mr-1.5 h-4 w-4" />}{mode === 'two' ? 'Shipping from two locations' : 'Shipping from two locations?'}</Button>}
    {packages.map((p, i) => <div key={p.tracking_number} className="w-full space-y-1 border-l border-border pl-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Package {i + 2}</span><span className="font-semibold">{p.carrier}</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="font-mono break-all">{p.tracking_number}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Copy package ${i + 2} tracking`} title="Copy tracking number" onClick={async () => {
          try { await navigator.clipboard.writeText(p.tracking_number); toast.success('Tracking copied'); } catch { toast.error('Could not copy tracking'); }
        }}><Copy className="h-3.5 w-3.5" /></Button>
        {p.tracking_url && <a href={p.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Track package</a>}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label={`Edit package ${i + 2}`} title="Correct package" onClick={() => {
          setEditing(p.tracking_number); setNumber(p.tracking_number); setCarrier(p.carrier); setCustomUrl(p.carrier === 'Other' ? p.tracking_url ?? '' : '');
        }}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={busy} aria-label={`Remove package ${i + 2}`} title="Remove package" onClick={async () => {
          if (!isPreview && !window.confirm('Remove this additional package? The primary tracking number will remain.')) return;
          setSaving(true);
          try { await onChange({ action: 'remove_additional_tracking', originalNumber: p.tracking_number }); setEditing(null); }
          catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove package'); }
          finally { setSaving(false); }
        }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>)}
    {editing === null ? <Button type="button" variant="default" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy || packages.length >= MAX_ADDITIONAL_PACKAGES} onClick={() => {
      setEditing(''); setNumber(''); setCustomUrl(''); setCarrier(mode === 'two' ? suggestedCarrier : 'DHL');
    }}><Plus className="mr-1.5 h-4 w-4" />{mode === 'two' && !progress.hasSecondTracking ? 'Add second tracking' : 'Add additional tracking'}</Button> : <div className="w-full basis-full"><div className="max-w-md space-y-2 border-l border-border pl-3">
      <p className="text-sm font-medium">{editing ? 'Correct additional package' : 'Additional package'}</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Additional package carrier">
        {(['DHL', 'FedEx', 'Other'] as const).map(c => <Button type="button" key={c} variant="outline" size="sm" aria-pressed={carrier === c} className={carrier === c ? 'border-primary text-primary' : ''} onClick={() => setCarrier(c)}>{c}</Button>)}
      </div>
      <Input aria-label="Additional tracking number" placeholder="Tracking number" maxLength={100} value={number} onChange={e => setNumber(e.target.value)} />
      {carrier === 'Other' && <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">Carrier tracking link</p><Input aria-label="Carrier tracking link" type="url" placeholder="https://carrier.com/track/..." maxLength={2048} value={customUrl} onChange={e => setCustomUrl(e.target.value)} /></div>}
      <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || !number.trim() || (carrier === 'Other' && !customUrl.trim())} onClick={save}>Save package</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button></div>
    </div></div>}
  </div>;
}
