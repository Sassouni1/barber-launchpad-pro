import { useMemo } from 'react';
import { useGroupCalls } from '@/hooks/useGroupCalls';
import { parseNextOccurrence, useCountdown } from '@/hooks/useCallCountdown';
import { Video, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-primary-foreground">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Next Group Call: {nextCall.title}
            </h3>
            <p className="text-sm text-muted-foreground">{nextCall.day_of_week} at {nextCall.time_label}</p>
          </div>
        </div>

        {isLive ? (
          <div className="flex items-center gap-2 mb-4">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
            </span>
            <span className="text-green-500 font-semibold text-sm">Live Now!</span>
          </div>
        ) : remaining ? (
          <div className="flex items-center gap-1.5 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {[
              { v: remaining.d, l: 'd' },
              { v: remaining.h, l: 'h' },
              { v: remaining.m, l: 'm' },
              { v: remaining.s, l: 's' },
            ].map((s) => (
              <span key={s.l} className="text-sm font-mono bg-muted/50 px-2 py-1 rounded text-foreground">
                {String(s.v).padStart(2, '0')}<span className="text-muted-foreground">{s.l}</span>
              </span>
            ))}
          </div>
        ) : null}

        <Button asChild size="lg" className="w-full gap-2 text-base font-semibold">
          <Link to="/live-calls">
            View Calls <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
