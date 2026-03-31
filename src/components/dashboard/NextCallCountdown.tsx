import { useMemo } from 'react';
import { useGroupCalls } from '@/hooks/useGroupCalls';
import { parseNextOccurrence, useCountdown } from '@/hooks/useCallCountdown';
import { Video, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NextCallCountdown() {
  const { data: calls = [] } = useGroupCalls();

  const nextCall = useMemo(() => {
    let soonest: { call: typeof calls[0]; date: Date } | null = null;
    for (const call of calls) {
      const date = parseNextOccurrence(call);
      if (date && (!soonest || date.getTime() < soonest.date.getTime())) {
        soonest = { call, date };
      }
    }
    return soonest?.call ?? null;
  }, [calls]);

  const { remaining, isLive } = useCountdown(nextCall);

  if (!nextCall) return null;

  return (
    <Link to="/live-calls" className="block">
      <div className="glass-card p-4 rounded-2xl flex items-center gap-4 hover:ring-1 hover:ring-primary/30 transition-all">
        <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground shrink-0">
          <Video className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-sm truncate">{nextCall.title}</p>
          <p className="text-xs text-muted-foreground">{nextCall.day_of_week} at {nextCall.time_label}</p>
        </div>

        {isLive ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-green-500 font-semibold text-xs">Live Now!</span>
          </div>
        ) : remaining ? (
          <div className="flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            {[
              { v: remaining.d, l: 'd' },
              { v: remaining.h, l: 'h' },
              { v: remaining.m, l: 'm' },
              { v: remaining.s, l: 's' },
            ].map((s) => (
              <span key={s.l} className="text-xs font-mono bg-muted/50 px-1.5 py-0.5 rounded text-foreground">
                {s.v}<span className="text-muted-foreground">{s.l}</span>
              </span>
            ))}
          </div>
        ) : null}

        <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
