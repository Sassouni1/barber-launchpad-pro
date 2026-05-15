import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface QuizAnswer {
  id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean;
  order_index: number;
}

export interface QuizQuestion {
  id: string;
  module_id: string | null;
  lesson_id: string | null;
  question_text: string;
  question_image_url: string | null;
  question_type: 'multiple_choice' | 'true_false';
  order_index: number;
  answers?: QuizAnswer[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  module_id: string | null;
  lesson_id: string | null;
  score: number;
  total_questions: number;
  completed_at: string;
}

export type QuizScope = { moduleId?: string; lessonId?: string };

function scopeKey(scope: QuizScope): string {
  return scope.lessonId ? `lesson:${scope.lessonId}` : `module:${scope.moduleId ?? ''}`;
}

export function useQuizQuestions(scope: QuizScope | string | undefined, includeCorrectAnswers = false) {
  // Backwards-compat: allow passing a moduleId string directly
  const normalized: QuizScope | undefined =
    typeof scope === 'string' ? { moduleId: scope } : scope;
  const enabled = !!(normalized?.moduleId || normalized?.lessonId);

  return useQuery({
    queryKey: ['quiz-questions', normalized && scopeKey(normalized), includeCorrectAnswers],
    queryFn: async () => {
      if (!enabled || !normalized) return [];
      const base = supabase.from('quiz_questions').select('*').order('order_index');
      const { data: questions, error } = normalized.lessonId
        ? await base.eq('lesson_id', normalized.lessonId)
        : await base.eq('module_id', normalized.moduleId!);
      if (error) throw error;

      const questionIds = questions.map(q => q.id);
      if (questionIds.length === 0) return [];

      if (includeCorrectAnswers) {
        const { data: answers, error: answersError } = await supabase
          .from('quiz_answers')
          .select('*')
          .in('question_id', questionIds)
          .order('order_index');
        if (answersError) throw answersError;
        return questions.map(q => ({
          ...q,
          answers: answers.filter(a => a.question_id === q.id),
        })) as QuizQuestion[];
      } else {
        const { data: answers, error: answersError } = await supabase
          .from('quiz_answer_options' as any)
          .select('*')
          .in('question_id', questionIds)
          .order('order_index');
        if (answersError) throw answersError;
        return questions.map(q => ({
          ...q,
          answers: answers
            .filter((a: any) => a.question_id === q.id)
            .map((a: any) => ({ ...a, is_correct: false })),
        })) as QuizQuestion[];
      }
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      module_id?: string | null;
      lesson_id?: string | null;
      question_text: string;
      question_image_url?: string;
      question_type: 'multiple_choice' | 'true_false';
      answers: { answer_text: string; is_correct: boolean }[];
    }) => {
      const ownerFilter = data.lesson_id
        ? supabase.from('quiz_questions').select('order_index').eq('lesson_id', data.lesson_id)
        : supabase.from('quiz_questions').select('order_index').eq('module_id', data.module_id!);
      const { data: questions } = await ownerFilter
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = questions?.[0]?.order_index ?? -1;

      const { data: question, error } = await supabase
        .from('quiz_questions')
        .insert({
          module_id: data.module_id ?? null,
          lesson_id: data.lesson_id ?? null,
          question_text: data.question_text,
          question_image_url: data.question_image_url || null,
          question_type: data.question_type,
          order_index: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      const answersToInsert = data.answers.map((a, index) => ({
        question_id: question.id,
        answer_text: a.answer_text,
        is_correct: a.is_correct,
        order_index: index,
      }));

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answersToInsert);

      if (answersError) throw answersError;

      return question;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
    },
  });
}

export function useUpdateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      question_text: string;
      question_image_url?: string;
      question_type: 'multiple_choice' | 'true_false';
      answers: { id?: string; answer_text: string; is_correct: boolean }[];
    }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .update({
          question_text: data.question_text,
          question_image_url: data.question_image_url || null,
          question_type: data.question_type,
        })
        .eq('id', data.id);

      if (error) throw error;

      await supabase.from('quiz_answers').delete().eq('question_id', data.id);

      const answersToInsert = data.answers.map((a, index) => ({
        question_id: data.id,
        answer_text: a.answer_text,
        is_correct: a.is_correct,
        order_index: index,
      }));

      const { error: answersError } = await supabase
        .from('quiz_answers')
        .insert(answersToInsert);

      if (answersError) throw answersError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
    },
  });
}

export function useDeleteQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId }: { questionId: string }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions'] });
    },
  });
}

export function useUploadQuestionImage() {
  return useMutation({
    mutationFn: async ({ ownerId, file }: { ownerId: string; file: File }) => {
      const filePath = `quiz-images/${ownerId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-files')
        .getPublicUrl(filePath);

      return publicUrl;
    },
  });
}

export function useQuizAttempts(scope: QuizScope | string | undefined) {
  const normalized: QuizScope | undefined =
    typeof scope === 'string' ? { moduleId: scope } : scope;
  const enabled = !!(normalized?.moduleId || normalized?.lessonId);

  return useQuery({
    queryKey: ['quiz-attempts', normalized && scopeKey(normalized)],
    queryFn: async () => {
      if (!enabled || !normalized) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const base = supabase
        .from('user_quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      const { data, error } = normalized.lessonId
        ? await base.eq('lesson_id', normalized.lessonId)
        : await base.eq('module_id', normalized.moduleId!);

      if (error) throw error;
      return data as QuizAttempt[];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface QuizSubmitResult {
  attemptId: string;
  score: number;
  total: number;
  correctAnswers: Record<string, string>;
  module_id: string | null;
  lesson_id: string | null;
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      moduleId?: string;
      lessonId?: string;
      answers: { questionId: string; selectedAnswerId: string }[];
    }): Promise<QuizSubmitResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: result, error } = await supabase.functions.invoke('verify-quiz', {
        body: {
          moduleId: data.moduleId,
          lessonId: data.lessonId,
          answers: data.answers,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      return {
        attemptId: result.attemptId,
        score: result.score,
        total: result.total,
        correctAnswers: result.correctAnswers,
        module_id: data.moduleId ?? null,
        lesson_id: data.lessonId ?? null,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts'] });
    },
  });
}
