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
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center text-primary-foreground">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Next Group Call</h3>
            <p className="text-sm text-muted-foreground">{nextCall.day_of_week} at {nextCall.time_label}</p>
          </div>
        </div>

        <p className="font-display text-xl font-semibold mb-4">{nextCall.title}</p>

        {isLive ? (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-5">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
            </span>
            <span className="text-green-500 font-bold text-lg">Live Now!</span>
          </div>
        ) : remaining ? (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { v: remaining.d, l: 'Days' },
              { v: remaining.h, l: 'Hours' },
              { v: remaining.m, l: 'Min' },
              { v: remaining.s, l: 'Sec' },
            ].map((s) => (
              <div key={s.l} className="bg-muted/50 rounded-xl p-3 text-center">
                <span className="block text-2xl font-mono font-bold text-foreground">
                  {String(s.v).padStart(2, '0')}
                </span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{s.l}</span>
              </div>
            ))}
          </div>
        ) : null}

        <Button asChild className="w-full gap-2" size="lg">
          <Link to="/live-calls">
            {isLive ? 'Join Now' : 'View All Calls'} <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
