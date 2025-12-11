import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ColorMatchGame } from '@/components/training/ColorMatchGame';

export default function Training() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold gold-text mb-2">
            Hair Color Training
          </h1>
          <p className="text-muted-foreground">
            Learn to identify hair color codes by examining hair samples
          </p>
        </div>
        
        <ColorMatchGame />
      </div>
    </DashboardLayout>
  );
}
