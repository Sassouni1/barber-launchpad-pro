const HOUR_MS = 60 * 60 * 1000;
const TWO_BUSINESS_DAYS_MS = 48 * HOUR_MS;
const chinaWeekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', weekday: 'short' });

// Count elapsed weekday hours in the supplier's time zone. China has no daylight
// saving time, so its day boundaries always fall on UTC hour boundaries.
export function isNewOrderOverdue(orderDate: string, now: number): boolean {
  const placedAt = Date.parse(orderDate);
  if (!Number.isFinite(placedAt) || now <= placedAt) return false;

  let businessTime = 0;
  for (let start = placedAt; start < now; ) {
    const end = Math.min(now, Math.floor(start / HOUR_MS + 1) * HOUR_MS);
    const weekday = chinaWeekday.format(start);
    if (weekday !== 'Sat' && weekday !== 'Sun') businessTime += end - start;
    if (businessTime >= TWO_BUSINESS_DAYS_MS) return true;
    start = end;
  }
  return false;
}
