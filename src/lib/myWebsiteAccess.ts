// My Website is currently enabled only for these two customized member accounts.
const MY_WEBSITE_MEMBER_IDS = new Set([
  '35707edf-3dcb-413e-ba67-9cba70e1dc5e', // Nikkole Abila
  'fc73f257-517e-4319-8639-42a7811410a4', // Brittany Butler
]);

export const canAccessMyWebsite = (userId: string | undefined) =>
  !!userId && MY_WEBSITE_MEMBER_IDS.has(userId);

export const canAccessSecondWebsite = (email: string | undefined, isAdmin: boolean) =>
  isAdmin && email?.trim().toLowerCase() === 'chris@invasiondigitalmedia.com';
