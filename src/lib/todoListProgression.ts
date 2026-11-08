type ProgressionItem = {
  completed?: boolean;
  created_at?: string | null;
  completed_at?: string | null;
};

// An item added after someone finished a list remains visible, but cannot
// pull that member back from a list they had already reached.
export function isListCompleteForProgression(items: ProgressionItem[]): boolean {
  if (items.every((item) => item.completed)) return true;

  const creationTimes = [...new Set(items.map((item) => Date.parse(item.created_at || "")))].filter(
    Number.isFinite,
  );

  return creationTimes.some((addedAt) => {
    const olderItems = items.filter((item) => Date.parse(item.created_at || "") < addedAt);
    return olderItems.length > 0 && olderItems.every((item) =>
      item.completed &&
      item.completed_at &&
      Date.parse(item.completed_at) < addedAt,
    );
  });
}
