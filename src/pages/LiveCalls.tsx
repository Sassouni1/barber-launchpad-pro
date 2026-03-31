import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useGroupCalls } from '@/hooks/useGroupCalls';
import { Video, ExternalLink, Loader2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
