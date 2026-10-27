import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { extraPackages, MAX_ADDITIONAL_PACKAGES, type ExtraChange, type TrackingCarrier } from '../../../supabase/functions/_shared/supplierTracking';

export function AdditionalTracking({ details, onChange, pending = false }: {
  details: unknown; onChange: (change: ExtraChange) => Promise<void>; pending?: boolean;
}) {
  const packages = extraPackages(details);
  const [editing, setEditing] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [carrier, setCarrier] = useState<TrackingCarrier>('DHL');
  const [supplier, setSupplier] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = pending || saving;
  const save = async () => {
    if (editing === null) return;
    if (editing && !window.confirm('Save corrections to this additional package?')) return;
    setSaving(true);
    try {
      await onChange({ action: editing ? 'edit_additional_tracking' : 'add_additional_tracking', originalNumber: editing || undefined,
        trackingNumber: number, carrier, supplierName: supplier });
      setEditing(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save package'); }
    finally { setSaving(false); }
  };
  return <div className="min-w-0 space-y-3" aria-label="Additional package tracking">
    {packages.map((p, i) => <div key={p.tracking_number} className="space-y-1 border-l border-border pl-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Package {i + 2}</span><span className="font-semibold">{p.carrier}</span>
        {p.supplier_name && <span className="break-words">{p.supplier_name}</span>}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="font-mono break-all">{p.tracking_number}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Copy package ${i + 2} tracking`} title="Copy tracking number" onClick={async () => {
          try { await navigator.clipboard.writeText(p.tracking_number); toast.success('Tracking copied'); } catch { toast.error('Could not copy tracking'); }
        }}><Copy className="h-3.5 w-3.5" /></Button>
        {p.tracking_url && <a href={p.tracking_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">Track package</a>}
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={busy} aria-label={`Edit package ${i + 2}`} title="Correct package" onClick={() => {
          setEditing(p.tracking_number); setNumber(p.tracking_number); setCarrier(p.carrier); setSupplier(p.supplier_name);
        }}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={busy} aria-label={`Remove package ${i + 2}`} title="Remove package" onClick={async () => {
          if (!window.confirm('Remove this additional package? The primary tracking number will remain.')) return;
          setSaving(true);
          try { await onChange({ action: 'remove_additional_tracking', originalNumber: p.tracking_number }); setEditing(null); }
          catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove package'); }
          finally { setSaving(false); }
        }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    </div>)}
    {editing === null ? <Button type="button" variant="outline" size="sm" disabled={busy || packages.length >= MAX_ADDITIONAL_PACKAGES} onClick={() => {
      setEditing(''); setNumber(''); setCarrier('DHL'); setSupplier('');
    }}><Plus className="mr-1.5 h-4 w-4" />Add additional tracking</Button> : <div className="max-w-md space-y-2 border-l border-border pl-3">
      <p className="text-sm font-medium">{editing ? 'Correct additional package' : 'Additional package'}</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Additional package carrier">
        {(['DHL', 'FedEx', 'Other'] as const).map(c => <Button type="button" key={c} variant="outline" size="sm" aria-pressed={carrier === c} className={carrier === c ? 'border-primary text-primary' : ''} onClick={() => setCarrier(c)}>{c}</Button>)}
      </div>
      <Input aria-label="Additional tracking number" placeholder="Tracking number" maxLength={100} value={number} onChange={e => setNumber(e.target.value)} />
      <Input aria-label="Additional package supplier" placeholder="Supplier name (optional)" maxLength={80} value={supplier} onChange={e => setSupplier(e.target.value)} />
      <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || !number.trim()} onClick={save}>Save package</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button></div>
    </div>}
  </div>;
}