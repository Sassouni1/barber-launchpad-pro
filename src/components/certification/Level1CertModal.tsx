import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle, Circle, Loader2, Download, RefreshCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, RotateCw, ZoomIn, ZoomOut, Search } from 'lucide-react';
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

// Hook to check if user has completed all lessons (modules) of the course
function useAllLessonsCompleted() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['all-lessons-completed', user?.id],
    queryFn: async () => {
      if (!user?.id) return { completed: false, completedCount: 0, totalCount: 0 };

      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select(`
          id,
          has_quiz,
          is_directory_enrollment,
          course:courses!inner(id, category)
        `)
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
        const pct = a.total_questions > 0 ? (a.score / a.total_questions) * 100 : 0;
        if (pct >= 80) passedModules.add(a.module_id);
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
    enabled: !!user?.id,
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

export function Level1CertModal({ isOpen, onClose }: Level1CertModalProps) {
  const [showQuizDetails, setShowQuizDetails] = useState(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [generatedCertificateUrl, setGeneratedCertificateUrl] = useState<string | null>(null);
  const [nudgeAmount, setNudgeAmount] = useState(20);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [renderedSize, setRenderedSize] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [draftLayout, setDraftLayout] = useState<{ name_x: number; name_y: number; name_font_size: number; date_x: number; date_y: number; date_font_size: number; date_font_family: string } | null>(null);
  const [zoom, setZoom] = useState(1);

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
      setIsCertModalOpen(false);
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
    if (!baseUrl) return;

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
      detail: trainingGames ? `${trainingGames.completedCount}/${trainingGames.totalCount}` : undefined,
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
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-medium">You are certified!</span>
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
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(previewLayout.name_x / naturalSize.w) * 100}%`,
                        top: `${(previewLayout.name_y / naturalSize.h) * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        fontFamily: '"Cinzel", serif',
                        fontWeight: 600,
                        fontSize: `${(previewLayout.name_font_size / naturalSize.w) * renderedSize.w * zoom}px`,
                        color: layout?.name_color || '#1A1A1A',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}
                    >
                      {existingCertification?.certificate_name || 'Your Name'}
                    </div>
                  )}
                  {showAdminControls && previewLayout && naturalSize.w > 0 && renderedSize.w > 0 && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(previewLayout.date_x / naturalSize.w) * 100}%`,
                        top: `${(previewLayout.date_y / naturalSize.h) * 100}%`,
                        transform: 'translateY(-50%)',
                        fontFamily:
                          previewLayout.date_font_family === 'name'
                            ? '"Cinzel", serif'
                            : previewLayout.date_font_family === 'sans-serif'
                            ? 'sans-serif'
                            : previewLayout.date_font_family === 'serif'
                            ? 'serif'
                            : `"${previewLayout.date_font_family}", sans-serif`,
                        fontWeight: previewLayout.date_font_family === 'name' ? 600 : 400,
                        fontSize: `${(previewLayout.date_font_size / naturalSize.w) * renderedSize.w * zoom}px`,
                        color:
                          previewLayout.date_font_family === 'name'
                            ? layout?.name_color || '#1A1A1A'
                            : layout?.date_color || '#1A1A1A',
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
                  <Button className="flex-1 gold-gradient" onClick={handleDownload}>
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
      {isCertModalOpen && (
        <CertificationModal
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          onSubmit={handleSubmitCertification}
          certificateUrl={generatedCertificateUrl}
          isGenerating={issueCertification.isPending}
          defaultName={existingCertification?.certificate_name}
        />
      )}
    </>
  );
}
