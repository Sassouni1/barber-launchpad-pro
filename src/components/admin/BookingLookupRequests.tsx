import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function BookingLookupRequests() {
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['booking-lookup-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_onboarding_profiles')
        .select('user_id, service_city, business_setup_draft, website_url, booking_platform, business_name, booking_link_status, booking_url, profiles(full_name, email)')
        .eq('booking_link_status', 'search')
        .is('booking_url', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
  return <section className="glass-card rounded-2xl p-5 md:p-6">
    <h2 className="font-display text-xl font-semibold">Booking links to find</h2>
    <p className="mt-1 text-sm text-muted-foreground">Members who asked us to find their booking link.</p>
    {isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : isError ? <p className="mt-4 text-sm text-destructive">Could not load requests.</p> : data.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No open requests.</p> :
      <div className="mt-4 space-y-3">{data.map(row => <div key={row.user_id} className="rounded-lg border border-border p-3 text-sm">
        <p className="font-medium">{row.profiles?.full_name || row.profiles?.email || row.user_id}</p>
        {row.business_name && <p>{row.business_name}</p>}
        <p className="text-muted-foreground">{row.service_city ||
          (row.business_setup_draft && typeof row.business_setup_draft === 'object' && !Array.isArray(row.business_setup_draft) &&
            typeof row.business_setup_draft.city === 'string' ? row.business_setup_draft.city : '') || 'City not entered'}</p>
        {row.booking_platform && <p className="text-muted-foreground">Booking app: {row.booking_platform}</p>}
        {row.website_url && <a className="text-primary underline break-all" href={row.website_url} target="_blank" rel="noreferrer">{row.website_url}</a>}
      </div>)}</div>}
  </section>;
}
