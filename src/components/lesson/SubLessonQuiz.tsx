import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { HelpCircle, ChevronDown, ChevronUp, Loader2, Trophy, RotateCcw, CheckCircle2 } from 'lucide-react';
import {
  useQuizQuestions,
  useQuizAttempts,
  useSubmitQuiz,
} from '@/hooks/useQuiz';
import { toast } from 'sonner';

interface SubLessonQuizProps {
  lessonId: string;
  lessonTitle: string;
}

export function SubLessonQuiz({ lessonId, lessonTitle }: SubLessonQuizProps) {
  const [open, setOpen] = useState(false);
  const { data: questions = [] } = useQuizQuestions({ lessonId });
  const { data: attempts = [] } = useQuizAttempts({ lessonId });
  const submitQuiz = useSubmitQuiz();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [correctMap, setCorrectMap] = useState<Record<string, string>>({});

  const bestAttempt = attempts.length
    ? attempts.reduce((best, a) => (a.score > best.score ? a : best), attempts[0])
    : null;

  const handleSubmit = async () => {
    if (questions.some((q) => !answers[q.id])) {
      toast.error('Please answer all questions');
      return;
    }
    const res = await submitQuiz.mutateAsync({
      lessonId,
      answers: questions.map((q) => ({
        questionId: q.id,
        selectedAnswerId: answers[q.id],
      })),
    });
    setResult({ score: res.score, total: res.total });
    setCorrectMap(res.correctAnswers);
    toast.success(`Quiz complete: ${res.score}/${res.total}`);
  };

  const reset = () => {
    setAnswers({});
    setResult(null);
    setCorrectMap({});
  };

  if (questions.length === 0 && !open) {
    // No questions yet; still show a disabled hint so admin knows to add some
    return (
      <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 flex items-center gap-3 text-sm text-muted-foreground">
        <HelpCircle className="w-4 h-4 text-primary" />
        <span className="flex-1">Quiz: <span className="text-foreground">{lessonTitle}</span></span>
        <span className="text-xs">No questions yet</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-secondary/30 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors"
      >
        <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="flex-1 text-left text-sm font-medium">Quiz: {lessonTitle}</span>
        {bestAttempt && (
          <span className="text-xs text-primary flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Best {bestAttempt.score}/{bestAttempt.total_questions}
          </span>
        )}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No questions available.</p>
          ) : result ? (
            <div className="space-y-4">
              <div className="text-center py-4">
                <Trophy className="w-10 h-10 mx-auto mb-2 text-primary" />
                <p className="font-display text-2xl font-semibold">{result.score} / {result.total}</p>
                <p className="text-sm text-muted-foreground">
                  {result.score === result.total ? 'Perfect score!' : 'Quiz complete'}
                </p>
              </div>
              <Button onClick={reset} variant="outline" size="sm" className="w-full">
                <RotateCcw className="w-3 h-3 mr-2" /> Try Again
              </Button>
            </div>
          ) : (
            <>
              {questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    {qIdx + 1}. {q.question_text}
                  </p>
                  {q.question_image_url && (
                    <img src={q.question_image_url} alt="" className="rounded-lg max-h-48" />
                  )}
                  <RadioGroup
                    value={answers[q.id] || ''}
                    onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    className="space-y-1"
                  >
                    {q.answers?.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center space-x-2 rounded-md px-2 py-1.5 hover:bg-secondary/50"
                      >
                        <RadioGroupItem value={a.id} id={`${q.id}-${a.id}`} />
                        <Label htmlFor={`${q.id}-${a.id}`} className="flex-1 cursor-pointer text-sm">
                          {a.answer_text}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <Button
                onClick={handleSubmit}
                disabled={submitQuiz.isPending}
                className="w-full gold-gradient text-primary-foreground"
                size="sm"
              >
                {submitQuiz.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Submit Quiz
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


