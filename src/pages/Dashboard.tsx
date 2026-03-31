import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { TodoList } from '@/components/dashboard/TodoList';
import { DynamicTodoList } from '@/components/dashboard/DynamicTodoList';
import { NextCallCountdown } from '@/components/dashboard/NextCallCountdown';
import { ShippingNotification } from '@/components/dashboard/ShippingNotification';
import { ContactSection } from '@/components/dashboard/ContactSection';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <ShippingNotification />
        <WelcomeHero />
        
        <div className="space-y-6">
          <DynamicTodoList />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NextCallCountdown />
            <ContinueLearning />
          </div>

          <ContactSection />
        </div>
      </div>
    </DashboardLayout>
  );
}
