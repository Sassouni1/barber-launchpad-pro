import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { courses, sampleQuiz } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  CheckCircle2,
  Play,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Lesson() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const [activeTab, setActiveTab] = useState<'video' | 'quiz' | 'homework'>('video');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [homeworkComplete, setHomeworkComplete] = useState(false);

  // Find the lesson
  const lesson = courses
    .flatMap((c) => c.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleName: m.title }))))
    .find((l) => l.id === lessonId);

  if (!lesson) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h1 className="font-display text-2xl font-bold mb-4">Lesson not found</h1>
          <Button onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleQuizSubmit = () => {
    setQuizSubmitted(true);
  };

  const quizScore = quizSubmitted
    ? sampleQuiz.questions.filter((q) => quizAnswers[q.id] === q.correctAnswer).length
    : 0;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-up">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courses')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{lesson.moduleName}</p>
            <h1 className="font-display text-3xl font-bold">{lesson.title}</h1>
          </div>
        </div>

        {/* Video Player */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="aspect-video bg-black/50 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <div className="text-center z-10">
              <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center mx-auto mb-4 cursor-pointer hover:scale-110 transition-transform animate-pulse-gold">
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </div>
              <p className="text-muted-foreground">Click to play lesson video</p>
              <p className="text-sm text-muted-foreground mt-1">{lesson.duration}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Button
            variant={activeTab === 'video' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('video')}
            className={activeTab === 'video' ? 'gold-gradient' : ''}
          >
            <FileText className="w-4 h-4 mr-2" />
            Resources
          </Button>
          {lesson.hasQuiz && (
            <Button
              variant={activeTab === 'quiz' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('quiz')}
              className={activeTab === 'quiz' ? 'gold-gradient' : ''}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Quiz
            </Button>
          )}
          {lesson.hasHomework && (
            <Button
              variant={activeTab === 'homework' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('homework')}
              className={activeTab === 'homework' ? 'gold-gradient' : ''}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Homework
            </Button>
          )}
        </div>

        {/* Tab Content */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {activeTab === 'video' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold mb-2">About This Lesson</h2>
                <p className="text-muted-foreground">{lesson.description}</p>
              </div>

              {lesson.hasDownload && (
                <div>
                  <h3 className="font-semibold mb-3">Downloadable Resources</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-3" />
                      Lesson Notes.pdf
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-3" />
                      Practice Worksheet.pdf
                    </Button>
                  </div>
                </div>
              )}

              <Button className="w-full gold-gradient text-primary-foreground font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </div>
          )}

          {activeTab === 'quiz' && lesson.hasQuiz && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">{sampleQuiz.title}</h2>
                {quizSubmitted && (
                  <div className="text-lg font-bold">
                    Score: <span className="text-primary">{quizScore}/{sampleQuiz.questions.length}</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {sampleQuiz.questions.map((question, qIndex) => (
                  <div key={question.id} className="space-y-3">
                    <p className="font-medium">
                      {qIndex + 1}. {question.question}
                    </p>
                    <div className="space-y-2">
                      {question.options.map((option, oIndex) => {
                        const isSelected = quizAnswers[question.id] === oIndex;
                        const isCorrect = oIndex === question.correctAnswer;
                        const showResult = quizSubmitted;

                        return (
                          <button
                            key={oIndex}
                            onClick={() => !quizSubmitted && setQuizAnswers({ ...quizAnswers, [question.id]: oIndex })}
                            disabled={quizSubmitted}
                            className={cn(
                              'w-full p-4 rounded-lg text-left transition-all duration-300 border',
                              showResult && isCorrect
                                ? 'border-green-500 bg-green-500/10'
                                : showResult && isSelected && !isCorrect
                                ? 'border-destructive bg-destructive/10'
                                : isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'
                            )}
                          >
                            <span className="flex items-center gap-3">
                              <span className={cn(
                                'w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm',
                                isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
                              )}>
                                {String.fromCharCode(65 + oIndex)}
                              </span>
                              {option}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {!quizSubmitted ? (
                <Button
                  className="w-full gold-gradient text-primary-foreground font-semibold"
                  onClick={handleQuizSubmit}
                  disabled={Object.keys(quizAnswers).length !== sampleQuiz.questions.length}
                >
                  Submit Quiz
                </Button>
              ) : (
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                  >
                    Retake Quiz
                  </Button>
                  <Button className="flex-1 gold-gradient text-primary-foreground" onClick={() => setActiveTab('video')}>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'homework' && lesson.hasHomework && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Homework Assignment</h2>
              <div className="bg-secondary/30 p-4 rounded-lg space-y-4">
                <p className="text-muted-foreground">
                  Practice the techniques learned in this lesson and document your progress.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Complete 3 practice sessions</li>
                  <li>Take before and after photos</li>
                  <li>Note any challenges faced</li>
                  <li>Record questions for next lesson</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                <Checkbox
                  checked={homeworkComplete}
                  onCheckedChange={(checked) => setHomeworkComplete(checked as boolean)}
                  className="w-6 h-6"
                />
                <span className="font-medium">I have completed this homework assignment</span>
              </div>

              <Button
                className="w-full gold-gradient text-primary-foreground font-semibold"
                disabled={!homeworkComplete}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit Homework
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
