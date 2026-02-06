import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ProgressOverview } from '@/components/dashboard/ProgressOverview';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { TodoList } from '@/components/dashboard/TodoList';
import { DynamicTodoList } from '@/components/dashboard/DynamicTodoList';
import { ShippingNotification } from '@/components/dashboard/ShippingNotification';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <ShippingNotification />
        <WelcomeHero />
        
        <div className="space-y-6">
          <DynamicTodoList />
          <TodoList />
          <ProgressOverview />
          <ContinueLearning />
        </div>
      </div>
    </DashboardLayout>
  );
}
