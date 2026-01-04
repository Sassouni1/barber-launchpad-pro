import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CertificationPhoto {
  id: string;
  user_id: string;
  course_id: string;
  file_name: string;
  file_url: string;
  uploaded_at: string;
}

interface Certification {
  id: string;
  user_id: string;
  course_id: string;
  certificate_name: string;
  certificate_url: string | null;
  issued_at: string;
}

interface QuizProgress {
  moduleId: string;
  moduleTitle: string;
  hasQuiz: boolean;
  bestScore: number | null;
  passed: boolean;
}

// Hook to check certification eligibility
export function useCertificationEligibility(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['certification-eligibility', courseId, user?.id],
    queryFn: async () => {
      if (!user?.id || !courseId) {
        return { quizProgress: [], allQuizzesPassed: false, hasPhotos: false, isEligible: false };
      }

      // Get all modules for hair-system courses with quizzes
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select(`
          id,
          title,
          has_quiz,
          course:courses!inner(id, category)
        `)
        .eq('courses.category', 'hair-system');

      if (modulesError) throw modulesError;

      // Get user's best quiz attempts for each module
      const { data: attempts, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('module_id, score, total_questions')
        .eq('user_id', user.id);

      if (attemptsError) throw attemptsError;

      // Calculate quiz progress
      const modulesWithQuiz = modules?.filter(m => m.has_quiz) || [];
      const quizProgress: QuizProgress[] = modulesWithQuiz.map(module => {
        const moduleAttempts = attempts?.filter(a => a.module_id === module.id) || [];
        const bestAttempt = moduleAttempts.reduce((best, current) => {
          const currentScore = current.total_questions > 0
            ? (current.score / current.total_questions) * 100
            : 0;
          const bestScore = best?.total_questions > 0
            ? (best.score / best.total_questions) * 100
            : 0;
          return currentScore > bestScore ? current : best;
        }, moduleAttempts[0]);

        const bestScore = bestAttempt?.total_questions > 0
          ? Math.round((bestAttempt.score / bestAttempt.total_questions) * 100)
          : null;

        return {
          moduleId: module.id,
          moduleTitle: module.title,
          hasQuiz: true,
          bestScore,
          passed: bestScore !== null && bestScore >= 80,
        };
      });

      const allQuizzesPassed = quizProgress.length > 0 && quizProgress.every(q => q.passed);

      // Check if user has uploaded photos for any hair-system course
      const { data: photos, error: photosError } = await supabase
        .from('certification_photos')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (photosError) throw photosError;

      const hasPhotos = (photos?.length || 0) > 0;

      return {
        quizProgress,
        allQuizzesPassed,
        hasPhotos,
        isEligible: allQuizzesPassed && hasPhotos,
      };
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

// Hook to manage certification photos
export function useCertificationPhotos(courseId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const photosQuery = useQuery({
    queryKey: ['certification-photos', courseId, user?.id],
    queryFn: async () => {
      if (!user?.id || !courseId) return [];

      const { data, error } = await supabase
        .from('certification_photos')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as CertificationPhoto[];
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id || !courseId) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${courseId}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('certification-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('certification-photos')
        .getPublicUrl(fileName);

      // Save to database
      const { data, error } = await supabase
        .from('certification_photos')
        .insert({
          user_id: user.id,
          course_id: courseId,
          file_name: file.name,
          file_url: publicUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certification-photos'] });
      queryClient.invalidateQueries({ queryKey: ['certification-eligibility'] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload photo');
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('certification_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certification-photos'] });
      queryClient.invalidateQueries({ queryKey: ['certification-eligibility'] });
      toast.success('Photo deleted');
    },
    onError: () => {
      toast.error('Failed to delete photo');
    },
  });

  return {
    photos: photosQuery.data || [],
    isLoading: photosQuery.isLoading,
    uploadPhoto: uploadPhotoMutation.mutate,
    isUploading: uploadPhotoMutation.isPending,
    deletePhoto: deletePhotoMutation.mutate,
    isDeleting: deletePhotoMutation.isPending,
  };
}

// Hook to get user's certification
export function useUserCertification(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['certification', courseId, user?.id],
    queryFn: async () => {
      if (!user?.id || !courseId) return null;

      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (error) throw error;
      return data as Certification | null;
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}

// Hook to issue certification
export function useIssueCertification() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ courseId, certificateName }: { courseId: string; certificateName: string }) => {
      if (!user?.id) throw new Error('Not authenticated');

      // Call edge function to generate certificate
      const { data, error } = await supabase.functions.invoke('generate-certificate', {
        body: {
          userId: user.id,
          courseId,
          certificateName,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certification'] });
      toast.success('Certificate generated successfully!');
    },
    onError: (error) => {
      console.error('Certificate generation error:', error);
      toast.error('Failed to generate certificate');
    },
  });
}
