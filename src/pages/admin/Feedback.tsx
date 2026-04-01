import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FeedbackViewer } from '@/components/admin/FeedbackViewer';

export default function Feedback() {
  return (
    <DashboardLayout isAdminView>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Member Feedback</h1>
          <p className="text-muted-foreground text-lg">View questions and feedback from members.</p>
        </div>
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <FeedbackViewer />
        </div>
      </div>
    </DashboardLayout>
  );
}
