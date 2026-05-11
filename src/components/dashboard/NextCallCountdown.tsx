import { useEffect, useMemo, useState } from 'react';
import { Video, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function getNextOccurrence(dayName: string, hour24: number, minute: number) {
  // Compute the next occurrence of the given weekday/time in America/New_York,
  // then convert to a local Date for countdown.
  const targetDow = DAYS.indexOf(dayName);
  if (targetDow < 0) return null;

  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(now.getTime() + i * 86400000);
    // Get weekday in NY tz
    const nyParts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(candidate);
    const wd = nyParts.find(p => p.type === 'weekday')?.value;
    if (wd !== dayName) continue;

    const y = nyParts.find(p => p.type === 'year')?.value;
    const m = nyParts.find(p => p.type === 'month')?.value;
    const d = nyParts.find(p => p.type === 'day')?.value;
    // Build a UTC instant by figuring NY offset for that date
    const isoLocal = `${y}-${m}-${d}T${String(hour24).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`;
    // Determine NY UTC offset for that date
    const probe = new Date(`${isoLocal}Z`);
    const tzName = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(probe).find(p => p.type === 'timeZoneName')?.value || 'GMT-5';
    const offMatch = tzName.match(/GMT([+-]\d+)(?::?(\d+))?/);
    const offHours = offMatch ? parseInt(offMatch[1], 10) : -5;
    const offMins = offMatch && offMatch[2] ? parseInt(offMatch[2], 10) * Math.sign(offHours) : 0;
    const utcMs = Date.UTC(+y!, +m! - 1, +d!, hour24 - offHours, minute - offMins, 0);
    const target = new Date(utcMs);
    if (target.getTime() > now.getTime()) return target;
  }
  return null;
}

export function NextCallCountdown() {
  const { data: call } = useQuery({
    queryKey: ['next-group-call'],
    queryFn: async () => {
      const { data } = await supabase
        .from('group_calls')
        .select('*')
        .eq('is_active', true)
        .order('order_index')
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 300000,
  });

  const target = useMemo(() => {
    if (!call) return null;
    const h24 = (call.call_ampm === 'PM' ? (call.call_hour % 12) + 12 : call.call_hour % 12);
    return getNextOccurrence(call.day_of_week, h24, call.call_minute);
  }, [call]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!call || !target) return null;

  const diff = target.getTime() - now;
  const live = diff <= 0 && diff > -90 * 60 * 1000;
  const days = Math.max(0, Math.floor(diff / 86400000));
  const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const mins = Math.max(0, Math.floor((diff % 3600000) / 60000));
  const secs = Math.max(0, Math.floor((diff % 60000) / 1000));

  return (
    <div className="glass-card rounded-2xl p-6 border border-primary/30">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2">
            <Video className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-semibold">
              {live ? 'Live Now' : 'Next Live Call'}
            </span>
          </div>
          <h3 className="font-display text-xl font-bold mb-1">{call.title}</h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {call.day_of_week} • {call.time_label}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!live && (
            <div className="flex gap-2 text-center">
              {[
                { v: days, l: 'D' },
                { v: hours, l: 'H' },
                { v: mins, l: 'M' },
                { v: secs, l: 'S' },
              ].map((u) => (
                <div key={u.l} className="bg-secondary/60 rounded-lg px-3 py-2 min-w-[52px]">
                  <div className="font-display text-xl font-bold text-primary tabular-nums">
                    {String(u.v).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{u.l}</div>
                </div>
              ))}
            </div>
          )}
          <Button
            asChild
            className={live ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : 'gold-gradient text-primary-foreground'}
          >
            <a href={call.zoom_link} target="_blank" rel="noopener noreferrer">
              {live ? 'Join Live' : 'Join Call'}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
