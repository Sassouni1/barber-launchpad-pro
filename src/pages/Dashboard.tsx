import { ServicesSetupCard } from '@/components/dashboard/ServicesSetupCard';
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
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function Dashboard() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#contact') {
      const el = document.getElementById('contact');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.hash]);
  const { user, isAdmin } = useAuth();
  // Services setup is limited to the website-builder accounts until the flow is released.
  const showServicesSetup = canAccessSecondWebsite(user?.email, isAdmin) || canAccessMyWebsite(user?.id);
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Disabled: <ShippingNotification /> */}
        <WelcomeHero />

        <div className="space-y-6">
          <BusinessSetupCard />
          {showServicesSetup && <ServicesSetupCard />}
          <DynamicTodoList />

          <ContinueLearning />

          

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AionChatCard />
            <ContactSection />
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
