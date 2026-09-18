const DIRECTORY_LISTING_REMINDER_KEY_PREFIX = "barber-launch:directory-listing-reminder-dismissed:";

export function getDirectoryListingReminderKey(userId: string) {
  return `${DIRECTORY_LISTING_REMINDER_KEY_PREFIX}${userId}`;
}
