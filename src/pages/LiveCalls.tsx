import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGroupCalls } from '@/hooks/useGroupCalls';
import { Video, ExternalLink, Loader2, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const TZ_OFFSETS: Record<string, number> = {
  EST: -5, EDT: -4, CST: -6, CDT: -5,
  MST: -7, MDT: -6, PST: -8, PDT: -7,
};

function parseNextOccurrence(dayOfWeek: string, timeLabel: string): Date | null {
  const dayNum = DAY_MAP[dayOfWeek.toLowerCase()];
  if (dayNum === undefined) return null;

  const timeMatch = timeLabel.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2] || '0');
  const ampm = timeMatch[3].toLowerCase();
  if (ampm === 'pm' && hour !== 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  const tzMatch = timeLabel.match(/\b([A-Z]{2,4}T?)\b/i);
  const tzAbbr = tzMatch ? tzMatch[1].toUpperCase() : null;
  const tzOffset = tzAbbr && TZ_OFFSETS[tzAbbr] !== undefined ? TZ_OFFSETS[tzAbbr] : null;

  const now = new Date();

  if (tzOffset !== null) {
    // Build target in UTC using the timezone offset
    const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
      now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    
    // Find next occurrence of this day
    const todayUtc = new Date(nowUtc);
    const currentDayUtc = todayUtc.getUTCDay();
    let daysUntil = dayNum - currentDayUtc;
    if (daysUntil < 0) daysUntil += 7;

    const target = new Date(todayUtc);
    target.setUTCDate(target.getUTCDate() + daysUntil);
    target.setUTCHours(hour - tzOffset, minute, 0, 0);

    if (target.getTime() < now.getTime()) {
      target.setUTCDate(target.getUTCDate() + 7);
    }
    return target;
  } else {
    // Fallback: use local time
    const currentDay = now.getDay();
    let daysUntil = dayNum - currentDay;
    if (daysUntil < 0) daysUntil += 7;

    const target = new Date(now);
    target.setDate(now.getDate() + daysUntil);
    target.setHours(hour, minute, 0, 0);

    if (target.getTime() < now.getTime()) {
      target.setDate(target.getDate() + 7);
    }
    return target;
  }
}

function useCountdown(dayOfWeek: string, timeLabel: string) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    function update() {
      const target = parseNextOccurrence(dayOfWeek, timeLabel);
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
  }, [dayOfWeek, timeLabel]);

  return { remaining, isLive };
}

function CountdownDisplay({ dayOfWeek, timeLabel }: { dayOfWeek: string; timeLabel: string }) {
  const { remaining, isLive } = useCountdown(dayOfWeek, timeLabel);

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
                    <CountdownDisplay dayOfWeek={call.day_of_week} timeLabel={call.time_label} />
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
