// Pages where the floating Aion assistant may appear. /support is excluded so the
// Message Support page never opens under an Aion chat panel or bubble.
export const AION_ASSISTANT_PATHS = [
  '/dashboard',
  '/courses',
  '/todos',
  '/products',
  '/training',
  '/schedule-call',
  '/orders',
  '/marketing',
  '/social-media-post',
  '/ads',
  '/website',
  '/affiliates',
  '/content-rewards',
  '/rewards',
  '/checklist',
  '/business-card',
  '/my-links',
];

export function isAionAssistantPath(pathname: string) {
  return AION_ASSISTANT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Set on <body> while the phone navigation menu is open; the floating assistant hides then. */
export const MOBILE_NAV_OPEN_ATTR = 'data-mobile-nav-open';
