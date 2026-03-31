import { useState, useEffect } from 'react';
import { GroupCall } from '@/hooks/useGroupCalls';

export const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

export const TZ_TO_IANA: Record<string, string> = {
  'US/Eastern': 'America/New_York',
  'US/Central': 'America/Chicago',
  'US/Mountain': 'America/Denver',
  'US/Pacific': 'America/Los_Angeles',
  EST: 'America/New_York', EDT: 'America/New_York',
  CST: 'America/Chicago', CDT: 'America/Chicago',
  MST: 'America/Denver', MDT: 'America/Denver',
  PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
};

export function getTimezoneOffsetMs(iana: string, date: Date): number {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: iana });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}

export function parseNextOccurrence(call: GroupCall): Date | null {
  const dayNum = DAY_MAP[call.day_of_week.toLowerCase()];
  if (dayNum === undefined) return null;

  let hour24 = call.call_hour;
  const ampm = (call.call_ampm || 'PM').toUpperCase();
  if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
  if (ampm === 'AM' && hour24 === 12) hour24 = 0;

  const minute = call.call_minute || 0;
  const iana = TZ_TO_IANA[call.call_timezone] ?? 'America/New_York';
  const now = new Date();

  const offsetMs = getTimezoneOffsetMs(iana, now);
  const nowInTz = new Date(now.getTime() + offsetMs);
  const currentDay = nowInTz.getUTCDay();

  let daysUntil = dayNum - currentDay;
  if (daysUntil < 0) daysUntil += 7;

  const targetInTz = new Date(nowInTz);
  targetInTz.setUTCDate(nowInTz.getUTCDate() + daysUntil);
  targetInTz.setUTCHours(hour24, minute, 0, 0);

  const approxTarget = new Date(targetInTz.getTime() - offsetMs);
  const targetOffsetMs = getTimezoneOffsetMs(iana, approxTarget);
  let target = new Date(targetInTz.getTime() - targetOffsetMs);

  if (target.getTime() <= now.getTime()) {
    target = new Date(target.getTime() + 7 * 86400000);
  }

  return target;
}

export function useCountdown(call: GroupCall | null) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!call) { setRemaining(null); setIsLive(false); return; }

    function update() {
      const target = parseNextOccurrence(call!);
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
  }, [call?.day_of_week, call?.call_hour, call?.call_minute, call?.call_ampm, call?.call_timezone]);

  return { remaining, isLive };
}
