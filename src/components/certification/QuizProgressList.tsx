import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Circle, Clock3, ArrowRight } from 'lucide-react';
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

const INITIAL_VISIBLE = 3;

export function QuizProgressList({ quizProgress, onNavigate }: QuizProgressListProps) {
  const navigate = useNavigate();
  const [showRetakes, setShowRetakes] = useState(true);
  const [showNotStarted, setShowNotStarted] = useState(true);
  const [showAllRetakes, setShowAllRetakes] = useState(false);
  const [showAllNotStarted, setShowAllNotStarted] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  const passed = quizProgress.filter((quiz) => quiz.passed);
  const unpassed = quizProgress.filter((quiz) => !quiz.passed);
  const retakes = unpassed.filter((quiz) => quiz.bestScore !== null);
  const notStarted = unpassed.filter((quiz) => quiz.bestScore === null);

  const goToQuiz = (moduleId: string) => {
    onNavigate?.();
    navigate(`/courses/lesson/${moduleId}`);
  };

  const renderQuizRow = (quiz: QuizProgress, status: 'retake' | 'not-started') => {
    const isRetake = status === 'retake';

    return (
      <button
        key={quiz.moduleId}
        type="button"
        onClick={() => goToQuiz(quiz.moduleId)}
        className={cn(
          'w-full min-w-0 text-left flex items-center gap-3 px-3 py-3 transition-colors group',
          'border-t border-border/70 first:border-t-0',
          isRetake ? 'hover:bg-red-500/10' : 'hover:bg-primary/5'
        )}
      >
        {isRetake ? (
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{quiz.moduleTitle} Quiz</p>
          {isRetake && quiz.bestScore !== null ? (
            <p className="text-xs text-muted-foreground mt-0.5">Best: {quiz.bestScore}%</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Not started</p>
          )}
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold flex-shrink-0',
          isRetake ? 'text-red-400' : 'text-primary'
        )}>
          {isRetake ? 'Retake' : 'Start Lesson'}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </button>
    );
  };

  const renderSection = ({
    title,
    count,
    icon,
    accent,
    open,
    onToggle,
    showAll,
    onShowAll,
    items,
    status,
  }: {
    title: string;
    count: number;
    icon: ReactNode;
    accent: string;
    open: boolean;
    onToggle: () => void;
    showAll: boolean;
    onShowAll: () => void;
    items: QuizProgress[];
    status: 'retake' | 'not-started';
  }) => {
    const visible = showAll ? items : items.slice(0, INITIAL_VISIBLE);
    const remaining = Math.max(items.length - INITIAL_VISIBLE, 0);

    return (
      <div className={cn('rounded-xl border overflow-hidden', accent)}>
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            {icon}
            {title} ({count})
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="mx-2 mb-2 rounded-lg bg-background/40 overflow-hidden">
            {visible.map((quiz) => renderQuizRow(quiz, status))}
            {remaining > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full rounded-none border-t border-border/70 text-primary hover:bg-primary/10"
                onClick={onShowAll}
              >
                {showAll ? 'Show less' : `View all ${items.length}`}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {retakes.length > 0 && renderSection({
        title: 'Needs retake',
        count: retakes.length,
        icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
        accent: 'border-red-500/30 bg-red-500/5',
        open: showRetakes,
        onToggle: () => setShowRetakes((value) => !value),
        showAll: showAllRetakes,
        onShowAll: () => setShowAllRetakes((value) => !value),
        items: retakes,
        status: 'retake',
      })}

      {notStarted.length > 0 && renderSection({
        title: 'Not started',
        count: notStarted.length,
        icon: <Clock3 className="w-4 h-4 text-muted-foreground" />,
        accent: 'border-border bg-secondary/20',
        open: showNotStarted,
        onToggle: () => setShowNotStarted((value) => !value),
        showAll: showAllNotStarted,
        onShowAll: () => setShowAllNotStarted((value) => !value),
        items: notStarted,
        status: 'not-started',
      })}

      {passed.length > 0 && (
        <div className="rounded-xl border border-green-500/25 bg-green-500/5 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCompleted((value) => !value)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Completed ({passed.length})
            </span>
            {showCompleted ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showCompleted && (
            <div className="mx-2 mb-2 rounded-lg bg-background/30 overflow-hidden">
              {passed.map((quiz) => (
                <div key={quiz.moduleId} className="flex items-center gap-3 px-3 py-3 border-t border-green-500/10 first:border-t-0">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <p className="flex-1 min-w-0 text-sm font-medium truncate">{quiz.moduleTitle} Quiz</p>
                  <span className="text-sm font-semibold text-green-400">{quiz.bestScore !== null ? `${quiz.bestScore}%` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">Miss no more than 1 question per quiz to qualify.</p>
    </div>
  );
}
