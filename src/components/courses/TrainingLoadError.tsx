import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TrainingLoadError({ retry, retrying }: { retry: () => void; retrying: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center" role="alert">
      <AlertTriangle className="h-10 w-10 text-warning" />
      <h1 className="font-display text-2xl font-bold">Training couldn’t load</h1>
      <p className="text-muted-foreground">Please try again. Your training progress has not been changed.</p>
      <Button onClick={retry} disabled={retrying}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {retrying ? 'Retrying…' : 'Try Again'}
      </Button>
    </div>
  );
}