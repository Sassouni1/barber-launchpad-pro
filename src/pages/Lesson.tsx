import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses } from '@/hooks/useCourses';
import { useModuleFiles } from '@/hooks/useModuleFiles';
import { useQuizQuestions, useQuizAttempts, useSubmitQuiz, type QuizQuestion } from '@/hooks/useQuiz';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHomeworkSubmission, useSubmitHomework, useDeleteHomeworkFile } from '@/hooks/useHomework';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  ArrowRight,
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
  Video,
  StickyNote,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { getVimeoEmbedUrl } from '@/lib/utils';

// Copyable text component
const CopyableText = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-secondary/50 border border-border/50 rounded text-sm">
      <span className="whitespace-pre-line">{text}</span>
      <button
        onClick={handleCopy}
        className="p-0.5 hover:bg-primary/20 rounded transition-colors flex-shrink-0 self-start mt-0.5"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
        )}
      </button>
    </span>
  );
};

// Helper function to render markdown-style notes content
const renderNotesContent = (content: string) => {
  // Pre-process: Extract all {copy:...} blocks (including multi-line) and replace with placeholders
  const copyBlocks = new Map<string, string>();
  let blockIndex = 0;
  const processedContent = content.replace(/\{copy:([\s\S]*?)\}/g, (match, text) => {
    const placeholder = `__COPY_BLOCK_${blockIndex}__`;
    copyBlocks.set(placeholder, text);
    blockIndex++;
    return placeholder;
  });

  const renderInlineElements = (text: string, keyPrefix: string = '') => {
    // Check for copy block placeholders first
    const placeholderRegex = /__COPY_BLOCK_(\d+)__/g;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    // Combined pattern to find both placeholders and links
    const combinedRegex = /__COPY_BLOCK_\d+__|\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      if (match[0].startsWith('__COPY_BLOCK_')) {
        // It's a copy block placeholder
        const copyText = copyBlocks.get(match[0]);
        if (copyText) {
          parts.push(
            <CopyableText key={`${keyPrefix}-copy-${match.index}`} text={copyText} />
          );
        }
      } else if (match[1] && match[2]) {
        // Link: [text](url)
        parts.push(
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {match[1]}
          </a>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const lines = processedContent.split("\n");
  const elements: JSX.Element[] = [];

  lines.forEach((line, index) => {
    // Bold section headers: **text**
    if (line.match(/^\*\*(.+)\*\*$/)) {
      const title = line.replace(/^\*\*(.+)\*\*$/, "$1");
      elements.push(
        <h4 key={index} className="font-semibold text-foreground mt-4 first:mt-0 mb-2">
          {title}
        </h4>
      );
    }
    // Checklist: - [ ] or - [x]
    else if (line.match(/^- \[([ x])\] /)) {
      const isChecked = line.includes("[x]");
      const text = line.replace(/^- \[[ x]\] /, "");
      elements.push(
        <div key={index} className="flex items-start gap-2 text-muted-foreground ml-2">
          <span className="mt-0.5">{isChecked ? "☑" : "☐"}</span>
          <span>{renderInlineElements(text, `line-${index}`)}</span>
        </div>
      );
    }
    // Bullet points: - text
    else if (line.match(/^- /)) {
      const text = line.replace(/^- /, "");
      elements.push(
        <div key={index} className="flex items-start gap-2 text-muted-foreground ml-2">
          <span className="mt-1">•</span>
          <span>{renderInlineElements(text, `line-${index}`)}</span>
        </div>
      );
    }
    // Empty lines
    else if (line.trim() === "") {
      elements.push(<div key={index} className="h-2" />);
    }
    // Regular text (skip placeholder-only lines as they're handled inline)
    else if (!line.match(/^__COPY_BLOCK_\d+__$/)) {
      elements.push(
        <p key={index} className="text-muted-foreground">
          {renderInlineElements(line, `line-${index}`)}
        </p>
      );
    }
    // Standalone copy blocks (on their own line)
    else {
      const copyText = copyBlocks.get(line);
      if (copyText) {
        elements.push(
          <div key={index} className="my-2">
            <CopyableText text={copyText} />
          </div>
        );
      }
    }
  });

  return elements;
};

export default function Lesson() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: courses = [], isLoading } = useCourses();
  const isMobile = useIsMobile();
  
  const initialTab = searchParams.get('tab') as 'video' | 'quiz' | 'homework' | null;
  const [activeTab, setActiveTab] = useState<'video' | 'quiz' | 'homework'>(initialTab || 'video');

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') as 'video' | 'quiz' | 'homework' | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Find the module and get all modules for navigation
  const allModules = courses.flatMap((c) => 
    (c.modules || []).map((m) => ({ ...m, courseName: c.title, courseId: c.id, courseCategory: c.category }))
  );
  const currentModuleIndex = allModules.findIndex((m) => m.id === lessonId);
  const module = allModules[currentModuleIndex];
  const nextModule = currentModuleIndex >= 0 && currentModuleIndex < allModules.length - 1 
    ? allModules[currentModuleIndex + 1] 
    : null;

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
  const [showReview, setShowReview] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);
  const [correctAnswersMap, setCorrectAnswersMap] = useState<Record<string, string>>({});
  const [incorrectQuestions, setIncorrectQuestions] = useState<Set<string>>(new Set());

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
    });

    // Store the correct answers from the server for review
    setCorrectAnswersMap(result.correctAnswers);

    // Calculate which questions were wrong using server-returned correct answers
    const wrongQuestions = new Set<string>();
    for (const answer of answers) {
      const correctAnswerId = result.correctAnswers[answer.questionId];
      if (correctAnswerId !== answer.selectedAnswerId) {
        wrongQuestions.add(answer.questionId);
      }
    }
    setIncorrectQuestions(wrongQuestions);

    setQuizScore({ score: result.score, total: result.total });
    setShowResults(true);
    toast.success(`Quiz completed! Score: ${result.score}/${result.total}`);
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setShowResults(false);
    setShowReview(false);
    setQuizScore(null);
    setIncorrectQuestions(new Set());
    setCorrectAnswersMap({});
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
      <div className="max-w-5xl mx-auto space-y-4 pb-8">
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

        {/* Video Player - only show if video exists */}
        {module.video_url?.trim() && (
          <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <div className="aspect-video max-h-[50vh] bg-black relative">
              <iframe
                src={getVimeoEmbedUrl(module.video_url)}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                title={module.title}
              />
            </div>
          </div>
        )}

        {/* Tabs - Hide on mobile since we show inline content */}
        {!isMobile && (
          <div className="flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {files.length > 0 && (
              <Button
                variant={activeTab === 'video' ? 'default' : 'secondary'}
                onClick={() => setActiveTab('video')}
                className={activeTab === 'video' ? 'gold-gradient' : ''}
              >
                <FileText className="w-4 h-4 mr-2" />
                Resources
              </Button>
            )}
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
            {nextModule && (
              <Button
                variant="outline"
                onClick={() => navigate(`/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`)}
              >
                Next Lesson
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Mobile: Resources section */}
        {isMobile && module.has_download && files.length > 0 && (() => {
          const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
          const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
          
          const mediaFiles = files.filter(f => {
            if (!f.file_type) return false;
            const ext = f.file_type.toLowerCase();
            return imageExtensions.includes(ext) || videoExtensions.includes(ext);
          });
          const others = files.filter(f => {
            if (!f.file_type) return true;
            const ext = f.file_type.toLowerCase();
            return !imageExtensions.includes(ext) && !videoExtensions.includes(ext);
          });

          const isImage = (fileType: string | null) => fileType && imageExtensions.includes(fileType.toLowerCase());
          const isVideo = (fileType: string | null) => fileType && videoExtensions.includes(fileType.toLowerCase());

          const getDownloadUrl = (fileUrl: string, fileName: string) => {
            const baseUrl = import.meta.env.VITE_SUPABASE_URL;
            return `${baseUrl}/functions/v1/download-file?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
          };

          const MobileFileCard = ({ file }: { file: typeof files[0] }) => (
            <div className="flex flex-col rounded-lg bg-secondary/30 border border-border/30 overflow-hidden min-w-[120px] max-w-[140px] flex-shrink-0">
              {isImage(file.file_type) ? (
                <div className="aspect-square bg-black/20 relative">
                  <img 
                    src={file.file_url} 
                    alt={file.file_name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : isVideo(file.file_type) ? (
                <div className="aspect-square bg-black/40 relative overflow-hidden">
                  <video 
                    src={file.file_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                </div>
              ) : (
                <div className="aspect-square bg-secondary/50 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="p-2 space-y-1">
                <p className="text-xs font-medium truncate" title={file.file_name}>
                  {file.file_name}
                </p>
                <a
                  href={getDownloadUrl(file.file_url, file.file_name)}
                  download={file.file_name}
                  className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="w-3 h-3" />
                  Save
                </a>
              </div>
            </div>
          );

          return (
            <div className="glass-card p-4 rounded-2xl space-y-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="font-display text-lg font-semibold">Resources</h2>
              </div>

              {mediaFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ImageIcon className="w-4 h-4" />
                    <span>Media ({mediaFiles.length})</span>
                  </div>
                  <div
                    className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'auto' }}
                  >
                    {mediaFiles.map((file) => (
                      <MobileFileCard key={file.id} file={file} />
                    ))}
                  </div>
                </div>
              )}

              {others.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span>Other Files ({others.length})</span>
                  </div>
                  <div
                    className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin"
                    style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'auto' }}
                  >
                    {others.map((file) => (
                      <MobileFileCard key={file.id} file={file} />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-center">
                Swipe to see more • Tap Save to download
              </p>
            </div>
          );
        })()}

        {/* Mobile: Quiz header with Next Lesson button */}
        {isMobile && module.has_quiz && (
          <div className="flex items-center justify-between animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Quiz</h2>
              {bestAttempt && (
                <span className="px-2 py-0.5 bg-primary/20 rounded text-xs">
                  Best: {Math.round((bestAttempt.score / bestAttempt.total_questions) * 100)}%
                </span>
              )}
            </div>
            {nextModule && (
              <Button 
                size="sm"
                onClick={() => navigate(`/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`)}
              >
                Next Lesson
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Mobile: Inline Quiz Content */}
        {isMobile && module.has_quiz && (
          <div className="glass-card p-4 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-6">
                  <HelpCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No quiz questions available yet.</p>
                </div>
              ) : showResults && quizScore ? (
                showReview ? (
                  // Mobile Review Mode
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold">Quiz Review</h3>
                      <Button variant="outline" size="sm" onClick={() => setShowReview(false)}>
                        Back to Results
                      </Button>
                    </div>
                    {questions.filter(q => incorrectQuestions.has(q.id)).map((question, index) => {
                      const selectedAnswerId = quizAnswers[question.id];
                      const correctAnswer = question.answers?.find(a => a.is_correct);
                      return (
                        <div key={question.id} className="p-3 rounded-xl bg-destructive/10 border border-destructive/30">
                          <div className="flex items-start gap-2 mb-3">
                            <span className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground flex-shrink-0">
                              ✗
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{question.question_text}</p>
                              {question.question_image_url && (
                                <img
                                  src={question.question_image_url}
                                  alt="Question"
                                  className="mt-2 w-full rounded-lg border border-border/30"
                                />
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 ml-8">
                            {question.answers?.map((answer) => {
                              const isSelected = answer.id === selectedAnswerId;
                              const isCorrect = answer.is_correct;
                              return (
                                <div
                                  key={answer.id}
                                  className={`flex items-center space-x-2 p-2 rounded-lg text-sm ${
                                    isCorrect 
                                      ? 'bg-green-500/20 border border-green-500/50' 
                                      : isSelected 
                                        ? 'bg-destructive/20 border border-destructive/50 line-through opacity-70' 
                                        : 'opacity-50'
                                  }`}
                                >
                                  <span>{isCorrect ? '✓' : isSelected ? '✗' : '○'}</span>
                                  <span>{answer.answer_text}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <Button onClick={resetQuiz} variant="outline" size="sm" className="w-full">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </div>
                ) : (
                  // Mobile Results Summary
                  <div className="text-center py-6">
                    <Trophy className="w-12 h-12 mx-auto mb-3 text-primary" />
                    <h2 className="font-display text-2xl font-bold mb-2">
                      {quizScore.score} / {quizScore.total}
                    </h2>
                    <p className="text-muted-foreground mb-3 text-sm">
                      {Math.round((quizScore.score / quizScore.total) * 100)}% Correct
                    </p>
                    <Progress 
                      value={(quizScore.score / quizScore.total) * 100} 
                      className="w-48 mx-auto mb-4"
                    />
                    <div className="flex flex-col gap-2">
                      {incorrectQuestions.size > 0 && (
                        <Button onClick={() => setShowReview(true)} variant="secondary" size="sm">
                          <HelpCircle className="w-4 h-4 mr-2" />
                          See Wrong Answers ({incorrectQuestions.size})
                        </Button>
                      )}
                      <Button onClick={resetQuiz} variant="outline" size="sm">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id} className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                      <div className="flex items-start gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{question.question_text}</p>
                          {question.question_image_url && (
                            <img
                              src={question.question_image_url}
                              alt="Question"
                              className="mt-2 w-full rounded-lg border border-border/30"
                            />
                          )}
                        </div>
                      </div>
                      <RadioGroup
                        value={quizAnswers[question.id] || ''}
                        onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [question.id]: value }))}
                        className="space-y-2 ml-8"
                      >
                        {question.answers?.map((answer) => (
                          <div
                            key={answer.id}
                            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                          >
                            <RadioGroupItem value={answer.id} id={`mobile-${answer.id}`} />
                            <Label htmlFor={`mobile-${answer.id}`} className="cursor-pointer flex-1 text-sm">
                              {answer.answer_text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  ))}
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Section - only show if there are notes */}
        {module.notes_content && (
          <div className="glass-card p-4 md:p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center gap-2 mb-4">
              <StickyNote className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg md:text-xl font-semibold">Notes</h2>
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              {renderNotesContent(module.notes_content)}
            </div>
          </div>
        )}

        {isMobile && nextModule && (
          <div className="animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <Button 
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={() => navigate(`/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`)}
            >
              Next Lesson
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Desktop: Tab Content */}
        {!isMobile && (
          <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
            {activeTab === 'video' && (
              <div className="space-y-6">
                {module.description && (
                  <div>
                    <h2 className="font-display text-xl font-semibold mb-2">About This Module</h2>
                    <p className="text-muted-foreground">{module.description}</p>
                  </div>
                )}

                {module.has_download && files.length > 0 && (() => {
                  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
                  const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
                  
                  const mediaFiles = files.filter(f => {
                    if (!f.file_type) return false;
                    const ext = f.file_type.toLowerCase();
                    return imageExtensions.includes(ext) || videoExtensions.includes(ext);
                  });
                  const others = files.filter(f => {
                    if (!f.file_type) return true;
                    const ext = f.file_type.toLowerCase();
                    return !imageExtensions.includes(ext) && !videoExtensions.includes(ext);
                  });

                  const isImage = (fileType: string | null) => fileType && imageExtensions.includes(fileType.toLowerCase());
                  const isVideo = (fileType: string | null) => fileType && videoExtensions.includes(fileType.toLowerCase());

                  const getDownloadUrl = (fileUrl: string, fileName: string) => {
                    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                    return `${baseUrl}/functions/v1/download-file?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
                  };

                  const FileCard = ({ file }: { file: typeof files[0] }) => (
                    <div className="flex flex-col rounded-lg bg-secondary/30 border border-border/30 overflow-hidden min-w-[140px] max-w-[160px] flex-shrink-0">
                      {isImage(file.file_type) ? (
                        <div className="aspect-square bg-black/20 relative">
                          <img 
                            src={file.file_url} 
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : isVideo(file.file_type) ? (
                        <div className="aspect-square bg-black/40 relative overflow-hidden">
                          <video 
                            src={file.file_url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Video className="w-10 h-10 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-square bg-secondary/50 flex items-center justify-center">
                          <FileText className="w-10 h-10 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-2 space-y-2">
                        <p className="text-xs font-medium truncate" title={file.file_name}>
                          {file.file_name}
                        </p>
                        <a
                          href={getDownloadUrl(file.file_url, file.file_name)}
                          className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Save
                        </a>
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Downloadable Resources</h3>
                        <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? 's' : ''}</span>
                      </div>

                      {mediaFiles.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                            <span>Media ({mediaFiles.length})</span>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                            {mediaFiles.map((file) => (
                              <FileCard key={file.id} file={file} />
                            ))}
                          </div>
                        </div>
                      )}

                      {others.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="w-4 h-4" />
                            <span>Other Files ({others.length})</span>
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
                            {others.map((file) => (
                              <FileCard key={file.id} file={file} />
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground text-center">
                        Tip: Swipe to see more • Tap Save to download
                      </p>
                    </div>
                  );
                })()}

                <div className="flex flex-col gap-3">
                  {module.has_quiz && (
                    <Button 
                      className="gold-gradient text-primary-foreground font-semibold"
                      onClick={() => setActiveTab('quiz')}
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      Start Quiz
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => nextModule && navigate(`/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`)}
                    disabled={!nextModule}
                  >
                    Next Lesson
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
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
                  showReview ? (
                    // Desktop Review Mode
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-xl font-semibold">Quiz Review - Wrong Answers</h2>
                        <Button variant="outline" onClick={() => setShowReview(false)}>
                          Back to Results
                        </Button>
                      </div>
                      {questions.filter(q => incorrectQuestions.has(q.id)).map((question, index) => {
                        const selectedAnswerId = quizAnswers[question.id];
                        const correctAnswerId = correctAnswersMap[question.id];
                        return (
                          <div key={question.id} className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                            <div className="flex items-start gap-3 mb-4">
                              <span className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-sm font-bold text-destructive-foreground flex-shrink-0">
                                ✗
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
                            <div className="space-y-2 ml-11">
                              {question.answers?.map((answer) => {
                                const isSelected = answer.id === selectedAnswerId;
                                const isCorrect = answer.id === correctAnswerId;
                                return (
                                  <div
                                    key={answer.id}
                                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                                      isCorrect 
                                        ? 'bg-green-500/20 border border-green-500/50' 
                                        : isSelected 
                                          ? 'bg-destructive/20 border border-destructive/50 line-through opacity-70' 
                                          : 'opacity-50'
                                    }`}
                                  >
                                    <span className="text-lg">{isCorrect ? '✓' : isSelected ? '✗' : '○'}</span>
                                    <span>{answer.answer_text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <Button onClick={resetQuiz} variant="outline" className="w-full">
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    // Desktop Results Summary
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
                      <div className="flex flex-col items-center gap-3">
                        {incorrectQuestions.size > 0 && (
                          <Button onClick={() => setShowReview(true)} variant="secondary">
                            <HelpCircle className="w-4 h-4 mr-2" />
                            See Wrong Answers ({incorrectQuestions.size})
                          </Button>
                        )}
                        <Button onClick={resetQuiz} variant="outline">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Try Again
                        </Button>
                      </div>
                    </div>
                  )
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
        )}
      </div>
    </DashboardLayout>
  );
}
