import { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';

const actions = [
  'Post this on your Instagram page.',
  'Share it on your Instagram story.',
  'Share it on your personal Facebook profile.',
  'Share it on your Facebook business page.',
];

export function AnnouncementActionList({ userId, onCompletionChange, showIncompleteWarning = false, onActionChange }: {
  userId: string;
  onCompletionChange?: (complete: boolean) => void;
  showIncompleteWarning?: boolean;
  onActionChange?: () => void;
}) {
  const storageKey = `barber-launch:announcement-action-list:v2:${userId}`;
  const [checked, setChecked] = useState<boolean[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(saved)) return actions.map((_, index) => saved[index] === true);
    } catch { /* Ignore invalid saved state. */ }
    return actions.map(() => false);
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checked));
  }, [checked, storageKey]);

  const complete = checked.every(Boolean);

  useEffect(() => {
    onCompletionChange?.(complete);
  }, [complete, onCompletionChange]);

  const showWarning = showIncompleteWarning && !complete;

  return <section className={`glass-card rounded-2xl p-4 md:p-6 ${showWarning ? 'border border-destructive/70 bg-destructive/[0.07]' : ''}`} aria-labelledby="announcement-action-list-title">
    <h2 id="announcement-action-list-title" className="font-display text-xl font-semibold mb-4">Your Action List</h2>
    {showWarning && <p className="mb-4 text-sm font-semibold text-destructive">Please complete these actions to move on.</p>}
    <ul className="space-y-3">
      {actions.map((action, index) => {
        const id = `announcement-action-${index}`;
        return <li key={id} className="flex items-start gap-3">
          <Checkbox
            id={id}
            checked={checked[index]}
            onCheckedChange={(value) => {
              setChecked(current => current.map((item, itemIndex) => itemIndex === index ? value === true : item));
              onActionChange?.();
            }}
            className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-primary/80 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <label htmlFor={id} className="cursor-pointer text-sm sm:text-base leading-relaxed">{action}</label>
        </li>;
      })}
    </ul>
  </section>;
}
