import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { DynamicTodoList } from '@/components/dashboard/DynamicTodoList';
import { BusinessSetupCard, SETUP_REQUIRED_FROM } from '@/components/dashboard/BusinessSetupCard';

import { ShippingNotification } from '@/components/dashboard/ShippingNotification';
import { ContactSection } from '@/components/dashboard/ContactSection';
import { AionChatCard } from '@/components/dashboard/AionChatCard';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

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
  const { user } = useAuth();
  const profileOnly = location.hash === '#profile';
  const isNewMember = !!user?.created_at && Date.parse(user.created_at) >= Date.parse(SETUP_REQUIRED_FROM);
  const [profileEditing, setProfileEditing] = useState(false);
  const hideDashboardSections = profileOnly || (isNewMember && profileEditing);
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Disabled: <ShippingNotification /> */}
        {!hideDashboardSections && <WelcomeHero />}

        <div className="space-y-6">
          <div id="profile" hidden={!profileOnly && !isNewMember} className="scroll-mt-20">
            {profileOnly && !profileEditing && <Link to="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to dashboard
            </Link>}
            <BusinessSetupCard showServicesSetup onExpandedChange={setProfileEditing} />
          </div>
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
