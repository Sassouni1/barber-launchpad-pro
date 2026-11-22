import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MetaMessengerInbox } from '@/components/meta/MetaMessengerInbox';
import { supabase } from '@/integrations/supabase/client';

const API_URL = 'https://jbnsjjeimwpkwxkwmqwl.supabase.co/functions/v1/meta-messenger';

export async function messengerToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function Messenger() {
  return <DashboardLayout><div className="mx-auto max-w-6xl"><MetaMessengerInbox
    apiUrl={API_URL} product="barber_launch" getToken={messengerToken} returnPath="/messenger"
  /></div></DashboardLayout>;
}
