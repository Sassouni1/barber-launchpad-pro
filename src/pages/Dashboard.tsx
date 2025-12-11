import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';
import { ProgressOverview } from '@/components/dashboard/ProgressOverview';
import { ContinueLearning } from '@/components/dashboard/ContinueLearning';
import { TodoCard } from '@/components/dashboard/TodoCard';
import { dailyTodos, weeklyTodos } from '@/data/mockData';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <WelcomeHero />
        
        <div className="grid md:grid-cols-2 gap-6">
          <TodoCard title="Daily Goals" todos={dailyTodos} type="daily" />
          <TodoCard title="Weekly Goals" todos={weeklyTodos} type="weekly" />
        </div>
        
        <div className="space-y-6">
          <ProgressOverview />
          <ContinueLearning />
        </div>
      </div>
    </DashboardLayout>
  );
}
