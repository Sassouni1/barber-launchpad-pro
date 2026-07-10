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
  const [expandUnpassed, setExpandUnpassed] = useState(false);
  const [expandPassed, setExpandPassed] = useState(false);
  const INITIAL = 5;
  const visibleUnpassed = expandUnpassed ? unpassed : unpassed.slice(0, INITIAL);
  const visiblePassed = expandPassed ? passed : passed.slice(0, INITIAL);

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

      {/* Not completed */}
      {unpassed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Please complete the quizzes below ({unpassed.length})
            </span>
          </div>
          <div className="space-y-2">
            {visibleUnpassed.map((quiz) => {
              const status = quiz.bestScore !== null ? 'failed' : 'not-taken';
              return (
                <button
                  key={quiz.moduleId}
                  type="button"
                  onClick={() => goToQuiz(quiz.moduleId)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border-2 border-amber-500/50 border-l-4 transition-colors group"
                >
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold truncate">{quiz.moduleTitle} Quiz</p>
                    <div className="flex items-center gap-2">
                      <StatusChip status={status} />
                      {quiz.bestScore !== null && (
                        <span className="text-xs text-muted-foreground">Best: {quiz.bestScore}%</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300 flex-shrink-0">
                    {quiz.bestScore !== null ? 'Retake' : 'Take Quiz'}
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </button>
              );
            })}
            {unpassed.length > INITIAL && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                onClick={() => setExpandUnpassed((v) => !v)}
              >
                {expandUnpassed ? 'Show less' : `Show ${unpassed.length - INITIAL} more`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Completed */}
      {passed.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            className="flex items-center justify-between w-full px-1 group"
            onClick={() => setShowPassed((s) => !s)}
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-green-400">
                Completed ({passed.length})
              </span>
            </span>
            {showPassed ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
            )}
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
