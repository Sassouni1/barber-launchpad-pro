import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare } from 'lucide-react';
import { useSupportUnreadCount } from '@/hooks/useSupportMessages';
import { supportReplyNoticeText } from '@/lib/supportUnread';

/** Shown on the dashboard only while the signed-in user has unread team replies in their own Support conversation. */
export function SupportReplyNotice() {
  const { data: unreadCount = 0 } = useSupportUnreadCount();
  if (unreadCount <= 0) return null;
  const { title, countLabel } = supportReplyNoticeText(unreadCount);

  return (
    <section
      role="status"
      aria-live="polite"
      aria-labelledby="support-reply-notice-title"
      className="relative overflow-hidden rounded-xl border border-primary/50 bg-card p-4 gold-glow-subtle sm:p-5"
    >
      <div className="absolute inset-y-0 left-0 w-1 gold-gradient" aria-hidden="true" />
      <div className="flex flex-col gap-4 pl-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground" aria-hidden="true">
              {unreadCount}
            </span>
          </div>
          <div className="min-w-0">
            <h2 id="support-reply-notice-title" className="text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              <span className="font-medium text-primary">{countLabel}</span> from the Barber Launch team in Support.
            </p>
          </div>
        </div>
        <Link
          to="/support"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg gold-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
          aria-label={`View reply — ${countLabel}`}
        >
          View reply
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
