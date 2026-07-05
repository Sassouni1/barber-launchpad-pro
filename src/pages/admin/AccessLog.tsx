import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Shield, Globe, Monitor, Smartphone, Tablet, Loader2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AccessLogRow {
  id: string;
  user_id: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  route: string | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
  referrer: string | null;
  device_type: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  timezone: string | null;
  created_at: string;
  profile?: { full_name: string | null; email: string | null } | null;
}

const EVENT_TYPES = [
  'all',
  'login',
  'session_start',
  'page_view',
  'lesson_view',
  'video_play',
  'video_complete',
  'lesson_complete',
  'file_download',
  'quiz_submit',
  'homework_submit',
  'certificate_view',
  'marketing_image_generate',
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function AccessLog() {
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('all');
  const [days, setDays] = useState('30');
  const [focusUser, setFocusUser] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin-access-log', eventType, days],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days, 10));

      let q = supabase
        .from('access_log')
        .select('*')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);

      if (eventType !== 'all') q = q.eq('event_type', eventType);

      const { data, error } = await q;
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((r) => r.user_id)));
      const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        (profiles || []).forEach((p: any) => profileMap.set(p.id, { full_name: p.full_name, email: p.email }));
      }

      return (data || []).map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) || null })) as AccessLogRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      return (
        r.profile?.email?.toLowerCase().includes(s) ||
        r.profile?.full_name?.toLowerCase().includes(s) ||
        r.ip_address?.toLowerCase().includes(s) ||
        r.city?.toLowerCase().includes(s) ||
        r.country?.toLowerCase().includes(s) ||
        r.route?.toLowerCase().includes(s) ||
        r.event_type?.toLowerCase().includes(s)
      );
    });
  }, [rows, search]);

  const exportCsv = () => {
    const headers = [
      'timestamp', 'user_email', 'user_name', 'event_type', 'route',
      'resource_type', 'resource_id', 'ip_address', 'country', 'region',
      'city', 'isp', 'timezone', 'device_type', 'user_agent', 'referrer',
      'session_id', 'metadata',
    ];
    const lines = [headers.join(',')];
    filtered.forEach((r) => {
      lines.push([
        r.created_at, r.profile?.email, r.profile?.full_name, r.event_type,
        r.route, r.resource_type, r.resource_id, r.ip_address, r.country,
        r.region, r.city, r.isp, r.timezone, r.device_type, r.user_agent,
        r.referrer, r.session_id, r.metadata,
      ].map(csvEscape).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-log-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deviceIcon = (t: string | null) => {
    if (t === 'mobile') return <Smartphone className="w-3 h-3" />;
    if (t === 'tablet') return <Tablet className="w-3 h-3" />;
    return <Monitor className="w-3 h-3" />;
  };

  // Aggregate stats
  const stats = useMemo(() => {
    const uniqUsers = new Set(filtered.map((r) => r.user_id)).size;
    const uniqIps = new Set(filtered.map((r) => r.ip_address).filter(Boolean)).size;
    const uniqCountries = new Set(filtered.map((r) => r.country).filter(Boolean)).size;
    return { total: filtered.length, uniqUsers, uniqIps, uniqCountries };
  }, [filtered]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" /> Access Log
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Deep IP-level tracking — dispute-grade evidence of every member's access.
            </p>
          </div>
          <Button onClick={exportCsv} variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">Events</div><div className="text-2xl font-bold">{stats.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Unique Members</div><div className="text-2xl font-bold">{stats.uniqUsers}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Unique IPs</div><div className="text-2xl font-bold">{stats.uniqIps}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">Countries</div><div className="text-2xl font-bold">{stats.uniqCountries}</div></Card>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search email, name, IP, city, route…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t === 'all' ? 'All events' : t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24h</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No events found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">When</th>
                    <th className="text-left p-3">Member</th>
                    <th className="text-left p-3">Event</th>
                    <th className="text-left p-3">Route / Resource</th>
                    <th className="text-left p-3">IP</th>
                    <th className="text-left p-3">Location</th>
                    <th className="text-left p-3">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">
                        <div>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(r.created_at), 'MMM d, HH:mm:ss')}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{r.profile?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.profile?.email || r.user_id.slice(0, 8)}</div>
                      </td>
                      <td className="p-3"><Badge variant="outline">{r.event_type}</Badge></td>
                      <td className="p-3 max-w-[240px] truncate" title={r.route || ''}>
                        <div className="truncate">{r.route || '—'}</div>
                        {r.resource_id && <div className="text-xs text-muted-foreground truncate">{r.resource_type}: {r.resource_id}</div>}
                      </td>
                      <td className="p-3 font-mono text-xs">{r.ip_address || '—'}</td>
                      <td className="p-3">
                        {r.country ? (
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-muted-foreground" />
                            <span>{[r.city, r.region, r.country].filter(Boolean).join(', ')}</span>
                          </div>
                        ) : '—'}
                        {r.isp && <div className="text-xs text-muted-foreground">{r.isp}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-xs capitalize">
                          {deviceIcon(r.device_type)}
                          {r.device_type || 'unknown'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground">
          Showing up to 2,000 most recent events. IP, geolocation, device and user agent are captured server-side and cannot be spoofed by the client.
        </p>
      </div>
    </DashboardLayout>
  );
}
