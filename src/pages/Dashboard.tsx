import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ProgressOverview } from '@/components/dashboard/ProgressOverview';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { TodoList } from '@/components/dashboard/TodoList';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <WelcomeHero />
        
        <div className="space-y-6">
          <TodoList />
          <ProgressOverview />
          <ContinueLearning />
        </div>
      </div>
    </DashboardLayout>
  );
}
