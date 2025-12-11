import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useQuizQuestions,
  useCreateQuizQuestion,
  useUpdateQuizQuestion,
  useDeleteQuizQuestion,
  useUploadQuestionImage,
  type QuizQuestion,
} from '@/hooks/useQuiz';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Edit2,
  Image as ImageIcon,
  Loader2,
  HelpCircle,
  Check,
  X,
} from 'lucide-react';

interface QuizManagerProps {
  moduleId: string;
  moduleName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AnswerInput = { id?: string; answer_text: string; is_correct: boolean };

export function QuizManager({ moduleId, moduleName, open, onOpenChange }: QuizManagerProps) {
  const { data: questions = [], isLoading } = useQuizQuestions(moduleId);
  const createQuestion = useCreateQuizQuestion();
  const updateQuestion = useUpdateQuizQuestion();
  const deleteQuestion = useDeleteQuizQuestion();
  const uploadImage = useUploadQuestionImage();

  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizQuestion | null>(null);

  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'true_false'>('multiple_choice');
  const [questionImageUrl, setQuestionImageUrl] = useState('');
  const [answers, setAnswers] = useState<AnswerInput[]>([
    { answer_text: '', is_correct: true },
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false },
    { answer_text: '', is_correct: false },
  ]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const resetForm = () => {
    setQuestionText('');
    setQuestionType('multiple_choice');
    setQuestionImageUrl('');
    setAnswers([
      { answer_text: '', is_correct: true },
      { answer_text: '', is_correct: false },
      { answer_text: '', is_correct: false },
      { answer_text: '', is_correct: false },
    ]);
    setEditingQuestion(null);
  };

  const openNewQuestion = () => {
    resetForm();
    setShowQuestionDialog(true);
  };

  const openEditQuestion = (question: QuizQuestion) => {
    setEditingQuestion(question);
    setQuestionText(question.question_text);
    setQuestionType(question.question_type);
    setQuestionImageUrl(question.question_image_url || '');
    if (question.question_type === 'true_false') {
      setAnswers([
        { answer_text: 'True', is_correct: question.answers?.find(a => a.answer_text === 'True')?.is_correct ?? false },
        { answer_text: 'False', is_correct: question.answers?.find(a => a.answer_text === 'False')?.is_correct ?? true },
      ]);
    } else {
      setAnswers(
        question.answers?.map(a => ({
          id: a.id,
          answer_text: a.answer_text,
          is_correct: a.is_correct,
        })) || []
      );
    }
    setShowQuestionDialog(true);
  };

  const handleTypeChange = (type: 'multiple_choice' | 'true_false') => {
    setQuestionType(type);
    if (type === 'true_false') {
      setAnswers([
        { answer_text: 'True', is_correct: true },
        { answer_text: 'False', is_correct: false },
      ]);
    } else {
      setAnswers([
        { answer_text: '', is_correct: true },
        { answer_text: '', is_correct: false },
        { answer_text: '', is_correct: false },
        { answer_text: '', is_correct: false },
      ]);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadImage.mutateAsync({ moduleId, file });
      setQuestionImageUrl(url);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    const filteredAnswers = answers.filter(a => a.answer_text.trim());
    if (!questionText.trim() || filteredAnswers.length < 2) return;

    if (editingQuestion) {
      await updateQuestion.mutateAsync({
        id: editingQuestion.id,
        module_id: moduleId,
        question_text: questionText,
        question_image_url: questionImageUrl || undefined,
        question_type: questionType,
        answers: filteredAnswers,
      });
    } else {
      await createQuestion.mutateAsync({
        module_id: moduleId,
        question_text: questionText,
        question_image_url: questionImageUrl || undefined,
        question_type: questionType,
        answers: filteredAnswers,
      });
    }

    setShowQuestionDialog(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteQuestion.mutateAsync({ questionId: deleteTarget.id, moduleId });
    setDeleteTarget(null);
  };

  const setCorrectAnswer = (index: number) => {
    setAnswers(answers.map((a, i) => ({ ...a, is_correct: i === index })));
  };

  // Close main dialog when opening question dialog to avoid nesting issues
  const handleOpenNewQuestion = () => {
    onOpenChange(false);
    resetForm();
    setTimeout(() => setShowQuestionDialog(true), 100);
  };

  const handleOpenEditQuestion = (question: QuizQuestion) => {
    onOpenChange(false);
    setTimeout(() => {
      openEditQuestion(question);
    }, 100);
  };

  const handleCloseQuestionDialog = (isOpen: boolean) => {
    setShowQuestionDialog(isOpen);
    if (!isOpen) {
      resetForm();
      setTimeout(() => onOpenChange(true), 100);
    }
  };

  const handleSaveAndReturn = async () => {
    await handleSave();
    setTimeout(() => onOpenChange(true), 100);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="glass-card border-border/50 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              Quiz Manager - {moduleName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <Button onClick={handleOpenNewQuestion} className="gold-gradient text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" />
              Add Question
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No questions yet. Add your first question!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="p-4 rounded-lg bg-secondary/30 border border-border/30"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{question.question_text}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {question.question_type === 'true_false' ? 'True/False' : 'Multiple Choice'}
                            </p>
                          </div>
                          {question.question_image_url && (
                            <img
                              src={question.question_image_url}
                              alt="Question"
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          {question.answers?.map((answer) => (
                            <div
                              key={answer.id}
                              className={`text-sm px-2 py-1 rounded ${
                                answer.is_correct
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {answer.is_correct && <Check className="w-3 h-3 inline mr-1" />}
                              {answer.answer_text}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditQuestion(question)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(question)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Dialog - Separate from main dialog to avoid nesting */}
      <Dialog open={showQuestionDialog} onOpenChange={handleCloseQuestionDialog}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editingQuestion ? 'Edit Question' : 'New Question'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <RadioGroup
                value={questionType}
                onValueChange={(v) => handleTypeChange(v as 'multiple_choice' | 'true_false')}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="multiple_choice" id="mc" />
                  <Label htmlFor="mc">Multiple Choice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true_false" id="tf" />
                  <Label htmlFor="tf">True/False</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Question</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Enter your question..."
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Question Image (optional)</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4 mr-2" />
                  )}
                  Upload Image
                </Button>
                {questionImageUrl && (
                  <div className="relative">
                    <img src={questionImageUrl} alt="Preview" className="w-12 h-12 object-cover rounded" />
                    <button
                      onClick={() => setQuestionImageUrl('')}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Answers (click to mark correct)</Label>
              <div className="space-y-2">
                {answers.map((answer, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectAnswer(index)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        answer.is_correct
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-border hover:border-primary'
                      }`}
                    >
                      {answer.is_correct && <Check className="w-4 h-4" />}
                    </button>
                    <Input
                      value={answer.answer_text}
                      onChange={(e) => {
                        const newAnswers = [...answers];
                        newAnswers[index].answer_text = e.target.value;
                        setAnswers(newAnswers);
                      }}
                      placeholder={`Answer ${index + 1}`}
                      className="bg-secondary/50"
                      disabled={questionType === 'true_false'}
                    />
                    {questionType === 'multiple_choice' && answers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newAnswers = answers.filter((_, i) => i !== index);
                          // Ensure at least one is marked correct
                          if (answer.is_correct && newAnswers.length > 0) {
                            newAnswers[0].is_correct = true;
                          }
                          setAnswers(newAnswers);
                        }}
                        className="w-6 h-6 rounded-full border border-destructive/50 flex items-center justify-center flex-shrink-0 text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {questionType === 'multiple_choice' && answers.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAnswers([...answers, { answer_text: '', is_correct: false }])}
                    className="mt-2"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Answer
                  </Button>
                )}
              </div>
            </div>

            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveAndReturn}
              disabled={
                !questionText.trim() ||
                answers.filter(a => a.answer_text.trim()).length < 2 ||
                createQuestion.isPending ||
                updateQuestion.isPending
              }
            >
              {createQuestion.isPending || updateQuestion.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingQuestion ? 'Save Changes' : 'Add Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
