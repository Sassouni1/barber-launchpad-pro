import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuizProgress {
  moduleId: string;
  moduleTitle: string;
  hasQuiz: boolean;
  bestScore: number | null;
  passed: boolean;
}

interface QuizProgressListProps {
  quizProgress: QuizProgress[];
  onNavigate?: () => void;
}

export function QuizProgressList({ quizProgress, onNavigate }: QuizProgressListProps) {
  const navigate = useNavigate();
  const unpassed = quizProgress.filter((q) => !q.passed);
  const passed = quizProgress.filter((q) => q.passed);
  const total = quizProgress.length;

  const [showPassed, setShowPassed] = useState(unpassed.length === 0);

  const goToQuiz = (moduleId: string) => {
    onNavigate?.();
    navigate(`/courses/lesson/${moduleId}`);
  };

  const StatusChip = ({ status }: { status: 'passed' | 'failed' | 'not-taken' }) => {
    const styles = {
      passed: 'bg-green-500/15 text-green-400 border-green-500/30',
      failed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      'not-taken': 'bg-muted/40 text-muted-foreground border-border',
    } as const;
    const label = { passed: 'Passed', failed: 'Failed', 'not-taken': 'Not taken' }[status];
    return (
      <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', styles[status])}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Quiz Progress</h4>
        <span
          className={cn(
            'text-sm font-semibold px-2.5 py-0.5 rounded-full',
            passed.length === total
              ? 'bg-green-500/20 text-green-400'
              : 'bg-amber-500/20 text-amber-400'
          )}
        >
          {passed.length}/{total} passed
        </span>
      </div>

      {/* Still to pass */}
      {unpassed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Still to pass ({unpassed.length})
          </div>
          <div className="space-y-2">
            {unpassed.map((quiz) => {
              const status = quiz.bestScore !== null ? 'failed' : 'not-taken';
              return (
                <div
                  key={quiz.moduleId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/30 border-l-4"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold truncate">{quiz.moduleTitle} Quiz</p>
                    <div className="flex items-center gap-2">
                      <StatusChip status={status} />
                      {quiz.bestScore !== null && (
                        <span className="text-xs text-muted-foreground">Best: {quiz.bestScore}%</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400 flex-shrink-0"
                    onClick={() => goToQuiz(quiz.moduleId)}
                  >
                    {quiz.bestScore !== null ? 'Retake' : 'Take Quiz'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Passed */}
      {passed.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wide text-green-400 hover:text-green-300"
            onClick={() => setShowPassed((s) => !s)}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Passed ({passed.length})
            </span>
            {showPassed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showPassed && (
            <div className="space-y-2">
              {passed.map((quiz) => (
                <div
                  key={quiz.moduleId}
                  className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{quiz.moduleTitle} Quiz</p>
                  </div>
                  <span className="text-sm font-semibold text-green-400">
                    {quiz.bestScore !== null ? `${quiz.bestScore}%` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Miss no more than 1 question per quiz to qualify.
      </p>
    </div>
  );
}
