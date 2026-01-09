import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle, Circle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCertificationEligibility, useCertificationPhotos, useUserCertification } from '@/hooks/useCertification';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Level1CertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Hook to check if user has completed all lessons
function useAllLessonsCompleted() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-lessons-completed', user?.id],
    queryFn: async () => {
      if (!user?.id) return { completed: false, completedCount: 0, totalCount: 0 };

      // Get all modules for hair-system courses
      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select(`
          id,
          course:courses!inner(id, category)
        `)
        .eq('courses.category', 'hair-system')
        .eq('is_published', true);

      if (modulesError) throw modulesError;

      const moduleIds = modules?.map(m => m.id) || [];
      const totalCount = moduleIds.length;

      if (totalCount === 0) return { completed: true, completedCount: 0, totalCount: 0 };

      // Get lessons for these modules
      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('id, module_id')
        .in('module_id', moduleIds);

      if (lessonsError) throw lessonsError;

      const lessonIds = lessons?.map(l => l.id) || [];
      const totalLessons = lessonIds.length;

      if (totalLessons === 0) {
        // No lessons, just count modules with video as "lessons"
        return { completed: true, completedCount: totalCount, totalCount };
      }

      // Get user's completed lessons
      const { data: progress, error: progressError } = await supabase
        .from('user_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .eq('completed', true)
        .in('lesson_id', lessonIds);

      if (progressError) throw progressError;

      const completedCount = progress?.length || 0;
      return { 
        completed: completedCount >= totalLessons, 
        completedCount, 
        totalCount: totalLessons 
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

// Hook to check training games completion (placeholder - could track quiz attempts as training)
function useTrainingGamesCompleted() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['training-games-completed', user?.id],
    queryFn: async () => {
      // For now, we'll consider this complete if user has visited training page
      // In future, this could track specific game completions
      // Currently just returning true as placeholder
      return { completed: true };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

export function Level1CertModal({ isOpen, onClose }: Level1CertModalProps) {
  const navigate = useNavigate();
  
  // Get the hair-system course ID
  const { data: hairSystemCourse } = useQuery({
    queryKey: ['hair-system-course'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('id')
        .eq('category', 'hair-system')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const courseId = hairSystemCourse?.id;

  // Check all requirements
  const { data: lessonsProgress, isLoading: isLoadingLessons } = useAllLessonsCompleted();
  const { data: trainingGames, isLoading: isLoadingTraining } = useTrainingGamesCompleted();
  const { data: eligibility, isLoading: isLoadingEligibility } = useCertificationEligibility(courseId);
  const { photos, isLoading: isLoadingPhotos } = useCertificationPhotos(courseId);
  const { data: existingCertification, isLoading: isLoadingCert } = useUserCertification(courseId);

  const isLoading = isLoadingLessons || isLoadingTraining || isLoadingEligibility || isLoadingPhotos || isLoadingCert;

  const allLessonsDone = lessonsProgress?.completed ?? false;
  const trainingGamesDone = trainingGames?.completed ?? false;
  const photoSubmitted = (photos?.length ?? 0) > 0;
  const isCertified = !!existingCertification;
  
  // All requirements must be met to be eligible
  const allRequirementsMet = allLessonsDone && trainingGamesDone && photoSubmitted && (eligibility?.allQuizzesPassed ?? false);

  const handleGoToCertification = () => {
    onClose();
    navigate('/courses/hair-system');
  };

  const requirements = [
    {
      label: 'Complete all lessons',
      completed: allLessonsDone,
      detail: lessonsProgress ? `${lessonsProgress.completedCount}/${lessonsProgress.totalCount}` : undefined,
    },
    {
      label: 'Training games',
      completed: trainingGamesDone,
    },
    {
      label: 'Submit template',
      completed: photoSubmitted,
      detail: photoSubmitted ? `${photos?.length} photo(s)` : undefined,
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              isCertified ? "gold-gradient" : "bg-secondary"
            )}>
              <Award className={cn(
                "w-5 h-5",
                isCertified ? "text-primary-foreground" : "text-muted-foreground"
              )} />
            </div>
            <span className={isCertified ? "gold-text" : ""}>Level 1 Certification</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : isCertified ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-500 font-medium">You are certified!</span>
              </div>
              <Button 
                className="w-full gold-gradient"
                onClick={handleGoToCertification}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Certificate
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {requirements.map((req, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border transition-colors",
                      req.completed 
                        ? "bg-green-500/10 border-green-500/30" 
                        : "bg-secondary/30 border-border"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {req.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={cn(
                        "font-medium",
                        req.completed ? "text-green-500" : "text-foreground"
                      )}>
                        {req.label}
                      </span>
                    </div>
                    {req.detail && (
                      <span className="text-xs text-muted-foreground">
                        {req.detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Button 
                  className={cn(
                    "w-full transition-all",
                    allRequirementsMet ? "gold-gradient" : ""
                  )}
                  onClick={handleGoToCertification}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  {allRequirementsMet ? 'Get Your Certificate' : 'View Course Progress'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
