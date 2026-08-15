import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SupportThread } from '@/components/support/SupportThread';
import { useMemberSupportConversation } from '@/hooks/useSupportMessages';

export default function Support() {
  const { data: conversation, isLoading, error } = useMemberSupportConversation();

  return (
    <DashboardLayout>
      <div className="-m-4 md:mx-auto md:my-0 md:max-w-5xl">
        {isLoading ? (
          <div className="flex h-80 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Opening your support chat…</div>
        ) : error ? (
          <div className="m-4 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">Support chat is being connected. Please try again in a moment.</div>
        ) : (
          <SupportThread conversationId={conversation?.id} title="Barber Launch Support" description="Private conversation" />
        )}
      </div>
    </DashboardLayout>
  );
}
