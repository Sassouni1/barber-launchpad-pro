import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGroupCalls, GroupCall } from '@/hooks/useGroupCalls';
import { Video, ExternalLink, Loader2, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Map legacy abbreviations to IANA timezone names
const TZ_TO_IANA: Record<string, string> = {
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  EST: 'America/New_York', EDT: 'America/New_York',
  CST: 'America/Chicago', CDT: 'America/Chicago',
  MST: 'America/Denver', MDT: 'America/Denver',
  PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
};

function getTimezoneOffsetMs(iana: string, date: Date): number {
  // Get the UTC offset for a specific IANA timezone at a given date
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: iana });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}

function parseNextOccurrence(call: GroupCall): Date | null {
  const dayNum = DAY_MAP[call.day_of_week.toLowerCase()];
  if (dayNum === undefined) return null;

  let hour24 = call.call_hour;
  const ampm = (call.call_ampm || 'PM').toUpperCase();
  if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
  if (ampm === 'AM' && hour24 === 12) hour24 = 0;

  const minute = call.call_minute || 0;
  const iana = TZ_TO_IANA[call.call_timezone] ?? 'America/New_York';
  const now = new Date();

  // Get current day-of-week in the call's timezone
  const offsetMs = getTimezoneOffsetMs(iana, now);
  const nowInTz = new Date(now.getTime() + offsetMs);
  const currentDay = nowInTz.getUTCDay();

  let daysUntil = dayNum - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  // Build target date in call's timezone, then convert to UTC
  const targetInTz = new Date(nowInTz);
  targetInTz.setUTCDate(nowInTz.getUTCDate() + daysUntil);
  targetInTz.setUTCHours(hour24, minute, 0, 0);

  // Re-calculate offset at the target date (DST might differ)
  const approxTarget = new Date(targetInTz.getTime() - offsetMs);
  const targetOffsetMs = getTimezoneOffsetMs(iana, approxTarget);
  let target = new Date(targetInTz.getTime() - targetOffsetMs);

  if (target.getTime() <= now.getTime()) {
    target = new Date(target.getTime() + 7 * 86400000);
  }

  return target;
}

function useCountdown(call: GroupCall) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    function update() {
      const target = parseNextOccurrence(call);
      if (!target) { setRemaining(null); return; }

      const diff = target.getTime() - Date.now();
      if (diff <= 0 && diff > -3600000) {
        setIsLive(true);
        setRemaining(null);
        return;
      }
      setIsLive(false);
      const totalSec = Math.max(0, Math.floor(diff / 1000));
      setRemaining({
        d: Math.floor(totalSec / 86400),
        h: Math.floor((totalSec % 86400) / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
      });
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [call.day_of_week, call.call_hour, call.call_minute, call.call_ampm, call.call_timezone]);

  return { remaining, isLive };
}

function CountdownDisplay({ call }: { call: GroupCall }) {
  const { remaining, isLive } = useCountdown(call);

  if (isLive) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-green-500 font-semibold text-sm">Live Now!</span>
      </div>
    );
  }

  if (!remaining) return null;

  const segments = [
    { value: remaining.d, label: 'd' },
    { value: remaining.h, label: 'h' },
    { value: remaining.m, label: 'm' },
    { value: remaining.s, label: 's' },
  ];

  return (
    <div className="flex items-center gap-1.5 mt-2">
      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
      {segments.map((seg) => (
        <span key={seg.label} className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground">
          {seg.value}<span className="text-muted-foreground">{seg.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function LiveCalls() {
  const { data: calls = [], isLoading } = useGroupCalls();

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Group Calls</h1>
          <p className="text-muted-foreground text-lg">Join our upcoming live group calls.</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : calls.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No upcoming calls scheduled.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <div key={call.id} className="glass-card p-6 rounded-2xl animate-fade-up">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center text-primary-foreground">
                    <Video className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-xl font-semibold">{call.title}</h3>
                    <p className="text-muted-foreground">
                      {call.day_of_week} at {call.time_label}
                    </p>
                    <CountdownDisplay call={call} />
                  </div>
                  <Button asChild className="gap-2">
                    <a href={call.zoom_link} target="_blank" rel="noopener noreferrer">
                      Join Zoom Call <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
