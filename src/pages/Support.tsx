import { Bell, Clock, Loader2, PenLine, Users } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SupportThread } from '@/components/support/SupportThread';
import { useMemberSupportConversation } from '@/hooks/useSupportMessages';

const steps = [
  { icon: PenLine, title: 'Leave your question', text: 'Write what you need help with. Add a photo if it helps explain it.' },
  { icon: Clock, title: 'The team reviews it', text: 'A person on the Barber Launch team reads it. This is not an instant chat.' },
  { icon: Bell, title: 'Check back here for the reply', text: 'Replies appear on this page, and a badge shows on Message Support in the menu.' },
];

export default function Support() {
  const { data: conversation, isLoading, error } = useMemberSupportConversation();

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 md:mb-7">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Users className="h-4 w-4" />Human support
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-foreground md:text-4xl">Message the Barber Launch team</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
            Leave your question here and a real person from the team will reply in this conversation later. Your messages are private between you and Barber Launch.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
          <div className="min-w-0">
            {isLoading ? (
              <div className="flex h-60 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Opening your support conversation…</div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">Support is being connected. Please try again in a moment.</div>
            ) : (
              <SupportThread
                variant="member"
                conversationId={conversation?.id}
                title="Your conversation with the team"
                description="Questions you send and the team's replies"
                participantName="Barber Launch team"
              />
            )}
          </div>

          <aside className="rounded-2xl border border-primary/25 bg-card/80 p-5" aria-labelledby="support-how-it-works">
            <h2 id="support-how-it-works" className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">How it works</h2>
            <ol className="mt-4 space-y-4">
              {steps.map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                    <span className="sr-only">Step {index + 1}</span>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
