import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCourses, type Module } from "@/hooks/useCourses";
import {
  BookOpen,
  Play,
  FileText,
  HelpCircle,
  AlertTriangle,
  XCircle,
  ClipboardList,
  Clock,
  Settings,
  Loader2,
  ArrowRight,
  ChevronDown,
  Star,
  Award,
  Globe,
  CheckCircle2,
  Trophy,
  RotateCcw,
} from "lucide-react";
import { useCompletedModules, type ModuleCompletion } from "@/hooks/useCompletedModules";
import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn, getVimeoEmbedUrl } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { logAccess } from "@/lib/accessLog";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeCourseTitle,
  localizeCourseUi,
  localizeHairSystemLessonTitle,
  resolveVideoEmbedUrlForModule,
} from "@/lib/i18n/spanishVideos";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { FIRST_POST_MODULE_ID } from "@/data/postLessons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Level1CertModal } from "@/components/certification/Level1CertModal";
import {
  BUSINESS_MASTERY_WELCOME_PENDING_KEY,
  BusinessMasteryWelcome,
} from "@/components/courses/BusinessMasteryWelcome";
import { useUserCertification } from "@/hooks/useCertification";
import { useMyListing } from "@/hooks/useSpecialistDirectory";

// Custom hook for md breakpoint (768px) - tablet and above
function useIsTabletOrDesktop() {
  const [isTabletOrDesktop, setIsTabletOrDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsTabletOrDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setIsTabletOrDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTabletOrDesktop;
}

// Custom hook for lg breakpoint (1024px) - desktop only
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 900px)");
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

interface CoursesProps {
  courseType?: "hair-system" | "business";
}

type ModuleLessonPreview = { id: string; title: string; order_index: number };
type SidebarScrollMode = "restore" | "click";

const getModuleLessons = (module: Module): ModuleLessonPreview[] =>
  [...(((module as any).lessons || []) as ModuleLessonPreview[])].sort(
    (a, b) => a.order_index - b.order_index,
  );

const HAIR_SYSTEM_ORDER_MODULE_ID = "60c268c9-5df7-4161-8d91-2c185fc791d0";
// The Vimeo lesson is currently 5:24. Completion requires 90% watched,
// matching the tracker on the full lesson page (about 4:52).
const HAIR_SYSTEM_ORDER_COMPLETION_SECONDS = 292;

const getOrderWatchKey = (userId: string) =>
  `hair-system-order-watch:${userId}:${HAIR_SYSTEM_ORDER_MODULE_ID}`;

const getLastCourseModuleKey = (courseType: string) =>
  `last-course-module:${courseType}`;

const readOrderWatchSeconds = (userId: string | undefined) => {
  if (!userId || typeof window === "undefined") return 0;
  try {
    const value = Number.parseInt(
      window.localStorage.getItem(getOrderWatchKey(userId)) || "0",
      10,
    );
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
};

/**
 * The module 17 preview remains visually simple, but its Vimeo play/pause
 * events use the same cumulative watch counter as the full lesson page.
 */
const OrderLessonPreviewIframe = ({
  module,
  locale,
}: {
  module: Module;
  locale: "en" | "es";
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const watchSecondsRef = useRef(0);
  const playingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const watchKey = user?.id ? getOrderWatchKey(user.id) : null;
  const completionThreshold = videoDuration
    ? Math.max(60, Math.ceil(videoDuration * 0.9))
    : HAIR_SYSTEM_ORDER_COMPLETION_SECONDS;
  const embedUrl = resolveVideoEmbedUrlForModule(
    module,
    locale,
    getVimeoEmbedUrl,
  );

  useEffect(() => {
    watchSecondsRef.current = readOrderWatchSeconds(user?.id);
    completedRef.current = watchSecondsRef.current >= completionThreshold;
  }, [completionThreshold, user?.id]);

  useEffect(() => {
    const localizedVideoUrl = module.video_url || "";
    if (!localizedVideoUrl.includes("vimeo")) return;
    const rawUrl = localizedVideoUrl.replace(
      /player\.vimeo\.com\/video\//,
      "vimeo.com/",
    );
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data?.duration) setVideoDuration(data.duration);
      })
      .catch(() => {
        // Keep the current fallback threshold if Vimeo metadata is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, [module.video_url]);

  const persist = useCallback(
    (seconds: number) => {
      if (!watchKey) return;
      try {
        localStorage.setItem(watchKey, String(Math.floor(seconds)));
      } catch {
        // Playback tracking still works in memory if storage is unavailable.
      }
    },
    [watchKey],
  );

  const completeLesson = useCallback(async () => {
    if (!user?.id || completedRef.current) return;
    completedRef.current = true;
    playingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    persist(watchSecondsRef.current);
    void logAccess({
      event_type: "video_complete",
      resource_type: "module",
      resource_id: HAIR_SYSTEM_ORDER_MODULE_ID,
      metadata: {
        source: "course_preview",
        watched_seconds: Math.floor(watchSecondsRef.current),
        completion_threshold: completionThreshold,
      },
    });

    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("module_id", HAIR_SYSTEM_ORDER_MODULE_ID);
    for (const lesson of lessons || []) {
      await supabase.from("user_progress").upsert(
        {
          user_id: user.id,
          lesson_id: lesson.id,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );
    }
    queryClient.invalidateQueries({ queryKey: ["completed-modules", user.id] });
    queryClient.invalidateQueries({ queryKey: ["user-progress", user.id] });
  }, [completionThreshold, persist, queryClient, user?.id]);

  const handlePlay = useCallback(() => {
    if (completedRef.current) return;
    playingRef.current = true;
    void logAccess({
      event_type: "video_play",
      resource_type: "module",
      resource_id: HAIR_SYSTEM_ORDER_MODULE_ID,
      metadata: {
        source: "course_preview",
        watched_seconds: Math.floor(watchSecondsRef.current),
        completion_threshold: completionThreshold,
      },
    });
  }, [completionThreshold]);

  const handlePause = useCallback(() => {
    playingRef.current = false;
    persist(watchSecondsRef.current);
    void logAccess({
      event_type: "video_pause",
      resource_type: "module",
      resource_id: HAIR_SYSTEM_ORDER_MODULE_ID,
      metadata: {
        source: "course_preview",
        watched_seconds: Math.floor(watchSecondsRef.current),
        completion_threshold: completionThreshold,
      },
    });
  }, [completionThreshold, persist]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !user?.id) return;

    const subscribe = () => {
      ["play", "pause", "ended"].forEach((eventName) => {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ method: "addEventListener", value: eventName }),
          "*",
        );
      });
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      let payload: { event?: string } | null = null;
      try {
        payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (payload?.event === "play") handlePlay();
      if (payload?.event === "pause") handlePause();
      if (payload?.event === "ended") handlePause();
    };

    iframe.addEventListener("load", subscribe);
    window.addEventListener("message", onMessage);
    subscribe();

    return () => {
      iframe.removeEventListener("load", subscribe);
      window.removeEventListener("message", onMessage);
    };
  }, [handlePause, handlePlay, user?.id]);

  useEffect(() => {
    if (!user?.id || completedRef.current) return;
    timerRef.current = setInterval(() => {
      if (!playingRef.current || document.visibilityState !== "visible") return;
      const nextSeconds = watchSecondsRef.current + 1;
      watchSecondsRef.current = nextSeconds;
      if (nextSeconds % 5 === 0) persist(nextSeconds);
      if (nextSeconds >= completionThreshold) {
        void completeLesson();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      playingRef.current = false;
      persist(watchSecondsRef.current);
    };
  }, [completeLesson, completionThreshold, persist, user?.id]);

  return (
    <iframe
      ref={iframeRef}
      key={`${module.id}-${locale}`}
      src={embedUrl}
      className="absolute inset-0 w-full h-full"
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      title={localizeHairSystemLessonTitle(module, locale)}
    />
  );
};

const shouldOpenModuleDirectly = (module: Module) => {
  const title = module.title.toLowerCase();
  return title.includes("google profile");
};

const formatSubLessonCount = (count: number) =>
  `${count} sub-lesson${count === 1 ? "" : "s"}`;

const hasModuleCardDetails = (module: Module, lessonCount: number) =>
  Boolean(
    module.description ||
    module.duration ||
    module.has_download ||
    module.has_quiz ||
    module.has_homework ||
    lessonCount > 0,
  );

const getModuleStatus = (
  moduleId: string,
  completedMap: Record<string, ModuleCompletion>,
) => {
  const completion = completedMap[moduleId];
  const bestScore = completion?.bestScore;
  const completionKind = completion?.completionKind ?? "quiz";

  if (completion?.passed) {
    return {
      state: "completed" as const,
      bestScore,
      completionKind,
      label:
        completionKind === "photo"
          ? "Template photo submitted"
          : completionKind === "exempt"
            ? "Not required"
            : `Completed${bestScore != null ? ` · ${bestScore}%` : ""}`,
    };
  }

  if (completion) {
    return {
      state: "failed" as const,
      bestScore,
      completionKind,
      label: `Not Passed · Retake${bestScore != null ? ` · ${bestScore}%` : ""}`,
    };
  }

  return {
    state: "not-started" as const,
    bestScore: undefined,
    completionKind: undefined,
    label: "",
  };
};

const ModuleStatusBadge = ({
  status,
  compact = false,
}: {
  status: ReturnType<typeof getModuleStatus>;
  compact?: boolean;
}) => {
  if (status.state === "not-started") return null;

  const isCompleted = status.state === "completed";
  const isZeroFail = !isCompleted && status.bestScore === 0;
  const Icon = isCompleted ? CheckCircle2 : RotateCcw;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-bold uppercase tracking-wide",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px]",
        isCompleted
          ? "border-success-soft/25 bg-success-soft/5 text-success-soft/80"
          : isZeroFail
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-warning/35 bg-warning/10 text-warning",
      )}
    >
      <Icon className="h-3 w-3" />
      {status.label}
    </span>
  );
};

const QuizStatusIndicator = ({
  hasQuiz,
  status,
  locale,
  size = "sm",
}: {
  hasQuiz: boolean;
  status: ReturnType<typeof getModuleStatus>;
  locale: "en" | "es";
  size?: "sm" | "md";
}) => {
  if (!hasQuiz) return null;

  const iconSize = size === "md" ? "w-4 h-4" : "w-3 h-3";
  const label = localizeCourseUi("Quiz", locale);

  if (status.state === "completed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground">
        <CheckCircle2 className={iconSize} />
        {label}
      </span>
    );
  }

  if (status.state === "failed") {
    const isZero = status.bestScore === 0;
    const Icon = isZero ? XCircle : AlertTriangle;
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground"
      >
        <Icon className={iconSize} />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
      <HelpCircle className={iconSize} />
      {label}
    </span>
  );
};

const SubLessonTrack = ({
  lessons,
  compact = false,
  startNumber = 1,
  onLessonClick,
}: {
  lessons: ModuleLessonPreview[];
  compact?: boolean;
  startNumber?: number;
  onLessonClick?: (lessonId: string) => void;
}) => {
  if (lessons.length === 0) return null;

  return (
    <div className={cn("space-y-2", compact ? "ml-12" : "ml-16")}>
      {lessons.map((lesson, lessonIndex) => (
        <button
          type="button"
          key={lesson.id}
          onClick={(e) => {
            e.stopPropagation();
            onLessonClick?.(lesson.id);
          }}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/10 text-left shadow-sm shadow-black/10 transition-all",
            "hover:border-primary/45 hover:bg-secondary/20 active:scale-[0.99]",
            compact ? "min-h-[56px] px-3 py-2.5" : "min-h-[64px] px-3.5 py-3",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-background text-xs font-semibold text-primary">
            {startNumber + lessonIndex}
          </div>
          <p
            className={cn(
              "min-w-0 flex-1 truncate font-semibold text-foreground",
              compact ? "text-sm" : "text-[15px]",
            )}
          >
            {lesson.title}
          </p>
          <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
};

export default function Courses({ courseType = "hair-system" }: CoursesProps) {
  const { data: allCoursesRaw = [], isLoading } = useCourses();
  const { isAdmin, user } = useAuth();
  const { locale } = useLocale();

  // Directory enrollment module is always visible to everyone.
  // Verification that the user is holding the certificate happens at upload time
  // via AI image analysis in the analyze-certificate-template edge function.
  const allCourses = allCoursesRaw;
  const hairSystemCourseId = allCourses.find(
    (course) => (course as any).category === "hair-system",
  )?.id;
  const { data: hairSystemCertification, isLoading: isLoadingCertification } =
    useUserCertification(hairSystemCourseId);
  const { data: specialistListing, isLoading: isLoadingListing } =
    useMyListing(user?.id);
  // A successful legacy resubmission stamps certification_version >= 2, which
  // fully clears the directory action-step card even if the specialist listing
  // hasn't propagated yet.
  const legacyResubmissionCompleted =
    !!hairSystemCertification &&
    ((hairSystemCertification as any).certification_version ?? 1) >= 2;
  const needsDirectoryListing =
    !!hairSystemCertification &&
    !legacyResubmissionCompleted &&
    !isLoadingListing &&
    !specialistListing;

  // For desktop: filter by courseType prop
  const courses = useMemo(
    () =>
      allCourses.filter((course) => (course as any).category === courseType),
    [allCourses, courseType],
  );
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [highlightedModule, setHighlightedModule] = useState<string | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const positionedSelectedModuleRef = useRef<string | null>(null);
  const pendingSidebarScrollRef = useRef<SidebarScrollMode | null>(null);
  const previousCourseTypeRef = useRef(courseType);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const isTabletOrDesktop = useIsTabletOrDesktop();
  const isDesktop = useIsDesktop();
  const { data: completedMap = {} } = useCompletedModules();
  const isModuleCompleted = (id: string) => !!completedMap[id]?.passed;
  const selectedModuleParam = searchParams.get("module");
  const [orderWatchSeconds, setOrderWatchSeconds] = useState(0);
  const [showBusinessWelcome, setShowBusinessWelcome] = useState(false);

  // This is an orientation moment, not another course requirement. It appears
  // only after an explicit certification/database resubmission has set the
  // pending flag; an old certification record alone is not enough.
  useEffect(() => {
    if (courseType !== "business" || !user?.id) return;

    let pending = false;
    try {
      pending =
        window.sessionStorage.getItem(BUSINESS_MASTERY_WELCOME_PENDING_KEY) ===
        "1";
    } catch {
      pending = false;
    }

    if (
      !pending ||
      isAdmin ||
      isLoadingCertification ||
      !hairSystemCertification
    ) {
      return;
    }

    const seenKey = `business-mastery-welcome-seen:v2:${user.id}`;
    try {
      if (window.localStorage.getItem(seenKey) === "1") return;
      setShowBusinessWelcome(true);
    } catch {
      // If storage is unavailable, still show the orientation this visit.
      setShowBusinessWelcome(true);
    }
  }, [
    courseType,
    hairSystemCertification,
    isLoadingCertification,
    isAdmin,
    user?.id,
  ]);

  const dismissBusinessWelcome = useCallback(() => {
    if (user?.id) {
      try {
        window.localStorage.setItem(
          `business-mastery-welcome-seen:v2:${user.id}`,
          "1",
        );
      } catch {
        // Dismissal still applies for this render if storage is unavailable.
      }
    }
    try {
      window.sessionStorage.removeItem(BUSINESS_MASTERY_WELCOME_PENDING_KEY);
    } catch {
      // Ignore storage failures; the modal is still dismissed in local state.
    }
    setShowBusinessWelcome(false);
  }, [user?.id]);

  // Returning from a lesson should reopen the track list directly on mobile,
  // without selecting a module and reopening its preview sheet.
  useEffect(() => {
    const routeState = location.state as
      | { openTrack?: string; highlightModule?: string }
      | null;
    const requestedTrack = routeState?.openTrack;
    let rememberedModule = routeState?.highlightModule || null;

    if (!rememberedModule && typeof window !== "undefined") {
      try {
        rememberedModule = window.sessionStorage.getItem(
          getLastCourseModuleKey(courseType),
        );
      } catch {
        rememberedModule = null;
      }
    }

    if (requestedTrack !== courseType && !rememberedModule) return;

    setExpandedCourse(courseType);
    setHighlightedModule(rememberedModule);

    if (requestedTrack === courseType) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [courseType, location.pathname, location.state, navigate]);

  // On mobile, bring the remembered module back into view after the track
  // list has expanded. The marker is intentionally subtle; the scroll is the
  // primary way to orient the member when they return.
  useEffect(() => {
    if (isTabletOrDesktop || !expandedCourse || !highlightedModule) return;

    let attempts = 0;
    let retryTimer: number | undefined;
    const scrollToRememberedCard = () => {
      const card = Array.from(
        document.querySelectorAll(`[data-module-id="${highlightedModule}"]`),
      ).find((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (card) {
        card.scrollIntoView({ behavior: "auto", block: "center" });
        return;
      }

      if (attempts < 40) {
        attempts += 1;
        retryTimer = window.setTimeout(scrollToRememberedCard, 100);
      }
    };

    retryTimer = window.setTimeout(scrollToRememberedCard, 0);

    return () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [expandedCourse, highlightedModule, isTabletOrDesktop]);

  // The order lesson stores cumulative playback locally. Read it on mount,
  // when returning to this page, and when another tab updates the value so
  // the outside module card reflects the same watch progress as the lesson.
  useEffect(() => {
    const refreshOrderWatch = () =>
      setOrderWatchSeconds(readOrderWatchSeconds(user?.id));

    refreshOrderWatch();
    window.addEventListener("focus", refreshOrderWatch);
    window.addEventListener("visibilitychange", refreshOrderWatch);
    window.addEventListener("storage", refreshOrderWatch);
    return () => {
      window.removeEventListener("focus", refreshOrderWatch);
      window.removeEventListener("visibilitychange", refreshOrderWatch);
      window.removeEventListener("storage", refreshOrderWatch);
    };
  }, [user?.id]);

  const orderWatchPercent = Math.min(
    100,
    Math.round((orderWatchSeconds / HAIR_SYSTEM_ORDER_COMPLETION_SECONDS) * 100),
  );

  const clearModuleSearchParam = useCallback(() => {
    if (!selectedModuleParam) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("module");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, selectedModuleParam, setSearchParams]);

  const clearModuleSelection = useCallback(() => {
    setSelectedModule(null);
    positionedSelectedModuleRef.current = null;
    pendingSidebarScrollRef.current = null;
    clearModuleSearchParam();
  }, [clearModuleSearchParam]);

  const pageTitle =
    courseType === "hair-system" ? "Hair System Training" : "Business Mastery";

  // Group courses by category (for mobile only)
  const courseCategories = useMemo(
    () => [
      {
        id: "hair-system",
        title: "Hair System Training",
        courses: allCourses.filter(
          (c) => (c as any).category === "hair-system",
        ),
      },
      {
        id: "business",
        title: "Business Mastery",
        courses: allCourses.filter((c) => (c as any).category === "business"),
      },
    ],
    [allCourses],
  );

  const positionSelectedModuleCard = useCallback(
    (moduleId: string, mode: SidebarScrollMode) => {
      const positionCard = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const el = container.querySelector(
          `[data-module-id="${moduleId}"]`,
        ) as HTMLElement | null;
        if (!el) return;

        const margin = 40;
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const elementTop =
          elRect.top - containerRect.top + container.scrollTop;
        const elementBottom = elementTop + elRect.height;
        const maxScrollTop = Math.max(
          0,
          container.scrollHeight - container.clientHeight,
        );
        const clampScrollTop = (value: number) =>
          Math.max(0, Math.min(value, maxScrollTop));

        const centerTop =
          elementTop - (container.clientHeight - elRect.height) / 2;

        if (mode === "click") {
          const isFullyVisible =
            elRect.top >= containerRect.top + margin &&
            elRect.bottom <= containerRect.bottom - margin;

          if (isFullyVisible) return;

          container.scrollTo({
            top: clampScrollTop(centerTop),
            behavior: "smooth",
          });
          return;
        }

        container.scrollTo({
          top: clampScrollTop(centerTop),
          behavior: "auto",
        });

      };

      requestAnimationFrame(() => requestAnimationFrame(positionCard));
    },
    [],
  );

  // Check if there's more content to scroll
  useEffect(() => {
    const checkScroll = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const hasMoreContent = container.scrollHeight > container.clientHeight;
        const notAtBottom =
          container.scrollTop + container.clientHeight <
          container.scrollHeight - 20;
        setCanScrollMore(hasMoreContent && notAtBottom);
      }
    };

    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      container?.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [courses]);

  useLayoutEffect(() => {
    if (previousCourseTypeRef.current === courseType) return;

    previousCourseTypeRef.current = courseType;
    setSelectedModule(null);
    setIsCertModalOpen(false);
    positionedSelectedModuleRef.current = null;
    pendingSidebarScrollRef.current = null;
    clearModuleSearchParam();
  }, [clearModuleSearchParam, courseType]);

  useLayoutEffect(() => {
    if (!selectedModuleParam) {
      setSelectedModule(null);
      positionedSelectedModuleRef.current = null;
      pendingSidebarScrollRef.current = null;
      return;
    }

    const moduleExists = courses.some((course) =>
      (course.modules || []).some((module) => module.id === selectedModuleParam),
    );

    if (moduleExists) {
      setSelectedModule(selectedModuleParam);
      setIsCertModalOpen(false);

      if (!isDesktop) {
        pendingSidebarScrollRef.current = null;
        positionedSelectedModuleRef.current = selectedModuleParam;
        return;
      }

      const pendingMode = pendingSidebarScrollRef.current;
      pendingSidebarScrollRef.current = null;

      if (pendingMode === "click") {
        positionSelectedModuleCard(selectedModuleParam, "click");
        positionedSelectedModuleRef.current = selectedModuleParam;
        return;
      }

      if (positionedSelectedModuleRef.current !== selectedModuleParam) {
        positionSelectedModuleCard(selectedModuleParam, "restore");
        positionedSelectedModuleRef.current = selectedModuleParam;
      }
    } else {
      setSelectedModule(null);
      positionedSelectedModuleRef.current = null;
      pendingSidebarScrollRef.current = null;

      if (!isLoading) {
        clearModuleSearchParam();
      }
    }
  }, [
    clearModuleSearchParam,
    courses,
    isDesktop,
    isLoading,
    positionSelectedModuleCard,
    selectedModuleParam,
  ]);

  const selectDesktopModule = (moduleId: string) => {
    if (moduleId !== selectedModuleParam) {
      pendingSidebarScrollRef.current = "click";
    }
    setSelectedModule(moduleId);
    setIsCertModalOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("module", moduleId);
    setSearchParams(nextParams, { replace: true });
  };

  const goToLesson = (moduleId: string, categoryId: string, tab?: string) => {
    const url = tab
      ? `/courses/${categoryId}/lesson/${moduleId}?tab=${tab}`
      : `/courses/${categoryId}/lesson/${moduleId}`;
    navigate(url);
  };

  // Find selected module data (for desktop - uses courseType)
  const findModule = (): { module: Module; courseName: string } | null => {
    for (const course of courses) {
      const module = (course.modules || []).find(
        (m) => m.id === selectedModule,
      );
      if (module) return { module, courseName: course.title };
    }
    return null;
  };

  const moduleData = findModule();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (allCourses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4">
          <BookOpen className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Courses Yet</h2>
          <p className="text-muted-foreground">
            Courses will appear here once available
          </p>
          {isAdmin && (
            <Link to="/admin/courses">
              <Button className="gap-2">
                <Settings className="w-4 h-4" />
                Go to Admin
              </Button>
            </Link>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Mobile Module Detail Sheet - only shows on mobile (lg:hidden via CSS media query)
  const MobileModuleSheet = () => (
    <Sheet
      open={!!selectedModule}
      onOpenChange={(open) => !open && clearModuleSelection()}
      modal={false}
    >
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        {moduleData && (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b border-border/30">
              <p
                className="text-xs text-muted-foreground"
                data-no-translate
                translate="no"
              >
                {localizeCourseTitle(moduleData.courseName, locale)}
              </p>
              <SheetTitle
                className="text-lg font-bold gold-text text-left"
                data-no-translate
                translate="no"
              >
                {localizeHairSystemLessonTitle(moduleData.module, locale)}
              </SheetTitle>
            </SheetHeader>

            {/* Video Preview - only show if video exists */}
            {moduleData.module.video_url?.trim() && (
              <div className="relative aspect-video bg-black">
                {moduleData.module.id === HAIR_SYSTEM_ORDER_MODULE_ID ? (
                  <OrderLessonPreviewIframe
                    module={moduleData.module}
                    locale={locale}
                  />
                ) : (
                  <iframe
                    key={`${moduleData.module.id}-${locale}`}
                    src={resolveVideoEmbedUrlForModule(
                      moduleData.module,
                      locale,
                      getVimeoEmbedUrl,
                    )}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={localizeHairSystemLessonTitle(
                      moduleData.module,
                      locale,
                    )}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {(() => {
                const sheetStatus = getModuleStatus(
                  moduleData.module.id,
                  completedMap,
                );
                const sheetCompleted = sheetStatus.state === "completed";
                const sheetFailed = sheetStatus.state === "failed";
                const sheetZero = sheetFailed && sheetStatus.bestScore === 0;
                const sheetScore = sheetStatus.bestScore;
                return (
                  <>
                    {moduleData.module.description && (
                      <p className="text-sm text-muted-foreground">
                        {moduleData.module.description}
                      </p>
                    )}

                    {sheetCompleted && (
                      <div className="flex items-center gap-2 rounded-xl border-2 border-success/50 bg-success/10 p-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground shadow-md">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-success">
                            {sheetStatus.completionKind === "photo"
                              ? "Template photo submitted"
                              : sheetStatus.completionKind === "exempt"
                                ? "Requirement not required"
                                : sheetStatus.completionKind === "video"
                                  ? "Watch time complete"
                                : localizeCourseUi("Lesson Completed", locale)}
                          </p>
                          <p className="text-[10px] text-success-foreground/80">
                            {sheetStatus.completionKind === "photo"
                              ? "Certification requirement complete"
                              : sheetStatus.completionKind === "exempt"
                                ? "Added after your certification cohort"
                                : sheetStatus.completionKind === "video"
                                  ? "Required video time watched · rewatch lesson"
                                : `${localizeCourseUi("Quiz passed", locale)}${sheetScore != null ? ` ${sheetScore}%` : ""} · ${localizeCourseUi("rewatch lesson", locale)}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {sheetFailed && (
                      <div className={cn(
                        "flex items-center gap-2 rounded-xl border-2 p-3",
                        sheetZero
                          ? "border-destructive/50 bg-destructive/10"
                          : "border-warning/50 bg-warning/10"
                      )}>
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md",
                          sheetZero ? "bg-destructive" : "bg-warning"
                        )}>
                          {sheetZero ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "text-xs font-bold",
                            sheetZero ? "text-destructive" : "text-warning"
                          )}>
                            {localizeCourseUi("Retake Lesson", locale)}
                          </p>
                          <p className={cn(
                            "text-[10px]",
                            sheetZero ? "text-destructive-foreground/80" : "text-warning-foreground/80"
                          )}>
                            {localizeCourseUi("Quiz not passed", locale)}{sheetScore != null ? ` ${sheetScore}%` : ""} · {localizeCourseUi("rewatch lesson", locale)}
                          </p>
                        </div>
                      </div>
                    )}

                    <Button
                      className={cn(
                        "w-full font-semibold py-5",
                        sheetCompleted
                          ? "bg-success hover:bg-success/90 text-success-foreground"
                          : sheetFailed
                            ? sheetZero
                              ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              : "bg-warning hover:bg-warning/90 text-warning-foreground"
                            : "gold-gradient text-primary-foreground",
                      )}
                      onClick={() => goToLesson(moduleData.module.id, courseType)}
                    >
                      {sheetCompleted ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                          {sheetStatus.completionKind === "photo"
                            ? "View Submission"
                            : localizeCourseUi("Review Lesson", locale)}
                        </>
                      ) : sheetFailed ? (
                        <>
                          <RotateCcw className="w-5 h-5 mr-2" />
                          {localizeCourseUi("Retake Lesson", locale)}
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2" />
                          {localizeCourseUi("Start Lesson", locale)}
                        </>
                      )}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    {(moduleData.module.has_quiz ||
                      moduleData.module.has_homework) && (
                      <div className="flex gap-2">
                        {moduleData.module.has_quiz && (() => {
                          const SheetQuizIcon = sheetCompleted
                            ? CheckCircle2
                            : sheetFailed
                              ? sheetZero
                                ? XCircle
                                : AlertTriangle
                              : HelpCircle;
                          return (
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-1",
                                sheetCompleted && "border-success/50 text-success hover:bg-success/10",
                                sheetFailed &&
                                  (sheetZero
                                    ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                                    : "border-warning/50 text-warning hover:bg-warning/10"),
                                !sheetCompleted && !sheetFailed && "border-primary/50 text-primary hover:bg-primary/10",
                              )}
                              onClick={() =>
                                goToLesson(moduleData.module.id, courseType, "quiz")
                              }
                            >
                              <SheetQuizIcon
                                className={cn(
                                  "w-4 h-4 mr-2",
                                  sheetCompleted && "text-success",
                                  sheetFailed &&
                                    (sheetZero ? "text-destructive" : "text-warning"),
                                  !sheetCompleted && !sheetFailed && "text-primary",
                                )}
                              />
                              {sheetCompleted
                                ? localizeCourseUi("Review Quiz", locale)
                                : sheetFailed
                                  ? localizeCourseUi("Retake quiz", locale)
                                  : localizeCourseUi("Quiz", locale)}
                            </Button>
                          );
                        })()}
                        {moduleData.module.has_homework && (
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                              goToLesson(moduleData.module.id, courseType, "homework")
                            }
                          >
                            <ClipboardList className="w-4 h-4 mr-2 text-green-400" />
                            Homework
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  return (
    <DashboardLayout>
      {/* Mobile View */}
      <div className="md:hidden flex flex-col h-[calc(100vh-8rem)]">
        {isAdmin && (
          <div className="flex justify-end mb-3">
            <Link to="/admin/courses">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs px-2"
              >
                <Settings className="w-3.5 h-3.5" />
                Edit
              </Button>
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 pb-4">
          {/* Two square track cards — tap to expand */}
          {expandedCourse === null && (
            <div className="grid grid-cols-1 gap-3">
              {courseCategories.map((category) => {
                const allModules = category.courses.flatMap(
                  (c) => (c.modules || []) as Module[],
                );
                const trackable = allModules.filter(
                  (m: any) => !m.is_directory_enrollment,
                );
                const total = trackable.length;
                const isHair = category.id === "hair-system";
                const certificationComplete = isHair && !!hairSystemCertification;
                const needsDatabaseListing = isHair && needsDirectoryListing;
                const done = trackable.filter((m) =>
                  isModuleCompleted(m.id),
                ).length;
                // An issued certificate completes the certification track for
                // display purposes; individual lesson cards retain real status.
                const displayedDone = certificationComplete ? total : done;
                const pct = total
                  ? Math.round((displayedDone / total) * 100)
                  : 0;
                const trackDescription = needsDatabaseListing
                  ? "Get added into the Hair System Database. Click here to do so."
                  : isHair
                    ? "Master installation, maintenance, styling, and certification."
                    : "Build your client pipeline and business systems.";
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      if (needsDatabaseListing) {
                        setIsCertModalOpen(true);
                        clearModuleSelection();
                      } else {
                        setExpandedCourse(category.id);
                      }
                    }}
                    className={cn(
                      "relative flex flex-col text-left overflow-hidden rounded-[1.5rem] border p-5 transition-all active:scale-[0.985]",
                      needsDatabaseListing
                        ? "border-warning/80 bg-warning/10 shadow-lg shadow-warning/20 hover:border-warning"
                        : "border-border/80 bg-card/80 shadow-lg shadow-black/40 hover:border-primary/50",
                      "min-h-[184px]",
                    )}
                  >
                    <div className="relative flex flex-1 flex-col">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-lg border px-3 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.16em]",
                            needsDatabaseListing
                              ? "border-warning/70 bg-warning/20 text-warning"
                              : "border-primary/40 bg-primary/5 text-primary",
                          )}
                        >
                          {needsDatabaseListing
                            ? "Action step"
                            : certificationComplete
                            ? "Certified"
                            : isHair
                              ? "Certification"
                              : "Business Growth"}
                        </span>
                        {needsDatabaseListing ? (
                          <AlertTriangle className="h-5 w-5 animate-pulse text-warning" />
                        ) : certificationComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-success-soft" />
                        ) : isHair ? (
                          <BookOpen className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <Trophy className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <h2 className="mt-4 font-sans text-xl font-semibold leading-tight tracking-tight text-foreground">
                        {category.title}
                      </h2>
                      <p
                        className={cn(
                          "mt-1 max-w-[290px] font-sans text-sm leading-5",
                          needsDatabaseListing
                            ? "font-semibold text-warning"
                            : "text-muted-foreground",
                        )}
                      >
                        {trackDescription}
                      </p>
                      <div className="mt-5 flex items-center gap-4">
                        <div
                          className="relative h-[76px] w-[76px] shrink-0 rounded-full p-2"
                          style={{
                            background: `conic-gradient(hsl(var(--primary)) ${pct * 3.6}deg, hsl(var(--secondary)) 0deg)`,
                          }}
                        >
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-card">
                            <span className="font-sans text-xl font-semibold tabular-nums tracking-tight gold-text">
                              {pct}%
                            </span>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 font-sans text-sm font-semibold gold-text">
                            {certificationComplete && (
                              <CheckCircle2 className="h-4 w-4 text-success-soft" />
                            )}
                            <span>
                              {certificationComplete
                                ? "You are certified"
                                : `${displayedDone} of ${total} lessons`}
                            </span>
                          </div>
                          {certificationComplete && (
                            <div className="mt-1 font-sans text-xs text-muted-foreground">
                              {displayedDone} of {total} lessons complete
                            </div>
                          )}
                          {needsDatabaseListing && (
                            <div className="mt-1 font-sans text-xs font-semibold text-warning">
                              One action step remaining
                            </div>
                          )}
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary/80">
                            <div
                              className="h-full rounded-full gold-gradient transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-sans text-sm font-semibold transition-colors",
                        needsDatabaseListing
                          ? "border-warning bg-warning text-warning-foreground shadow-md shadow-warning/30 hover:brightness-105"
                          : done > 0
                          ? "border-transparent gold-gradient text-primary-foreground hover:brightness-105"
                          : "border-primary/40 text-primary hover:bg-primary/5",
                      )}
                    >
                      {needsDatabaseListing
                        ? "Get added into the Hair System Database"
                        : certificationComplete
                          ? "Review lessons"
                        : done > 0
                          ? "Continue lesson"
                          : "Start lesson"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {expandedCourse !== null && (
            <button
              type="button"
              onClick={() => {
                setExpandedCourse(null);
                setHighlightedModule(null);
                try {
                  window.sessionStorage.removeItem(getLastCourseModuleKey(courseType));
                } catch {
                  // Ignore storage failures; the visual state is still cleared.
                }
              }}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              Back to tracks
            </button>
          )}

          {courseCategories.map((category) => (
            <Collapsible
              key={category.id}
              open={expandedCourse === category.id}
              onOpenChange={(open) => {
                setExpandedCourse(open ? category.id : null);
                if (!open) {
                  setHighlightedModule(null);
                  try {
                    window.sessionStorage.removeItem(
                      getLastCourseModuleKey(courseType),
                    );
                  } catch {
                    // Ignore storage failures; the visual state is still cleared.
                  }
                }
              }}
            >
              <CollapsibleTrigger className="w-full" asChild>
                <div
                  className={cn(
                    "glass-card rounded-xl p-4 flex items-center justify-between transition-all border-2 border-primary/40",
                    expandedCourse === category.id ? "flex" : "hidden",
                  )}
                >
                  <div className="text-left">
                    <h2 className="font-sans text-lg font-semibold tracking-tight gold-text">
                      {category.title}
                    </h2>
                    <p className="font-sans text-sm text-muted-foreground mt-0.5">
                      {category.courses.reduce(
                        (acc, c) => acc + (c.modules?.length || 0),
                        0,
                      )}{" "}
                      modules
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "w-5 h-5 text-primary transition-transform duration-200",
                      expandedCourse === category.id && "rotate-180",
                    )}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 mt-3">
                {category.courses.map((course) => {
                  const allModules = course.modules || [];
                  const regularModules = allModules.filter(
                    (m: any) => !m.is_directory_enrollment,
                  );
                  const directoryModule = allModules.find(
                    (m: any) => m.is_directory_enrollment,
                  );
                  return (
                    <div key={course.id} className="space-y-2">
                      {category.courses.length > 1 && (
                        <div className="glass-card rounded-lg p-3 border-l-2 border-primary/50 ml-2">
                          <h3 className="font-semibold text-sm">
                            {localizeCourseTitle(course.title, locale)}
                          </h3>
                        </div>
                      )}
                      <div className="space-y-2 pl-2">
                        {regularModules.map((module, index) => {
                          const moduleLessons = getModuleLessons(module);
                          const hasCardDetails = hasModuleCardDetails(
                            module,
                            moduleLessons.length,
                          );
                          const status = getModuleStatus(module.id, completedMap);
                          const isOrderTrackingModule =
                            module.id === HAIR_SYSTEM_ORDER_MODULE_ID;
                          const orderWatchComplete =
                            isOrderTrackingModule && orderWatchPercent >= 100;
                          const completed =
                            status.state === "completed" || orderWatchComplete;
                          const attemptedNotPassed = status.state === "failed";
                          const failedAtZero = attemptedNotPassed && status.bestScore === 0;
                          const isHighlighted = highlightedModule === module.id;
                          return (
                            <div key={module.id} className="space-y-1">
                              <button
                                data-module-id={module.id}
                                onClick={() => {
                                  setHighlightedModule(null);
                                  try {
                                    window.sessionStorage.setItem(
                                      getLastCourseModuleKey(courseType),
                                      module.id,
                                    );
                                  } catch {
                                    // Ignore storage failures; navigation still works.
                                  }
                                  navigate(
                                    `/courses/${category.id}/lesson/${module.id}`,
                                  );
                                }}
                                className={cn(
                                  "w-full min-h-[100px] p-3.5 rounded-xl flex items-center gap-3 transition-all duration-200 text-left border-2 shadow-md shadow-black/20 active:scale-[0.98]",
                                  isHighlighted
                                    ? "border-primary/55 bg-primary/[0.03] shadow-sm shadow-primary/10"
                                    : completed
                                      ? "border-success-soft/20 bg-gradient-to-r from-success-soft/[0.025] to-transparent"
                                      : attemptedNotPassed
                                        ? failedAtZero
                                          ? "border-destructive/35 bg-gradient-to-r from-destructive/[0.06] to-transparent"
                                          : "border-warning/35 bg-gradient-to-r from-warning/[0.06] to-transparent"
                                        : isOrderTrackingModule && orderWatchPercent > 0
                                          ? "border-warning/35 bg-gradient-to-r from-warning/[0.06] to-transparent"
                                        : "border-border bg-secondary/10",
                                )}
                              >
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm border",
                                    completed
                                      ? "border-success-soft/25 bg-success-soft/5 text-success-soft/80"
                                      : attemptedNotPassed
                                        ? failedAtZero
                                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                                          : "border-warning/40 bg-warning/10 text-warning"
                                        : isOrderTrackingModule && orderWatchPercent > 0
                                          ? "border-warning/40 bg-warning/10 text-warning"
                                        : "bg-secondary border-border text-muted-foreground",
                                  )}
                                >
                                  {completed ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                  ) : attemptedNotPassed ? (
                                    <RotateCcw className="w-4 h-4" />
                                  ) : isOrderTrackingModule && orderWatchPercent > 0 ? (
                                    <Clock className="w-5 h-5" />
                                  ) : (
                                    index + 1
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "flex-1 min-w-0",
                                    !hasCardDetails &&
                                      !isOrderTrackingModule &&
                                      "flex items-center",
                                  )}
                                >
                                  <h4
                                    key={`${module.id}-${locale}-mobile-title`}
                                    className={cn(
                                      "font-semibold text-[15px] truncate flex items-center gap-1.5",
                                      "text-foreground",
                                    )}
                                    data-no-translate
                                    translate="no"
                                  >
                                    {localizeHairSystemLessonTitle(
                                      module,
                                      locale,
                                    )}
                                    {(module as any)
                                      .is_certification_requirement && (
                                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                                    )}
                                  </h4>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {isOrderTrackingModule && !completed ? (
                                      <>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/35 bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                                          {orderWatchPercent}% complete
                                        </span>
                                        <span className="text-[10px] font-medium text-warning/80">
                                          Please complete lesson
                                        </span>
                                      </>
                                    ) : (
                                      <ModuleStatusBadge status={status} compact />
                                    )}
                                    {hasCardDetails && (
                                      <>
                                        {module.duration && (
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3" />
                                            {module.duration}
                                          </span>
                                        )}
                                        {moduleLessons.length > 0 && (
                                          <span className="text-xs text-primary">
                                            {formatSubLessonCount(
                                              moduleLessons.length,
                                            )}
                                          </span>
                                        )}
                                        <QuizStatusIndicator
                                          hasQuiz={module.has_quiz}
                                          status={status}
                                          locale={locale}
                                        />
                                        {module.has_homework && (
                                          <ClipboardList className="w-3 h-3 text-green-400" />
                                        )}
                                        {module.has_download && (
                                          <FileText className="w-3 h-3 text-blue-400" />
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Play className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                              </button>

                              <SubLessonTrack
                                lessons={moduleLessons}
                                compact
                                startNumber={
                                  module.id === FIRST_POST_MODULE_ID ? 2 : 1
                                }
                                onLessonClick={(lessonId) =>
                                  navigate(
                                    `/courses/${category.id}/lesson/${module.id}?sublesson=${lessonId}`,
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                        {/* Level 1 Certification entry for hair-system */}
                        {category.id === "hair-system" && course.id && (
                          <button
                            onClick={() => {
                              setIsCertModalOpen(true);
                              clearModuleSelection();
                            }}
                            className="w-full min-h-[132px] p-5 rounded-2xl flex items-center gap-4 transition-all duration-200 text-left border-2 border-primary/45 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent shadow-lg shadow-primary/10 active:scale-[0.98]"
                          >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 gold-gradient shadow-md shadow-primary/20">
                              <Award className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base leading-tight gold-text">
                                Level 1 Certification
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {needsDirectoryListing
                                  ? "Get added into the Hair System Database. Click here to do so."
                                  : "Enter name and generate certificate"}
                              </p>
                            </div>
                            {needsDirectoryListing ? (
                              <Globe className="w-5 h-5 text-primary flex-shrink-0" />
                            ) : (
                              <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                            )}
                          </button>
                        )}
                        {/* Directory enrollment as final highlighted step (after certification) */}
                        {directoryModule && (
                          <button
                            key={directoryModule.id}
                            onClick={() =>
                              navigate(
                                `/courses/${category.id}/lesson/${directoryModule.id}`,
                              )
                            }
                            className="w-full min-h-[132px] p-5 rounded-2xl flex items-center gap-4 transition-all duration-200 text-left border-2 border-primary/45 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent shadow-lg shadow-primary/10 active:scale-[0.98]"
                          >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 gold-gradient shadow-md shadow-primary/20">
                              <Globe className="w-6 h-6 text-primary-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base leading-tight gold-text">
                                {directoryModule.title}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {directoryModule.description ||
                                  "Final step before certification"}
                              </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
        {!isTabletOrDesktop && <MobileModuleSheet />}
      </div>

      {/* Tablet & Desktop View */}
      <div className="hidden md:flex gap-6 h-[calc(100vh-5rem)] overflow-hidden">
        {/* Left Panel - Courses & Modules */}
        <div
          className={cn(
            "flex-shrink-0 overflow-hidden flex flex-col",
            isDesktop ? "w-96" : "w-full",
          )}
        >
          <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-bold gold-text">
                  {pageTitle}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Select a module to continue
                </p>
              </div>
              {isAdmin && (
                <Link to="/admin/courses">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Edit Courses
                  </Button>
                </Link>
              )}
            </div>

            <Select
              value={courseType}
              onValueChange={(value) => navigate(`/courses/${value}`)}
            >
              <SelectTrigger className="w-full bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="hair-system">
                  Hair System Training
                </SelectItem>
                <SelectItem value="business">Business Mastery</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex-1">
            <div
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-y-auto overflow-x-hidden space-y-3 pr-2 scrollbar-thin"
            >
              {courses.map((course) => (
                <div key={course.id} className="space-y-2">
                  {/* Course Title */}
                  <div className="glass-card rounded-lg p-3 border-l-2 border-primary/50">
                    <h2 className="font-semibold text-sm">{course.title}</h2>
                    {course.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {course.description}
                      </p>
                    )}
                  </div>

                  {/* Modules */}
                  <div className="space-y-2 pl-2">
                    {(() => {
                      const allModules = course.modules || [];
                      const regularModules = allModules.filter(
                        (m: any) => !m.is_directory_enrollment,
                      );
                      const directoryModule = allModules.find(
                        (m: any) => m.is_directory_enrollment,
                      );
                      return (
                        <>
                          {regularModules.map((module, index) => {
                            const isSelected = selectedModule === module.id;
                            const isHighlighted =
                              !isTabletOrDesktop && highlightedModule === module.id;
                            const status = getModuleStatus(module.id, completedMap);
                            const isOrderTrackingModule =
                              module.id === HAIR_SYSTEM_ORDER_MODULE_ID;
                            const orderWatchComplete =
                              isOrderTrackingModule && orderWatchPercent >= 100;
                            const completed =
                              status.state === "completed" || orderWatchComplete;
                            const attemptedNotPassed = status.state === "failed";
                            const failedAtZero = attemptedNotPassed && status.bestScore === 0;
                            const moduleLessons = getModuleLessons(module);
                            const hasCardDetails = hasModuleCardDetails(
                              module,
                              moduleLessons.length,
                            );
                            return (
                              <div key={module.id} className="space-y-1">
                                <button
                                  data-module-id={module.id}
                                  onClick={() => {
                                    setHighlightedModule(null);
                                    try {
                                      window.sessionStorage.setItem(
                                        getLastCourseModuleKey(courseType),
                                        module.id,
                                      );
                                    } catch {
                                      // Ignore storage failures; navigation still works.
                                    }
                                    if (
                                      courseType === "business" ||
                                      shouldOpenModuleDirectly(module) ||
                                      !module.video_url?.trim()
                                    ) {
                                      navigate(
                                        `/courses/${courseType}/lesson/${module.id}`,
                                      );
                                    } else if (isDesktop) {
                                      selectDesktopModule(module.id);
                                    } else {
                                      navigate(
                                        `/courses/${courseType}/lesson/${module.id}`,
                                      );
                                    }
                                  }}
                                  className={cn(
                                    "w-full p-4 rounded-xl flex gap-4 transition-all duration-300 text-left",
                                    hasCardDetails
                                      ? "items-start"
                                      : "items-center min-h-[78px]",
                                    "border-2 hover:border-primary/50 hover:bg-secondary/20",
                                    isSelected
                                      ? "bg-gradient-to-r from-primary/15 to-transparent border-primary/80 shadow-lg shadow-primary/25"
                                      : isHighlighted
                                        ? "border-primary/55 bg-primary/[0.03] shadow-sm shadow-primary/10"
                                        : completed
                                          ? "border-success-soft/20 bg-gradient-to-r from-success-soft/[0.025] to-transparent shadow-md shadow-success-soft/5"
                                          : attemptedNotPassed
                                            ? failedAtZero
                                              ? "border-destructive/35 bg-gradient-to-r from-destructive/[0.06] to-transparent shadow-md shadow-black/20"
                                              : "border-warning/35 bg-gradient-to-r from-warning/[0.06] to-transparent shadow-md shadow-black/20"
                                          : isOrderTrackingModule && orderWatchPercent > 0
                                            ? "border-warning/35 bg-gradient-to-r from-warning/[0.06] to-transparent shadow-md shadow-black/20"
                                          : "border-border bg-secondary/10 shadow-md shadow-black/20",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all",
                                      completed
                                        ? "border border-success-soft/25 bg-success-soft/5 text-success-soft/80"
                                          : attemptedNotPassed
                                            ? failedAtZero
                                              ? "border border-destructive/40 bg-destructive/10 text-destructive"
                                              : "border border-warning/40 bg-warning/10 text-warning"
                                          : isOrderTrackingModule && orderWatchPercent > 0
                                            ? "border border-warning/40 bg-warning/10 text-warning"
                                          : isSelected
                                            ? "gold-gradient text-primary-foreground shadow-md"
                                            : "bg-secondary border border-border text-muted-foreground",
                                    )}
                                  >

                                    {completed ? (
                                      <CheckCircle2 className="w-5 h-5" />
                                    ) : attemptedNotPassed ? (
                                      <RotateCcw className="w-4 h-4" />
                                    ) : isOrderTrackingModule && orderWatchPercent > 0 ? (
                                      <Clock className="w-5 h-5" />
                                    ) : (
                                      index + 1
                                    )}
                                  </div>
                                  <div
                                    className={cn(
                                      "flex-1 min-w-0",
                                      !hasCardDetails &&
                                        !isOrderTrackingModule &&
                                        "flex items-center",
                                    )}
                                  >
                                    <h4
                                      key={`${module.id}-${locale}-desktop-title`}
                                      className={cn(
                                        "font-semibold text-sm flex items-center gap-1.5",
                                        hasCardDetails && "mb-1",
                                        isSelected && "text-primary",
                                      )}
                                      data-no-translate
                                      translate="no"
                                    >
                                      {localizeHairSystemLessonTitle(
                                        module,
                                        locale,
                                      )}
                                      {(module as any)
                                        .is_certification_requirement && (
                                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                                      )}
                                    </h4>
                                    {isOrderTrackingModule && !completed ? (
                                      <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/35 bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                                          {orderWatchPercent}% complete
                                        </span>
                                        <span className="text-[10px] font-medium text-warning/80">
                                          Please complete lesson
                                        </span>
                                      </div>
                                    ) : status.state !== "not-started" && (
                                      <div className="mb-2">
                                        <ModuleStatusBadge status={status} />
                                      </div>
                                    )}
                                    {hasCardDetails && (

                                      <>
                                        {module.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                            {module.description}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {module.duration && (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                              <Clock className="w-3 h-3" />
                                              {module.duration}
                                            </span>
                                          )}
                                          {module.has_download && (
                                            <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                              <FileText className="w-3 h-3" />
                                              {localizeCourseUi(
                                                "Files",
                                                locale,
                                              )}
                                            </span>
                                          )}
                                          {moduleLessons.length > 0 && (
                                            <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                              <FileText className="w-3 h-3" />
                                              {formatSubLessonCount(
                                                moduleLessons.length,
                                              )}
                                            </span>
                                          )}
                                          <QuizStatusIndicator
                                            hasQuiz={module.has_quiz}
                                            status={status}
                                            locale={locale}
                                          />
                                          {module.has_homework && (
                                            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                              <ClipboardList className="w-3 h-3" />
                                              {localizeCourseUi(
                                                "Homework",
                                                locale,
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <Play
                                    className={cn(
                                      "w-5 h-5 flex-shrink-0 transition-transform",
                                      isSelected
                                        ? "text-primary scale-110"
                                        : "text-muted-foreground",
                                    )}
                                  />
                                </button>
                                <SubLessonTrack
                                  lessons={moduleLessons}
                                  startNumber={
                                    module.id === FIRST_POST_MODULE_ID ? 2 : 1
                                  }
                                  onLessonClick={(lessonId) =>
                                    navigate(
                                      `/courses/${courseType}/lesson/${module.id}?sublesson=${lessonId}`,
                                    )
                                  }
                                />
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>

                  {/* Level 1 Certification entry for hair-system on desktop */}
                  {courseType === "hair-system" &&
                    (() => {
                      const directoryModule = (course.modules || []).find(
                        (m: any) => m.is_directory_enrollment,
                      );
                      return (
                        <div className="pl-2 mt-2 space-y-2">
                          <button
                            onClick={() => {
                              setIsCertModalOpen(true);
                              clearModuleSelection();
                            }}
                            className={cn(
                              "w-full min-h-[128px] p-5 rounded-2xl flex items-start gap-5 transition-all duration-300 text-left",
                              "border-2 hover:border-primary/60 hover:bg-secondary/20",
                              isCertModalOpen && !selectedModule
                                ? "bg-gradient-to-r from-primary/10 to-transparent border-primary/70 shadow-lg shadow-primary/20"
                                : "border-primary/45 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent shadow-lg shadow-primary/10",
                            )}
                          >
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                              {needsDirectoryListing ? (
                                <Globe className="w-6 h-6" />
                              ) : (
                                <Award className="w-6 h-6" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4
                                className={cn(
                                  "font-semibold text-base leading-tight mb-1",
                                  isCertModalOpen && !selectedModule
                                    ? "text-primary"
                                    : "gold-text",
                                )}
                              >
                                Level 1 Certification
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {needsDirectoryListing
                                  ? "Get added into the Hair System Database. Click here to do so."
                                  : "Enter name and generate certificate"}
                              </p>
                            </div>
                            {needsDirectoryListing ? (
                              <ArrowRight
                                className={cn(
                                  "w-6 h-6 flex-shrink-0",
                                  isCertModalOpen && !selectedModule
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                )}
                              />
                            ) : (
                            <Award
                              className={cn(
                                "w-6 h-6 flex-shrink-0",
                                isCertModalOpen && !selectedModule
                                  ? "text-primary"
                                : "text-muted-foreground",
                              )}
                            />
                            )}
                          </button>
                          {/* Directory enrollment after certification */}
                          {directoryModule && (
                            <button
                              onClick={() =>
                                navigate(
                                  `/courses/${courseType}/lesson/${directoryModule.id}`,
                                )
                              }
                              className="w-full min-h-[128px] p-5 rounded-2xl flex items-start gap-5 transition-all duration-300 text-left border-2 border-primary/45 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent shadow-lg shadow-primary/10 hover:border-primary/70"
                            >
                              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 gold-gradient text-primary-foreground shadow-md shadow-primary/20">
                                <Globe className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-base leading-tight mb-1 gold-text">
                                  {directoryModule.title}
                                </h4>
                                {directoryModule.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {directoryModule.description}
                                </p>
                              )}
                              </div>
                              <ArrowRight className="w-5 h-5 text-primary flex-shrink-0" />
                            </button>
                          )}
                        </div>
                      );
                    })()}
                </div>
              ))}
            </div>

            {/* Scroll indicator */}
            {canScrollMore && (
              <div className="absolute bottom-0 left-0 right-2 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none flex items-end justify-center pb-2">
                <div className="flex flex-col items-center animate-bounce">
                  <ChevronDown className="w-5 h-5 text-primary" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Module Content (Desktop only) */}
        {isDesktop && (
          <div
            className={cn(
              "flex-1 min-w-0 overflow-y-auto",
              !moduleData?.module.video_url?.trim() &&
                "flex items-center justify-center",
            )}
          >
            {moduleData ? (
              <div
                key={`${moduleData.module.id}-${locale}`}
                className={cn(
                  "glass-card rounded-xl overflow-hidden w-full",
                  !moduleData.module.video_url?.trim() && "max-w-lg",
                )}
              >
                {/* Module Header */}
                <div
                  className={cn(
                    "p-6",
                    moduleData.module.video_url?.trim() &&
                      "border-b border-border/30",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span
                      key={`${moduleData.module.id}-${locale}-course`}
                      data-no-translate
                      translate="no"
                    >
                      {localizeCourseTitle(moduleData.courseName, locale)}
                    </span>
                  </div>
                  <h1
                    key={`${moduleData.module.id}-${locale}-title`}
                    className="font-display text-2xl font-bold gold-text"
                    data-no-translate
                    translate="no"
                  >
                    {localizeHairSystemLessonTitle(moduleData.module, locale)}
                  </h1>
                  {moduleData.module.description && (
                    <p className="text-muted-foreground mt-1">
                      {moduleData.module.description}
                    </p>
                  )}
                </div>

                {/* Video Player - only show if video exists */}
                {moduleData.module.video_url?.trim() && (
                  <div className="relative aspect-video bg-black border-b border-border/30">
                    {moduleData.module.id === HAIR_SYSTEM_ORDER_MODULE_ID ? (
                      <OrderLessonPreviewIframe
                        module={moduleData.module}
                        locale={locale}
                      />
                    ) : (
                      <iframe
                        key={`${moduleData.module.id}-${locale}`}
                        src={resolveVideoEmbedUrlForModule(
                          moduleData.module,
                          locale,
                          getVimeoEmbedUrl,
                        )}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        title={localizeHairSystemLessonTitle(
                          moduleData.module,
                          locale,
                        )}
                      />
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="p-6 space-y-4">
                  {(() => {
                    const detailStatus = getModuleStatus(
                      moduleData.module.id,
                      completedMap,
                    );
                    const detailCompleted = detailStatus.state === "completed";
                    const detailFailed = detailStatus.state === "failed";
                    const detailZero = detailFailed && detailStatus.bestScore === 0;
                    const DetailQuizIcon = detailCompleted
                      ? CheckCircle2
                      : detailFailed
                        ? detailZero
                          ? XCircle
                          : AlertTriangle
                        : HelpCircle;
                    const detailScore = detailStatus.bestScore;
                    return (
                      <>
                        {detailCompleted && (
                          <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                              <Trophy className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-emerald-300">
                                {detailStatus.completionKind === "photo"
                                  ? "Template photo submitted"
                                  : detailStatus.completionKind === "exempt"
                                    ? "Requirement not required"
                                    : localizeCourseUi("Lesson Completed", locale)}
                              </p>
                              <p className="text-xs text-emerald-200/80">
                                {detailStatus.completionKind === "photo"
                                  ? "Certification requirement complete"
                                  : detailStatus.completionKind === "exempt"
                                    ? "Added after your certification cohort"
                                    : `${localizeCourseUi("Quiz passed", locale)}${detailScore != null ? ` ${detailScore}%` : ""} · ${localizeCourseUi("rewatch lesson", locale)}`}
                              </p>
                            </div>
                          </div>
                        )}
                        {detailFailed && (
                          <div className={cn(
                            "flex items-center gap-3 rounded-xl border-2 p-4",
                            detailZero
                              ? "border-destructive/50 bg-destructive/10"
                              : "border-warning/50 bg-warning/10"
                          )}>
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md",
                              detailZero ? "bg-destructive" : "bg-warning"
                            )}>
                              {detailZero ? <XCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                            </div>
                            <div className="flex-1">
                              <p className={cn(
                                "text-sm font-bold",
                                detailZero ? "text-destructive" : "text-warning"
                              )}>
                                {localizeCourseUi("Retake Lesson", locale)}
                              </p>
                              <p className={cn(
                                "text-xs",
                                detailZero ? "text-destructive-foreground/80" : "text-warning-foreground/80"
                              )}>
                                {localizeCourseUi("Quiz not passed", locale)}{detailScore != null ? ` ${detailScore}%` : ""} · {localizeCourseUi("rewatch lesson", locale)}
                              </p>
                            </div>
                          </div>
                        )}
                        <Button
                          className={cn(
                            "w-full font-semibold py-6 text-lg",
                            detailCompleted
                              ? "bg-emerald-500 hover:bg-emerald-500/90 text-white"
                              : detailFailed
                                ? detailZero
                                  ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                  : "bg-warning hover:bg-warning/90 text-warning-foreground"
                                : "gold-gradient text-primary-foreground",
                          )}
                          onClick={() => goToLesson(moduleData.module.id, courseType)}
                        >
                          {detailCompleted ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 mr-2" />
                              {detailStatus.completionKind === "photo"
                                ? "View Submission"
                                : localizeCourseUi("Review Lesson", locale)}
                            </>
                          ) : detailFailed ? (
                            <>
                              <RotateCcw className="w-5 h-5 mr-2" />
                              {localizeCourseUi("Retake Lesson", locale)}
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5 mr-2" />
                              {localizeCourseUi("Start Lesson", locale)}
                            </>
                          )}
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>

                        {(moduleData.module.has_quiz ||
                          moduleData.module.has_homework) && (
                          <div className="flex gap-3">
                            {moduleData.module.has_quiz && (
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1",
                                  detailCompleted &&
                                    "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10",
                                  detailFailed &&
                                    (detailZero
                                      ? "border-destructive/50 text-destructive hover:bg-destructive/10"
                                      : "border-warning/50 text-warning hover:bg-warning/10"),
                                  !detailCompleted && !detailFailed && "border-primary/50 text-primary hover:bg-primary/10",
                                )}
                                onClick={() =>
                                  goToLesson(moduleData.module.id, courseType, "quiz")
                                }
                              >
                                <DetailQuizIcon
                                  className={cn(
                                    "w-4 h-4 mr-2",
                                    detailCompleted && "text-emerald-400",
                                    detailFailed &&
                                      (detailZero
                                        ? "text-destructive"
                                        : "text-warning"),
                                    !detailCompleted && !detailFailed && "text-primary",
                                  )}
                                />
                                {detailCompleted
                                  ? localizeCourseUi("Review Quiz", locale)
                                  : detailFailed
                                    ? localizeCourseUi("Retake quiz", locale)
                                    : localizeCourseUi("Take Quiz", locale)}
                              </Button>
                            )}

                      {moduleData.module.has_homework && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() =>
                            goToLesson(
                              moduleData.module.id,
                              courseType,
                              "homework",
                            )
                          }
                        >
                          <ClipboardList className="w-4 h-4 mr-2 text-green-400" />
                          {localizeCourseUi("Homework", locale)}
                        </Button>
                      )}
                    </div>
                  )}
                      </>
                    );
                  })()}
                </div>

              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 max-w-sm text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {localizeCourseUi("Select a Module", locale)}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {localizeCourseUi(
                    "Choose a module from the left panel to view its content",
                    locale,
                  )}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <Level1CertModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        openEditForm={needsDirectoryListing}
      />
      {courseType === "business" && showBusinessWelcome && (
        <BusinessMasteryWelcome onContinue={dismissBusinessWelcome} />
      )}
    </DashboardLayout>
  );
}
