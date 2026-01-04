import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
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
}

export function QuizProgressList({ quizProgress }: QuizProgressListProps) {
  const passedCount = quizProgress.filter(q => q.passed).length;
  const totalCount = quizProgress.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Quiz Progress</h4>
        <span className={cn(
          "text-sm font-medium px-2 py-0.5 rounded-full",
          passedCount === totalCount 
            ? "bg-green-500/20 text-green-400" 
            : "bg-amber-500/20 text-amber-400"
        )}>
          {passedCount}/{totalCount} passed
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {quizProgress.map((quiz) => (
          <div
            key={quiz.moduleId}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-colors",
              quiz.passed 
                ? "bg-green-500/5 border-green-500/20" 
                : "bg-secondary/30 border-border"
            )}
          >
            {quiz.passed ? (
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            ) : quiz.bestScore !== null ? (
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            ) : (
              <HelpCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{quiz.moduleTitle}</p>
            </div>
            <span className={cn(
              "text-sm font-semibold",
              quiz.passed ? "text-green-400" : quiz.bestScore !== null ? "text-red-400" : "text-muted-foreground"
            )}>
              {quiz.bestScore !== null ? `${quiz.bestScore}%` : 'Not taken'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        You need 80% or higher on all quizzes to qualify for certification.
      </p>
    </div>
  );
}
