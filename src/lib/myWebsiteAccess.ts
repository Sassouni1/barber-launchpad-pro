// My Website is enabled for these customized member accounts and the
// isolated Mario Classic end-to-end test account.
const MY_WEBSITE_MEMBER_IDS = new Set([
  '35707edf-3dcb-413e-ba67-9cba70e1dc5e', // Nikkole Abila
  'fc73f257-517e-4319-8639-42a7811410a4', // Brittany Butler
  '2ffdd14a-a19b-414f-b141-78a1d92a47b3', // Mario Zamora Classic test
  'c133a7dd-ab6f-4c0b-af79-68b81c1c20db', // Hollie Fuentes
]);

const NIKKOLE_MEMBER_ID = '35707edf-3dcb-413e-ba67-9cba70e1dc5e';

export const canAccessMyWebsite = (userId: string | undefined) =>
  !!userId && MY_WEBSITE_MEMBER_IDS.has(userId);

// Nikkole's existing published Stay Faded site uses the full editor. Keep its
// menu entry visible while the entitlement request is loading or retrying.
export const myWebsiteMenuPath = (userId: string | undefined) =>
  !canAccessMyWebsite(userId) ? null : userId === NIKKOLE_MEMBER_ID ? '/website' : '/my-website';

export const canAccessSecondWebsite = (email: string | undefined, isAdmin: boolean) =>
  isAdmin && email?.trim().toLowerCase() === 'chris@invasiondigitalmedia.com';
