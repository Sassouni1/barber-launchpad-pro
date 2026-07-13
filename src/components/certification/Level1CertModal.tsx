import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle, Circle, Loader2, Download, RefreshCw, ChevronLeft, ChevronRight, RotateCcw, RotateCw, ZoomIn, ZoomOut, Search } from 'lucide-react';
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
import { isQuizPassed } from '@/lib/quizPass';
import {
  useCertificationEligibility,
  useCertificationPhotos,
  useUserCertification,
  useIssueCertification,
  useResetCertification,
  useCertificationDefaults,
  useMarkCertificateDownloaded,
} from '@/hooks/useCertification';
import { useCertificateLayout, useUpdateCertificateLayout } from '@/hooks/useCertificateLayout';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { PhotoUploader } from './PhotoUploader';
import { QuizProgressList } from './QuizProgressList';
import { CertificationModal, type CertificationSubmissionPayload } from './CertificationModal';
import { BUSINESS_MASTERY_WELCOME_PENDING_KEY } from '@/components/courses/BusinessMasteryWelcome';

interface Level1CertModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Skip the preview and open the editable certification form immediately. */
  openEditForm?: boolean;
}

// Hook to check if user has completed all lessons (modules) of the course
function useAllLessonsCompleted(courseId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-lessons-completed', courseId, user?.id],
    queryFn: async () => {
      if (!user?.id || !courseId) return { completed: false, completedCount: 0, totalCount: 0 };

      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select(`
          id,
          has_quiz,
          is_directory_enrollment,
          course:courses!inner(id, category)
        `)
        .eq('course_id', courseId)
        .eq('courses.category', 'hair-system')
        .eq('is_published', true);

      if (modulesError) throw modulesError;

      const curriculumModules = (modules || []).filter((m: any) => !m.is_directory_enrollment);
      const moduleIds = curriculumModules.map((m: any) => m.id);
      const totalCount = moduleIds.length;

      if (totalCount === 0) return { completed: true, completedCount: 0, totalCount: 0 };

      const { data: attempts } = await supabase
        .from('user_quiz_attempts')
        .select('module_id, score, total_questions')
        .eq('user_id', user.id)
        .in('module_id', moduleIds);

      const passedModules = new Set<string>();
      for (const a of attempts || []) {
        if (isQuizPassed(a.score, a.total_questions)) passedModules.add(a.module_id);
      }

      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, module_id')
        .in('module_id', moduleIds);
      const lessonIdToModule = new Map<string, string>();
      for (const l of lessons || []) lessonIdToModule.set(l.id, l.module_id);

      const lessonIds = (lessons || []).map((l) => l.id);
      let watchedModules = new Set<string>();
      if (lessonIds.length > 0) {
        const { data: progress } = await supabase
          .from('user_progress')
          .select('lesson_id')
          .eq('user_id', user.id)
          .eq('completed', true)
          .in('lesson_id', lessonIds);
        for (const p of progress || []) {
          const mid = lessonIdToModule.get(p.lesson_id);
          if (mid) watchedModules.add(mid);
        }
      }

      let completedCount = 0;
      for (const m of curriculumModules as any[]) {
        if (passedModules.has(m.id) || watchedModules.has(m.id) || !m.has_quiz) {
          completedCount++;
        }
      }

      return {
        completed: completedCount >= totalCount,
        completedCount,
        totalCount,
      };
    },
    enabled: !!user?.id && !!courseId,
    staleTime: 30000,
  });
}

function useTrainingGamesCompleted() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['training-games-completed', user?.id],
    queryFn: async () => {
      if (!user?.id) return { completed: false, completedCount: 0, totalCount: 3 };

      const { data, error } = await supabase
        .from('user_training_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true);

      if (error) throw error;

      const requiredGames = ['color-match', 'hairline', 'ceran-wrap'];
      const completedGames = data?.map(p => p.game_type) || [];
      const completedCount = requiredGames.filter(g => completedGames.includes(g)).length;
      
      return {
        completed: completedCount >= 3,
        completedCount,
        totalCount: 3
      };
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

export function Level1CertModal({ isOpen, onClose, openEditForm = false }: Level1CertModalProps) {
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [generatedCertificateUrl, setGeneratedCertificateUrl] = useState<string | null>(null);
  const [nudgeAmount, setNudgeAmount] = useState(20);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [renderedSize, setRenderedSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [draftLayout, setDraftLayout] = useState<{ name_x: number; name_y: number; name_font_size: number; date_x: number; date_y: number; date_font_size: number; date_font_family: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const hasAutoOpenedNameEntry = useRef(false);

  const { isAdmin, isAdminModeActive } = useAuthContext();
  const showAdminControls = isAdmin && isAdminModeActive;

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

  const { data: lessonsProgress, isLoading: isLoadingLessons } = useAllLessonsCompleted(courseId);
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
  const { data: certDefaults } = useCertificationDefaults(courseId);
  const updateLayout = useUpdateCertificateLayout();
  const issueCertification = useIssueCertification();
  const resetCertification = useResetCertification();
  const markDownloaded = useMarkCertificateDownloaded();

  useEffect(() => {
    if (!layout) return;
    setDraftLayout({
      name_x: layout.name_x,
      name_y: layout.name_y,
      name_font_size: layout.name_font_size,
      date_x: layout.date_x,
      date_y: layout.date_y,
      date_font_size: layout.date_font_size,
      date_font_family: layout.date_font_family || 'name',
    });
  }, [layout?.id, layout?.name_x, layout?.name_y, layout?.name_font_size, layout?.date_x, layout?.date_y, layout?.date_font_size, layout?.date_font_family]);

  const isLoading = isLoadingLessons || isLoadingTraining || isLoadingEligibility || isLoadingPhotos || isLoadingCert;

  const allLessonsDone = lessonsProgress?.completed ?? false;
  const trainingGamesDone = trainingGames?.completed ?? false;
  const photoSubmitted = (photos?.length ?? 0) > 0;
  const allQuizzesPassed = eligibility?.allQuizzesPassed ?? false;
  const isCertified = !!existingCertification;
  // Only quizzes + photo are required. Lessons and training games tracked for reference only.
  const allRequirementsMet = photoSubmitted && allQuizzesPassed;

  useEffect(() => {
    if (!isOpen) {
      hasAutoOpenedNameEntry.current = false;
      setIsCertModalOpen(false);
      return;
    }

    if (
      !isLoading &&
      !isCertified &&
      allRequirementsMet &&
      !isCertModalOpen &&
      !hasAutoOpenedNameEntry.current
    ) {
      hasAutoOpenedNameEntry.current = true;
      setGeneratedCertificateUrl(null);
      setIsCertModalOpen(true);
    }
  }, [allRequirementsMet, isCertModalOpen, isCertified, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen || !openEditForm || isLoading || !isCertified || isCertModalOpen) return;

    setGeneratedCertificateUrl(null);
    setIsEditMode(true);
    setIsCertModalOpen(true);
  }, [isCertified, isCertModalOpen, isLoading, isOpen, openEditForm]);

  const handleGetCertified = () => {
    setGeneratedCertificateUrl(null);
    setIsCertModalOpen(true);
  };

  const handleSubmitCertification = async (
    input: string | CertificationSubmissionPayload,
    debugOverride?: boolean
  ) => {
    const certificateName = typeof input === 'string' ? input : input.certificateName;
    const shippingAddress = typeof input === 'string' ? undefined : input.shippingAddress;
    const businessLocation = typeof input === 'string' ? undefined : input.businessLocation;
    const existingVersion = Number(existingCertification?.certification_version ?? 1) || 1;
    const legacyResubmission = !!existingCertification && existingVersion < 2 && openEditForm;
    setDebugInfo(null);
    const result = await issueCertification.mutateAsync({
      courseId: courseId!,
      certificateName,
      shippingAddress,
      businessLocation,
      debug: debugOverride ?? isDebugMode,
      legacyResubmission,
    });

    if (result?.certificateUrl) {
      setGeneratedCertificateUrl(result.certificateUrl);
      setIsCertModalOpen(false);

      // Grandfathered/certified-but-unlisted members only earn the Business
      // Mastery welcome after they actively resubmit their information.
      if (openEditForm && typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(BUSINESS_MASTERY_WELCOME_PENDING_KEY, '1');
        } catch {
          // The certification update still succeeds if storage is unavailable.
        }
      }
    }
    if (result?.debug) {
      setDebugInfo(result.debug);
    }
  };

  const handleEditCertificate = () => {
    setGeneratedCertificateUrl(null);
    setIsEditMode(true);
    setIsCertModalOpen(true);
  };

  const handleResetCertification = async () => {
    if (!courseId) return;
    await resetCertification.mutateAsync(courseId);
    setGeneratedCertificateUrl(null);
    setDebugInfo(null);
  };

  const handleNudgePosition = (direction: 'left' | 'right' | 'center' | 'up' | 'down') => {
    if (!draftLayout) return;

    setDraftLayout((current) => {
      if (!current) return current;

      if (direction === 'center') {
        return { ...current, name_x: 684 };
      }

      if (direction === 'left' || direction === 'right') {
        return {
          ...current,
          name_x: direction === 'left' ? current.name_x - nudgeAmount : current.name_x + nudgeAmount,
        };
      }

      return {
        ...current,
        name_y: direction === 'up' ? current.name_y - nudgeAmount : current.name_y + nudgeAmount,
      };
    });
  };

  const handleSetExactPosition = (axis: 'x' | 'y', value: number) => {
    setDraftLayout((current) => {
      if (!current) return current;
      return axis === 'x'
        ? { ...current, name_x: value }
        : { ...current, name_y: value };
    });
  };

  const handleSetFontSize = (value: number) => {
    setDraftLayout((current) => {
      if (!current) return current;
      return { ...current, name_font_size: value };
    });
  };

  const handleApplyAndRegenerate = async () => {
    if (!courseId || !draftLayout || !existingCertification) return;

    await updateLayout.mutateAsync({
      courseId,
      updates: {
        name_x: draftLayout.name_x,
        name_y: draftLayout.name_y,
        name_font_size: draftLayout.name_font_size,
        date_x: draftLayout.date_x,
        date_y: draftLayout.date_y,
        date_font_size: draftLayout.date_font_size,
        date_font_family: draftLayout.date_font_family,
      },
    });

    setGeneratedCertificateUrl(null);
    await handleSubmitCertification(existingCertification.certificate_name);
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
    const baseUrl = generatedCertificateUrl || existingCertification?.certificate_url;
    if (!baseUrl || !existingCertification?.id) return;

    const ts = Date.now();
    const downloadUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}v=${ts}`;
    const fileName = `certificate-${existingCertification?.certificate_name?.replace(/\s+/g, '-') || 'level1'}.png`;

    try {
      const response = await fetch(downloadUrl, { cache: 'no-store', mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

      // Mark the certificate as downloaded in the database
      markDownloaded.mutate({ courseId: courseId!, certificationId: existingCertification.id });
    } catch (error) {
      console.error('Download failed:', error);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Still record the download attempt on fallback so the UI turns green
      markDownloaded.mutate({ courseId: courseId!, certificationId: existingCertification.id });
    }
  };

  const baseCertificateUrl = generatedCertificateUrl || existingCertification?.certificate_url;
  const certCacheKey = generatedCertificateUrl || existingCertification?.issued_at || '';
  const certificateUrlWithCache = baseCertificateUrl
    ? `${baseCertificateUrl}${baseCertificateUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(certCacheKey)}`
    : null;

  const previewLayout = draftLayout ?? (layout ? {
    name_x: layout.name_x,
    name_y: layout.name_y,
    name_font_size: layout.name_font_size,
    date_x: layout.date_x,
    date_y: layout.date_y,
    date_font_size: layout.date_font_size,
    date_font_family: layout.date_font_family || 'name',
  } : null);

  const formattedPreviewDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const passedQuizCount = eligibility?.quizProgress.filter((q) => q.passed).length ?? 0;
  const totalQuizCount = eligibility?.quizProgress.length ?? 0;
  const remainingQuizCount = Math.max(totalQuizCount - passedQuizCount, 0);
  const activeStep = allQuizzesPassed ? 2 : 1;

  return (
    <>
      <Dialog
        open={isOpen && !openEditForm}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-xl max-h-[90vh] overflow-x-hidden overflow-y-auto overscroll-x-none p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className={cn(
                "w-10 h-10 rounded-full border flex items-center justify-center",
                isCertified ? "border-primary bg-primary/10" : "border-border bg-secondary/60"
              )}>
                <Award className={cn(
                  "w-5 h-5",
                  isCertified ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <span>Level 1 Certification</span>
            </DialogTitle>
          </DialogHeader>

          <div className="min-w-0 space-y-4 overflow-x-hidden pb-5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : isCertified && certificateUrlWithCache ? (
            <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-medium">You are certified!</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border',
                    existingCertification?.downloaded_at
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-amber-500/5 border-amber-500/40 border-l-4'
                  )}
                >
                  {existingCertification?.downloaded_at ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  )}
                  <span
                    className={cn(
                      'font-medium text-sm',
                      existingCertification?.downloaded_at ? 'text-green-500' : 'text-foreground'
                    )}
                  >
                    {existingCertification?.downloaded_at ? 'Certificate downloaded' : 'Download your certificate'}
                  </span>
                </div>

                <div className="flex items-center gap-2 px-1">
                  <Search className="w-4 h-4 text-muted-foreground" />
                  <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <Button variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={zoom >= 4}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">{zoom.toFixed(1)}x</span>
                  {zoom > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>Reset</Button>
                  )}
                </div>

                <div className={cn("rounded-lg border border-primary/30 relative bg-background", zoom > 1 ? "overflow-auto max-h-[70vh]" : "overflow-hidden")}>
                  <div
                    className="relative"
                    style={{
                      width: `${zoom * 100}%`,
                    }}
                  >
                  <img
                    src={
                      showAdminControls && layout
                        ? `https://ynooatjtgstgwfssnira.supabase.co/storage/v1/object/public/certificates/${layout.template_path || 'template/certificate-template.png'}`
                        : certificateUrlWithCache
                    }
                    alt="Your Certificate"
                    className="w-full block"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setRenderedSize({ w: img.clientWidth, h: img.clientHeight });
                      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                  />
                  {showAdminControls && previewLayout && naturalSize.w > 0 && renderedSize.w > 0 && (
                    <div
                      className="absolute pointer-events-none cert-name-preview"
                      style={{
                        left: `${(previewLayout.name_x / naturalSize.w) * 100}%`,
                        top: `${(previewLayout.name_y / naturalSize.h) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${(previewLayout.name_font_size / naturalSize.w) * renderedSize.w * zoom}px`,
                        color: layout?.name_color || '#000000',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}
                    >
                      {existingCertification?.certificate_name || 'Your Name'}
                    </div>
                  )}
                  {showAdminControls && previewLayout && naturalSize.w > 0 && renderedSize.w > 0 && (
                    <div
                      className={
                        'absolute pointer-events-none ' +
                        (previewLayout.date_font_family === 'name' ? 'cert-name-preview' : '')
                      }
                      style={{
                        left: `${(previewLayout.date_x / naturalSize.w) * 100}%`,
                        top: `${(previewLayout.date_y / naturalSize.h) * 100}%`,
                        transform: 'translateY(-50%)',
                        fontFamily:
                          previewLayout.date_font_family === 'name'
                            ? undefined
                            : previewLayout.date_font_family === 'sans-serif'
                            ? 'sans-serif'
                            : previewLayout.date_font_family === 'serif'
                            ? 'serif'
                            : `"${previewLayout.date_font_family}", sans-serif`,
                        fontWeight: previewLayout.date_font_family === 'name' ? undefined : 400,
                        fontSize: `${(previewLayout.date_font_size / naturalSize.w) * renderedSize.w * zoom}px`,
                        color:
                          previewLayout.date_font_family === 'name'
                            ? layout?.name_color || '#000000'
                            : layout?.date_color || '#000000',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}
                    >
                      {formattedPreviewDate}
                    </div>
                  )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className={cn(
                      'flex-1',
                      existingCertification?.downloaded_at ? 'bg-green-600 hover:bg-green-700 text-white' : 'gold-gradient'
                    )}
                    onClick={handleDownload}
                    disabled={markDownloaded.isPending}
                  >
                    {markDownloaded.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : existingCertification?.downloaded_at ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {existingCertification?.downloaded_at ? 'Downloaded' : 'Download'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleEditCertificate}
                    disabled={issueCertification.isPending}
                  >
                    {issueCertification.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    {issueCertification.isPending ? 'Regenerating...' : 'Edit Certificate'}
                  </Button>
                </div>

                {showAdminControls && (
                  <div className="space-y-3 overflow-hidden">
                    <div className="flex flex-wrap gap-2">
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
                            <RotateCcw className="w-4 h-4 mr-1" />
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

                    {layout && previewLayout && (
                      <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-3">
                        <div className="flex items-center gap-4 flex-wrap">
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Font:</span>
                            <input
                              type="number"
                              value={previewLayout.name_font_size}
                              onChange={(e) => handleSetFontSize(e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                            />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">X =</span>
                            <input
                              type="number"
                              value={previewLayout.name_x}
                              onChange={(e) => handleSetExactPosition('x', Number(e.target.value) || 0)}
                              className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                            />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleNudgePosition('left')} disabled={issueCertification.isPending}>
                              <ChevronLeft className="w-4 h-4 mr-1" />
                              {nudgeAmount}px
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleNudgePosition('center')} disabled={issueCertification.isPending}>
                              <RotateCw className="w-4 h-4" />
                              Center
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleNudgePosition('right')} disabled={issueCertification.isPending}>
                              {nudgeAmount}px
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Y =</span>
                            <input
                              type="number"
                              value={previewLayout.name_y}
                              onChange={(e) => handleSetExactPosition('y', Number(e.target.value) || 0)}
                              className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                            />
                            <span className="text-xs text-muted-foreground">px</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleNudgePosition('up')} disabled={issueCertification.isPending}>
                              <ChevronLeft className="w-4 h-4 mr-1 rotate-90" />
                              {nudgeAmount}px
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleNudgePosition('down')} disabled={issueCertification.isPending}>
                              {nudgeAmount}px
                              <ChevronRight className="w-4 h-4 ml-1 rotate-90" />
                            </Button>
                          </div>
                        </div>

                        <div className="pt-3 mt-2 border-t border-border space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date Position</div>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">Date X =</span>
                              <input
                                type="number"
                                value={previewLayout.date_x}
                                onChange={(e) => setDraftLayout((c) => c ? { ...c, date_x: Number(e.target.value) || 0 } : c)}
                                className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                              />
                              <span className="text-xs text-muted-foreground">px</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">Date Y =</span>
                              <input
                                type="number"
                                value={previewLayout.date_y}
                                onChange={(e) => setDraftLayout((c) => c ? { ...c, date_y: Number(e.target.value) || 0 } : c)}
                                className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                              />
                              <span className="text-xs text-muted-foreground">px</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">Date Font:</span>
                              <input
                                type="number"
                                value={previewLayout.date_font_size}
                                onChange={(e) => setDraftLayout((c) => c ? { ...c, date_font_size: Number(e.target.value) || 0 } : c)}
                                className="w-20 h-8 px-2 text-center text-sm rounded-md border border-input bg-background"
                              />
                              <span className="text-xs text-muted-foreground">px</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm" onClick={() => setDraftLayout((c) => c ? { ...c, date_x: c.date_x - nudgeAmount } : c)}>
                                <ChevronLeft className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDraftLayout((c) => c ? { ...c, date_x: c.date_x + nudgeAmount } : c)}>
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDraftLayout((c) => c ? { ...c, date_y: c.date_y - nudgeAmount } : c)}>
                                <ChevronLeft className="w-4 h-4 rotate-90" />
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setDraftLayout((c) => c ? { ...c, date_y: c.date_y + nudgeAmount } : c)}>
                                <ChevronRight className="w-4 h-4 rotate-90" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {existingCertification && (
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={handleApplyAndRegenerate}
                            disabled={updateLayout.isPending || issueCertification.isPending}
                          >
                            {updateLayout.isPending || issueCertification.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Apply & Regenerate Preview'
                            )}
                          </Button>
                        )}
                      </div>
                    )}

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
              <>
                <div className="px-5 pt-1 pb-2">
                  <p className="text-sm text-muted-foreground">
                    Complete the steps below to earn your Level 1 Certification.
                  </p>
                </div>

                {/* Two-step progress indicator */}
                <div className="px-5 pb-3">
                  <div className="relative flex items-start justify-between">
                    <div className="absolute left-[12%] right-[12%] top-4 h-0.5 bg-border" aria-hidden="true">
                      <div
                        className={cn(
                          'h-full bg-primary transition-all',
                          activeStep === 2 ? 'w-full' : 'w-1/2'
                        )}
                      />
                    </div>
                    {[
                      { number: 1, label: 'Complete Quizzes', complete: allQuizzesPassed },
                      { number: 2, label: 'Submit Template', complete: photoSubmitted },
                    ].map((step) => (
                      <div key={step.number} className="relative z-10 flex w-1/2 flex-col items-center gap-2">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold',
                            step.complete
                              ? 'border-green-500 bg-green-500/15 text-green-400'
                              : activeStep === step.number
                                ? 'border-primary bg-primary/15 text-primary'
                                : 'border-border bg-background text-muted-foreground'
                          )}
                        >
                          {step.complete ? <CheckCircle className="h-4 w-4" /> : step.number}
                        </div>
                        <span className={cn(
                          'text-xs font-medium text-center',
                          step.complete || activeStep === step.number ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 px-5">
                  {/* Step one: quizzes */}
                  <section className={cn(
                    'overflow-hidden rounded-xl border',
                    allQuizzesPassed ? 'border-green-500/30 bg-green-500/5' : 'border-primary/50 bg-primary/5'
                  )}>
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          allQuizzesPassed ? 'border-green-500/30 text-green-400' : 'border-primary/40 text-primary'
                        )}>
                          Step 1 of 2
                        </span>
                        <span className={cn(
                          'text-xs font-semibold',
                          allQuizzesPassed ? 'text-green-400' : 'text-primary'
                        )}>
                          {allQuizzesPassed ? 'Complete' : `${remainingQuizCount} remaining`}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold">Complete Your Quizzes</h3>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tight text-primary">{passedQuizCount}</span>
                        <span className="text-lg text-muted-foreground">of {totalQuizCount} passed</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${totalQuizCount > 0 ? (passedQuizCount / totalQuizCount) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {allQuizzesPassed
                          ? 'All required quizzes passed.'
                          : `${remainingQuizCount} quiz${remainingQuizCount === 1 ? '' : 'zes'} remaining`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pass every quiz. You may miss no more than 1 question per quiz.
                      </p>
                    </div>
                    <div className="border-t border-border/70 p-3">
                      <QuizProgressList
                        quizProgress={eligibility?.quizProgress || []}
                        onNavigate={onClose}
                      />
                    </div>
                  </section>

                  {/* Step two: template photo */}
                  <section className={cn(
                    'overflow-hidden rounded-xl border',
                    photoSubmitted ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-secondary/10'
                  )}>
                    <div className="p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className={cn(
                          'rounded-full border px-2.5 py-1 text-xs font-semibold',
                          photoSubmitted ? 'border-green-500/30 text-green-400' : 'border-border text-muted-foreground'
                        )}>
                          Step 2 of 2
                        </span>
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          photoSubmitted ? 'bg-green-500/15 text-green-400' : 'bg-muted text-muted-foreground'
                        )}>
                          {photos?.length ?? 0} uploaded
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">Submit Hair System Template</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Upload at least one photo after your quizzes are passed.
                          </p>
                        </div>
                        {photoSubmitted && <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-green-400" />}
                      </div>
                    </div>
                    <div className="border-t border-border/70 p-3">
                      <PhotoUploader
                        photos={photos || []}
                        onUpload={uploadPhoto}
                        onDelete={deletePhoto}
                        isUploading={isUploading}
                        isDeleting={isDeleting}
                      />
                    </div>
                  </section>
                </div>

                <div className="space-y-2 px-5 pt-1">
                  <Button
                    className={cn('w-full h-12 text-base', allRequirementsMet ? 'gold-gradient' : '')}
                    disabled={!allRequirementsMet}
                    onClick={handleGetCertified}
                  >
                    Continue
                  </Button>
                  <Button variant="ghost" className="w-full text-primary" onClick={onClose}>
                    Close
                  </Button>
                  {!allRequirementsMet && (
                    <p className="text-center text-xs text-muted-foreground">
                      Complete both steps to unlock certification.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Generation Modal */}
      {isCertModalOpen && (
        <CertificationModal
          isOpen={isCertModalOpen}
          onClose={() => {
            setIsCertModalOpen(false);
            setIsEditMode(false);
            if (openEditForm) onClose();
          }}
          onSubmit={handleSubmitCertification}
          certificateUrl={generatedCertificateUrl}
          isGenerating={issueCertification.isPending}
          defaultName={existingCertification?.certificate_name}
          defaultShippingAddress={certDefaults?.shipping ?? null}
          defaultBusinessLocation={certDefaults?.business ?? null}
          isEditing={isEditMode && !!existingCertification}
          openAddressSections={openEditForm}
          courseId={courseId}
          certificationId={existingCertification?.id ?? null}
        />
      )}
    </>
  );
}
