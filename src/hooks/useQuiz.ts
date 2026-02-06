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
  module_id: string;
  question_text: string;
  question_image_url: string | null;
  question_type: 'multiple_choice' | 'true_false';
  order_index: number;
  answers?: QuizAnswer[];
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  module_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
}

export function useQuizQuestions(moduleId: string | undefined, includeCorrectAnswers = false) {
  return useQuery({
    queryKey: ['quiz-questions', moduleId, includeCorrectAnswers],
    queryFn: async () => {
      if (!moduleId) return [];
      const { data: questions, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index');
      if (error) throw error;

      // Fetch answers for all questions
      // Use the secure view for regular users (hides is_correct)
      // Use the full table for admins who need to see correct answers
      const questionIds = questions.map(q => q.id);
      
      if (includeCorrectAnswers) {
        // Admin view - includes is_correct field
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
        // User view - uses secure view that excludes is_correct
        const { data: answers, error: answersError } = await supabase
          .from('quiz_answer_options' as any)
          .select('*')
          .in('question_id', questionIds)
          .order('order_index');
        if (answersError) throw answersError;

        // Map answers without is_correct field (default to false for type safety)
        return questions.map(q => ({
          ...q,
          answers: answers
            .filter((a: any) => a.question_id === q.id)
            .map((a: any) => ({ ...a, is_correct: false })),
        })) as QuizQuestion[];
      }
    },
    enabled: !!moduleId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      module_id: string;
      question_text: string;
      question_image_url?: string;
      question_type: 'multiple_choice' | 'true_false';
      answers: { answer_text: string; is_correct: boolean }[];
    }) => {
      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('order_index')
        .eq('module_id', data.module_id)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = questions?.[0]?.order_index ?? -1;

      const { data: question, error } = await supabase
        .from('quiz_questions')
        .insert({
          module_id: data.module_id,
          question_text: data.question_text,
          question_image_url: data.question_image_url || null,
          question_type: data.question_type,
          order_index: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert answers
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

      return { ...question, moduleId: data.module_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions', data.moduleId] });
    },
  });
}

export function useUpdateQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      module_id: string;
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

      // Delete existing answers and insert new ones
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

      return { moduleId: data.module_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions', data.moduleId] });
    },
  });
}

export function useDeleteQuizQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, moduleId }: { questionId: string; moduleId: string }) => {
      const { error } = await supabase
        .from('quiz_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;
      return { moduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-questions', data.moduleId] });
    },
  });
}

export function useUploadQuestionImage() {
  return useMutation({
    mutationFn: async ({ moduleId, file }: { moduleId: string; file: File }) => {
      const filePath = `quiz-images/${moduleId}/${Date.now()}-${file.name}`;

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

export function useQuizAttempts(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['quiz-attempts', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_quiz_attempts')
        .select('*')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      return data as QuizAttempt[];
    },
    enabled: !!moduleId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface QuizSubmitResult {
  attemptId: string;
  score: number;
  total: number;
  correctAnswers: Record<string, string>; // questionId -> correctAnswerId
  module_id: string;
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      moduleId: string;
      answers: { questionId: string; selectedAnswerId: string }[];
    }): Promise<QuizSubmitResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call the server-side verification edge function
      const { data: result, error } = await supabase.functions.invoke('verify-quiz', {
        body: {
          moduleId: data.moduleId,
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
        module_id: data.moduleId,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', data.module_id] });
    },
  });
}
