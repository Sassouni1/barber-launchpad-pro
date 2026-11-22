import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MetaMessengerInbox } from '@/components/meta/MetaMessengerInbox';
import { messengerToken } from '@/pages/Messenger';

const API_URL = 'https://jbnsjjeimwpkwxkwmqwl.supabase.co/functions/v1/meta-messenger';

export default function MessengerCallback() {
  return <DashboardLayout><div className="mx-auto max-w-2xl"><MetaMessengerInbox
    apiUrl={API_URL} product="barber_launch" getToken={messengerToken}
    returnPath="/messenger" callbackMode
  /></div></DashboardLayout>;
}
