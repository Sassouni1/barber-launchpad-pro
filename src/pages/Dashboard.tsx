import { canAccessMyWebsite, canAccessSecondWebsite } from '@/lib/myWebsiteAccess';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { DynamicTodoList } from '@/components/dashboard/DynamicTodoList';
import { BusinessSetupCard } from '@/components/dashboard/BusinessSetupCard';

import { ShippingNotification } from '@/components/dashboard/ShippingNotification';
import { ContactSection } from '@/components/dashboard/ContactSection';
import { AionChatCard } from '@/components/dashboard/AionChatCard';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function Dashboard() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#contact' || location.hash === '#profile') {
      const el = document.getElementById(location.hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.hash]);
  const { user, isAdmin } = useAuth();
  const profileOnly = location.hash === '#profile';
  const [profileEditing, setProfileEditing] = useState(false);
  const hideDashboardSections = profileOnly || profileEditing;
  // Services setup is limited to the website-builder accounts until the flow is released.
  const showServicesSetup = canAccessSecondWebsite(user?.email, isAdmin) || canAccessMyWebsite(user?.id);
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Disabled: <ShippingNotification /> */}
        {!hideDashboardSections && <WelcomeHero />}

        <div className="space-y-6">
          <div id="profile" className="scroll-mt-20"><BusinessSetupCard showServicesSetup={showServicesSetup} onExpandedChange={setProfileEditing} /></div>
          {!hideDashboardSections && <>
            <DynamicTodoList />
            <ContinueLearning />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AionChatCard />
              <ContactSection />
            </div>
          </>}

        </div>
      </div>
    </DashboardLayout>
  );
}
