import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AionChat } from '@/components/dashboard/AionChat';
import { Bot } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export default function AionPage() {
  const location = useLocation();
  const initialMessage = (location.state as any)?.initialMessage as string | undefined;
  const sentRef = useRef(false);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Aion</h1>
            <p className="text-sm text-muted-foreground">The Barber Launch Support AI</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl border-primary/10 p-6 flex-1 min-h-0">
          <AionChat initialMessage={!sentRef.current ? initialMessage : undefined} onInitialSent={() => { sentRef.current = true; }} />
        </div>
      </div>
    </DashboardLayout>
  );
}
