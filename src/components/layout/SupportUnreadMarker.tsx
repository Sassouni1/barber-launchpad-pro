import { cn } from '@/lib/utils';

/** Screen-reader wording for unread team Support replies. */
export function supportUnreadSrText(count: number) {
  return `${count} new support ${count === 1 ? 'reply' : 'replies'}`;
}

/** "1 new" pill for the parent Get Support row (visible even while its submenu is collapsed). */
export function SupportNewPill({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="get-support-new"
        className={cn(
          'inline-flex h-5 flex-shrink-0 items-center whitespace-nowrap rounded-full bg-primary px-2 text-[11px] font-bold leading-none text-primary-foreground',
          className,
        )}
      >
        {count > 99 ? '99+' : count} new
      </span>
      <span className="sr-only">{supportUnreadSrText(count)}</span>
    </>
  );
}

/** Small count on the Get Support icon when the desktop sidebar is collapsed. */
export function SupportIconCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <>
      <span
        aria-hidden="true"
        data-testid="get-support-icon-count"
        className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background"
      >
        {count > 9 ? '9+' : count}
      </span>
      <span className="sr-only">{supportUnreadSrText(count)}</span>
    </>
  );
}
