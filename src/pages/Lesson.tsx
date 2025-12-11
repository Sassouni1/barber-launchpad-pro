import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses } from '@/hooks/useCourses';
import { useModuleFiles } from '@/hooks/useModuleFiles';
import { useQuizQuestions, useQuizAttempts, useSubmitQuiz, type QuizQuestion } from '@/hooks/useQuiz';
import { useHomeworkSubmission, useSubmitHomework, useDeleteHomeworkFile } from '@/hooks/useHomework';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Download,
  FileText,
  CheckCircle2,
  Play,
  HelpCircle,
  ClipboardList,
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Trophy,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Lesson() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: courses = [], isLoading } = useCourses();
  
  const initialTab = searchParams.get('tab') as 'video' | 'quiz' | 'homework' | null;
  const [activeTab, setActiveTab] = useState<'video' | 'quiz' | 'homework'>(initialTab || 'video');

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as 'video' | 'quiz' | 'homework' | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Find the module
  const module = courses
    .flatMap((c) => (c.modules || []).map((m) => ({ ...m, courseName: c.title })))
    .find((m) => m.id === lessonId);

  // Hooks for module content
  const { data: files = [] } = useModuleFiles(module?.id);
  const { data: questions = [] } = useQuizQuestions(module?.id);
  const { data: attempts = [] } = useQuizAttempts(module?.id);
  const { data: existingSubmission } = useHomeworkSubmission(module?.id);
  
  const submitQuiz = useSubmitQuiz();
  const submitHomework = useSubmitHomework();
  const deleteHomeworkFile = useDeleteHomeworkFile();

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);

  // Homework state
  const [textResponse, setTextResponse] = useState(existingSubmission?.text_response || '');
  const [checklistCompleted, setChecklistCompleted] = useState(existingSubmission?.checklist_completed || false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!module) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h1 className="font-display text-2xl font-bold mb-4">Module not found</h1>
          <Button onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < questions.length) {
      toast.error('Please answer all questions');
      return;
    }

    const answers = Object.entries(quizAnswers).map(([questionId, selectedAnswerId]) => ({
      questionId,
      selectedAnswerId,
    }));

    const result = await submitQuiz.mutateAsync({
      moduleId: module.id,
      answers,
      questions,
    });

    setQuizScore({ score: result.score, total: result.total });
    setShowResults(true);
    toast.success(`Quiz completed! Score: ${result.score}/${result.total}`);
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setShowResults(false);
    setQuizScore(null);
  };

  const handleHomeworkSubmit = async () => {
    await submitHomework.mutateAsync({
      moduleId: module.id,
      textResponse,
      checklistCompleted,
      files: selectedFiles,
    });
    setSelectedFiles([]);
    toast.success('Homework submitted successfully!');
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    await deleteHomeworkFile.mutateAsync({ fileId, moduleId: module.id, fileUrl });
    toast.success('File deleted');
  };

  const bestAttempt = attempts.length > 0 
    ? attempts.reduce((best, current) => 
        (current.score / current.total_questions) > (best.score / best.total_questions) ? current : best
      )
    : null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-up">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courses')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{module.courseName}</p>
            <h1 className="font-display text-3xl font-bold">{module.title}</h1>
          </div>
        </div>

        {/* Video Player */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="aspect-video bg-black relative">
            {module.video_url ? (
              <iframe
                src={module.video_url.includes('vimeo.com') 
                  ? module.video_url.replace('vimeo.com/', 'player.vimeo.com/video/').replace('https://www.', 'https://') + '?autoplay=0&title=0&byline=0&portrait=0'
                  : module.video_url}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={module.title}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center z-10">
                  <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-primary-foreground ml-1" />
                  </div>
                  <p className="text-muted-foreground">No video available</p>
                  {module.duration && (
                    <p className="text-sm text-muted-foreground mt-1">{module.duration}</p>
                  )}
                </div>
              </div>
            )}
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
          {module.has_quiz && (
            <Button
              variant={activeTab === 'quiz' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('quiz')}
              className={activeTab === 'quiz' ? 'gold-gradient' : ''}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Quiz
              {bestAttempt && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                  Best: {Math.round((bestAttempt.score / bestAttempt.total_questions) * 100)}%
                </span>
              )}
            </Button>
          )}
          {module.has_homework && (
            <Button
              variant={activeTab === 'homework' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('homework')}
              className={activeTab === 'homework' ? 'gold-gradient' : ''}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Homework
              {existingSubmission && (
                <CheckCircle2 className="w-4 h-4 ml-2 text-green-400" />
              )}
            </Button>
          )}
        </div>

        {/* Tab Content */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {activeTab === 'video' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold mb-2">About This Module</h2>
                <p className="text-muted-foreground">{module.description || 'No description available.'}</p>
              </div>

              {module.has_download && files.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Downloadable Resources</h3>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors"
                      >
                        <FileText className="w-5 h-5 text-primary" />
                        <span className="flex-1">{file.file_name}</span>
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full gold-gradient text-primary-foreground font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </div>
          )}

          {activeTab === 'quiz' && module.has_quiz && (
            <div className="space-y-6">
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No quiz questions available yet.</p>
                </div>
              ) : showResults && quizScore ? (
                <div className="text-center py-8">
                  <Trophy className="w-16 h-16 mx-auto mb-4 text-primary" />
                  <h2 className="font-display text-3xl font-bold mb-2">
                    {quizScore.score} / {quizScore.total}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {Math.round((quizScore.score / quizScore.total) * 100)}% Correct
                  </p>
                  <Progress 
                    value={(quizScore.score / quizScore.total) * 100} 
                    className="w-64 mx-auto mb-6"
                  />
                  <Button onClick={resetQuiz} variant="outline">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl font-semibold">Module Quiz</h2>
                  <div className="space-y-6">
                    {questions.map((question, index) => (
                      <div key={question.id} className="p-4 rounded-xl bg-secondary/20 border border-border/30">
                        <div className="flex items-start gap-3 mb-4">
                          <span className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <p className="font-medium">{question.question_text}</p>
                            {question.question_image_url && (
                              <img
                                src={question.question_image_url}
                                alt="Question"
                                className="mt-3 max-w-md rounded-lg border border-border/30"
                              />
                            )}
                          </div>
                        </div>
                        <RadioGroup
                          value={quizAnswers[question.id] || ''}
                          onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [question.id]: value }))}
                          className="space-y-2 ml-11"
                        >
                          {question.answers?.map((answer) => (
                            <div
                              key={answer.id}
                              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                            >
                              <RadioGroupItem value={answer.id} id={answer.id} />
                              <Label htmlFor={answer.id} className="cursor-pointer flex-1">
                                {answer.answer_text}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full gold-gradient text-primary-foreground font-semibold"
                    onClick={handleQuizSubmit}
                    disabled={submitQuiz.isPending}
                  >
                    {submitQuiz.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Submit Quiz
                  </Button>
                </>
              )}
            </div>
          )}

          {activeTab === 'homework' && module.has_homework && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Homework Assignment</h2>
              
              <div className="bg-secondary/30 p-4 rounded-lg space-y-4">
                <p className="text-muted-foreground">
                  Complete the following tasks for this module's homework assignment.
                </p>
              </div>

              {/* Text Response */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Written Response</Label>
                <Textarea
                  value={textResponse}
                  onChange={(e) => setTextResponse(e.target.value)}
                  placeholder="Share your thoughts, reflections, or answers..."
                  className="min-h-32 bg-secondary/30"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Upload Photos/Videos</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </Button>
                  {selectedFiles.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.length} file(s) selected
                    </span>
                  )}
                </div>

                {/* Show existing files */}
                {existingSubmission?.files && existingSubmission.files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Previously uploaded:</p>
                    {existingSubmission.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-2 rounded bg-secondary/20"
                      >
                        {file.file_type?.startsWith('image') ? (
                          <ImageIcon className="w-4 h-4 text-primary" />
                        ) : (
                          <FileText className="w-4 h-4 text-primary" />
                        )}
                        <span className="flex-1 text-sm truncate">{file.file_name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => handleDeleteFile(file.id, file.file_url)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                <Checkbox
                  checked={checklistCompleted}
                  onCheckedChange={(checked) => setChecklistCompleted(checked as boolean)}
                  className="w-6 h-6"
                />
                <span className="font-medium">I have completed all homework tasks for this module</span>
              </div>

              <Button
                className="w-full gold-gradient text-primary-foreground font-semibold"
                onClick={handleHomeworkSubmit}
                disabled={submitHomework.isPending}
              >
                {submitHomework.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {existingSubmission ? 'Update Submission' : 'Submit Homework'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
