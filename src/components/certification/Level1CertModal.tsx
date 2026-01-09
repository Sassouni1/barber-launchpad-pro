import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle, Circle, Loader2, Download, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useCertificationEligibility,
  useCertificationPhotos,
  useUserCertification,
  useIssueCertification,
  useResetCertification,
} from '@/hooks/useCertification';
import { useCertificateLayout, useUpdateCertificateLayout } from '@/hooks/useCertificateLayout';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { PhotoUploader } from './PhotoUploader';
import { QuizProgressList } from './QuizProgressList';
import { CertificationModal } from './CertificationModal';

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
  const [showQuizDetails, setShowQuizDetails] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [generatedCertificateUrl, setGeneratedCertificateUrl] = useState<string | null>(null);
  const [nudgeAmount, setNudgeAmount] = useState(20);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);

  const { isAdmin, isAdminModeActive } = useAuthContext();
  const showAdminControls = isAdmin && isAdminModeActive;

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
  const { 
    photos, 
    isLoading: isLoadingPhotos,
    uploadPhoto,
    isUploading,
    deletePhoto,
    isDeleting,
  } = useCertificationPhotos(courseId);
  const { data: existingCertification, isLoading: isLoadingCert } = useUserCertification(courseId);
  const { data: layout } = useCertificateLayout(courseId);
  const updateLayout = useUpdateCertificateLayout();
  const issueCertification = useIssueCertification();
  const resetCertification = useResetCertification();

  const isLoading = isLoadingLessons || isLoadingTraining || isLoadingEligibility || isLoadingPhotos || isLoadingCert;

  const allLessonsDone = lessonsProgress?.completed ?? false;
  const trainingGamesDone = trainingGames?.completed ?? false;
  const photoSubmitted = (photos?.length ?? 0) > 0;
  const allQuizzesPassed = eligibility?.allQuizzesPassed ?? false;
  const isCertified = !!existingCertification;
  
  // All requirements must be met to be eligible
  const allRequirementsMet = allLessonsDone && trainingGamesDone && photoSubmitted && allQuizzesPassed;

  const handleGetCertified = () => {
    setGeneratedCertificateUrl(null);
    setIsCertModalOpen(true);
  };

  const handleSubmitCertification = async (name: string, debugOverride?: boolean) => {
    setDebugInfo(null);
    const result = await issueCertification.mutateAsync({
      courseId: courseId!,
      certificateName: name,
      debug: debugOverride ?? isDebugMode,
    });
    if (result?.certificateUrl) {
      setGeneratedCertificateUrl(result.certificateUrl);
    }
    if (result?.debug) {
      setDebugInfo(result.debug);
    }
  };

  const handleRegenerateCertification = () => {
    setGeneratedCertificateUrl(null);
    setIsCertModalOpen(true);
  };

  const handleResetCertification = async () => {
    if (!courseId) return;
    await resetCertification.mutateAsync(courseId);
    setGeneratedCertificateUrl(null);
    setDebugInfo(null);
  };

  const handleNudgePosition = async (direction: 'left' | 'right' | 'center' | 'up' | 'down') => {
    if (!layout || !courseId) return;
    
    let updates: { name_x?: number; name_y?: number } = {};
    
    if (direction === 'center') {
      updates.name_x = 684; // Template center (1368 / 2)
    } else if (direction === 'left' || direction === 'right') {
      updates.name_x = direction === 'left' ? layout.name_x - nudgeAmount : layout.name_x + nudgeAmount;
    } else if (direction === 'up' || direction === 'down') {
      updates.name_y = direction === 'up' ? layout.name_y - nudgeAmount : layout.name_y + nudgeAmount;
    }
    
    await updateLayout.mutateAsync({ courseId, updates });
    
    // Auto-regenerate if user has a certificate
    if (existingCertification) {
      handleSubmitCertification(existingCertification.certificate_name);
    }
  };

  const toggleDebugMode = () => {
    const nextIsDebug = !isDebugMode;
    setIsDebugMode(nextIsDebug);
    setDebugInfo(null);
    
    if (existingCertification) {
      setGeneratedCertificateUrl(null);
      handleSubmitCertification(existingCertification.certificate_name, nextIsDebug);
    }
  };

  const handleDownload = async () => {
    const url = generatedCertificateUrl || existingCertification?.certificate_url;
    if (!url) return;
    
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `certificate-${existingCertification?.certificate_name?.replace(/\s+/g, '-') || 'level1'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  // Cache-busted certificate URL
  const getCertificateUrlWithCacheBuster = (url: string) => {
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${timestamp}`;
  };

  const baseCertificateUrl = generatedCertificateUrl || existingCertification?.certificate_url;
  const certificateUrlWithCache = baseCertificateUrl
    ? getCertificateUrlWithCacheBuster(baseCertificateUrl)
    : null;

  const requirements = [
    {
      label: 'Complete all lessons',
      completed: allLessonsDone,
      detail: lessonsProgress ? `${lessonsProgress.completedCount}/${lessonsProgress.totalCount}` : undefined,
    },
    {
      label: 'Pass all quizzes',
      completed: allQuizzesPassed,
      expandable: true,
    },
    {
      label: 'Training games',
      completed: trainingGamesDone,
    },
    {
      label: 'Submit work photos',
      completed: photoSubmitted,
      detail: photoSubmitted ? `${photos?.length} photo(s)` : undefined,
      showUploader: true,
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
            ) : isCertified && certificateUrlWithCache ? (
              // Show certificate when certified
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-medium">You are certified!</span>
                </div>

                <div className="rounded-lg overflow-hidden border border-primary/30">
                  <img
                    src={certificateUrlWithCache}
                    alt="Your Certificate"
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 gold-gradient"
                    onClick={handleDownload}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleRegenerateCertification}
                    disabled={issueCertification.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </div>

                {/* Admin Controls */}
                {showAdminControls && (
                  <div className="space-y-3">
                    {/* Admin Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={toggleDebugMode}
                      >
                        {isDebugMode ? 'Debug ON' : 'Debug OFF'}
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-muted-foreground">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Certification?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete your current certificate and uploaded photos. You'll need to re-upload your work photos and generate a new certificate. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleResetCertification}
                              disabled={resetCertification.isPending}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {resetCertification.isPending ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Resetting...
                                </>
                              ) : (
                                'Reset Certification'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    {/* Position Controls */}
                    {layout && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-3">
                        {/* Nudge amount input */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Nudge:</span>
                          <input
                            type="number"
                            value={nudgeAmount}
                            onChange={(e) => setNudgeAmount(Math.max(1, Number(e.target.value) || 1))}
                            className="w-16 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                            min={1}
                          />
                          <span className="text-xs text-muted-foreground">px</span>
                        </div>
                        
                        {/* X Position Controls */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            X = {layout.name_x}px
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgePosition('left')}
                              disabled={updateLayout.isPending || issueCertification.isPending}
                            >
                              <ChevronLeft className="w-4 h-4 mr-1" />
                              {nudgeAmount}px
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgePosition('center')}
                              disabled={updateLayout.isPending || issueCertification.isPending}
                            >
                              <RotateCw className="w-4 h-4" />
                              Center
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgePosition('right')}
                              disabled={updateLayout.isPending || issueCertification.isPending}
                            >
                              {nudgeAmount}px
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Y Position Controls */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm font-medium text-muted-foreground">
                            Y = {layout.name_y}px
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgePosition('up')}
                              disabled={updateLayout.isPending || issueCertification.isPending}
                            >
                              <ChevronLeft className="w-4 h-4 mr-1 rotate-90" />
                              {nudgeAmount}px
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgePosition('down')}
                              disabled={updateLayout.isPending || issueCertification.isPending}
                            >
                              {nudgeAmount}px
                              <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                            </Button>
                          </div>
                        </div>
                        
                        {(updateLayout.isPending || issueCertification.isPending) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Regenerating...
                          </div>
                        )}
                      </div>
                    )}

                    {/* Debug Info Panel */}
                    {isDebugMode && debugInfo && (
                      <div className="p-3 rounded-lg bg-black/80 border border-yellow-500/50 font-mono text-xs text-green-400 overflow-x-auto">
                        <div className="text-yellow-400 mb-2 font-bold">DEBUG INFO</div>
                        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              // Show requirements checklist
              <>
                <div className="space-y-3">
                  {requirements.map((req, idx) => (
                    <div key={idx} className="space-y-2">
                      <div 
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border transition-colors",
                          req.completed 
                            ? "bg-green-500/10 border-green-500/30" 
                            : "bg-secondary/30 border-border",
                          req.expandable && "cursor-pointer"
                        )}
                        onClick={() => req.expandable && setShowQuizDetails(!showQuizDetails)}
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
                        <div className="flex items-center gap-2">
                          {req.detail && (
                            <span className="text-xs text-muted-foreground">
                              {req.detail}
                            </span>
                          )}
                          {req.expandable && (
                            showQuizDetails ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </div>

                      {/* Quiz Details Expansion */}
                      {req.expandable && showQuizDetails && (
                        <div className="ml-8 p-3 rounded-lg bg-secondary/20 border border-border">
                          <QuizProgressList quizProgress={eligibility?.quizProgress || []} />
                        </div>
                      )}

                      {/* Photo Uploader */}
                      {req.showUploader && (
                        <div className="ml-8 p-3 rounded-lg bg-secondary/20 border border-border">
                          <PhotoUploader
                            photos={photos || []}
                            onUpload={uploadPhoto}
                            onDelete={deletePhoto}
                            isUploading={isUploading}
                            isDeleting={isDeleting}
                          />
                        </div>
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
                    disabled={!allRequirementsMet}
                    onClick={handleGetCertified}
                  >
                    <Award className="w-4 h-4 mr-2" />
                    {allRequirementsMet ? 'Get Your Certificate' : 'Complete Requirements Above'}
                  </Button>
                  {!allRequirementsMet && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Complete all requirements to unlock certification
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Generation Modal */}
      <CertificationModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        onSubmit={handleSubmitCertification}
        certificateUrl={generatedCertificateUrl}
        isGenerating={issueCertification.isPending}
        defaultName={existingCertification?.certificate_name}
      />
    </>
  );
}
