import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCourses } from "@/hooks/useCourses";
import { useModuleFiles } from "@/hooks/useModuleFiles";
import {
  useQuizQuestions,
  useQuizAttempts,
  useSubmitQuiz,
} from "@/hooks/useQuiz";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useHomeworkSubmission,
  useSubmitHomework,
  useDeleteHomeworkFile,
} from "@/hooks/useHomework";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  CheckCircle2,
  HelpCircle,
  ClipboardList,
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Trophy,
  RotateCcw,
  StickyNote,
  Copy,
  Check,
  Download,
  Video,
  Maximize2,
  Play,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getVimeoEmbedUrl } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  localizeCourseTitle,
  localizeCourseUi,
  localizeHairSystemLessonTitle,
  resolveVideoEmbedUrlForModule,
  resolveVideoUrlForModule,
} from "@/lib/i18n/spanishVideos";
import { PhotoUploadSection } from "@/components/lesson/PhotoUploadSection";
import { DirectoryEnrollmentLesson } from "@/components/lesson/DirectoryEnrollmentLesson";
import {
  FIRST_POST_MODULE_ID,
  FOURTH_POST_FALLBACK_COPY,
  FOURTH_POST_LESSON,
  FOURTH_POST_RESOURCE_FILES,
  FOURTH_POST_SUBLESSON_ID,
  SECOND_POST_SUBLESSON_ID,
  THIRD_POST_FALLBACK_COPY,
  THIRD_POST_LESSON,
  THIRD_POST_SUBLESSON_ID,
  THIRD_POST_VIDEO_FILE,
} from "@/data/postLessons";

// Memoized video player – survives parent re-renders
const VideoPlayer = React.memo(
  ({
    src,
    title,
    posterSrc,
  }: {
    src: string;
    title: string;
    posterSrc?: string;
  }) => {
    const [hasStarted, setHasStarted] = useState(!posterSrc);
    const isDirectVideo = /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(src);
    const playableSrc =
      posterSrc && !isDirectVideo
        ? src.replace("autoplay=0", "autoplay=1")
        : src;

    useEffect(() => {
      setHasStarted(!posterSrc);
    }, [src, posterSrc]);

    return (
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="aspect-video max-h-[50vh] bg-black relative">
          {isDirectVideo ? (
            <video
              src={src}
              poster={posterSrc}
              className="absolute inset-0 h-full w-full"
              controls
              playsInline
              preload="metadata"
              title={title}
            />
          ) : posterSrc && !hasStarted ? (
            <button
              type="button"
              onClick={() => setHasStarted(true)}
              className="absolute inset-0 group"
              aria-label={`Play ${title}`}
            >
              <img
                src={posterSrc}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/0" />
              <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-primary ring-2 ring-primary/70 shadow-2xl transition-transform group-hover:scale-105">
                <Play className="ml-1 h-9 w-9 fill-current" />
              </span>
            </button>
          ) : (
            <iframe
              src={playableSrc}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={title}
            />
          )}
        </div>
      </div>
    );
  },
);
VideoPlayer.displayName = "VideoPlayer";

const SOCIAL_MEDIA_101_MODULE_ID = "b1010000-0000-4000-8000-000000000101";
const SOCIAL_MEDIA_101_THUMBNAIL =
  "/lesson-assets/thumbnails/social-media-101-thumbnail.png";
const SOCIAL_MEDIA_101_INSTAGRAM_POST_URL =
  "https://www.instagram.com/barberlaunchofficial/p/DYDyUWaGsX3/";
const SOCIAL_MEDIA_101_CAROUSEL_SLIDES = Array.from(
  { length: 6 },
  (_, index) =>
    `/lesson-assets/social-media-101-carousel/slide-${index + 1}.jpg`,
);
const ARCHIVED_INSTAGRAMSWIPE_HEADING = "Swipe Through The Example Post";
const SOCIAL_MEDIA_101_BULLETS = [
  "Every post is a reminder that you cut hair, solve hair loss problems, and are available to book.",
  "Consistency matters more than making every post perfect.",
  "One post usually will not change your business. Repeated reminders are what build trust.",
  "Your followers are already a warm audience: past clients, friends, family, and people who have thought about booking.",
  "More posts give you more chances to show up when someone is finally ready for a haircut or hair system consultation.",
  "The platform needs proof that you are active before it has a reason to keep testing and pushing your content.",
];
const SOCIAL_MEDIA_101_LESSON_SECTIONS = [
  {
    title: "Think of social media as free advertising",
    body: "When you post, you are putting your business in front of people who already know you or could become clients. Even a simple post with 100 views means 100 people were reminded that you cut hair, offer hair systems, and can help them.",
  },
  {
    title: "The goal is repeated reminders",
    body: "Most people do not book the first time they see a post. They book after they have seen you enough times to remember you, trust your work, and catch your post at the right moment.",
  },
  {
    title: "Volume beats waiting for perfect",
    body: "A clean before-and-after, a finished haircut, a hair system result, a quick client reaction, or a simple educational post is enough to start. Build the habit first. Better captions, hashtags, and editing can improve later.",
  },
  {
    title: "Show the person behind the business",
    body: "People do not only want polished ads. They want to see your work, your process, your face, and the real results you create. You do not need to become an influencer, but you do need to show up.",
  },
];
const SocialMedia101SwipeExample = () => {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const goToSlide = (index: number) => {
    const lastIndex = SOCIAL_MEDIA_101_CAROUSEL_SLIDES.length - 1;
    setCurrent(Math.min(Math.max(index, 0), lastIndex));
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const deltaX = touchStartX.current - event.changedTouches[0].clientX;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 45) return;
    goToSlide(current + (deltaX > 0 ? 1 : -1));
  };

  return (
    <div className="glass-card rounded-2xl p-4 md:p-6 animate-fade-up">
      {/* Archived Instagramswipe heading: {ARCHIVED_INSTAGRAMSWIPE_HEADING} */}
      {/* Archived Instagram source URL: {SOCIAL_MEDIA_101_INSTAGRAM_POST_URL} */}

      <div className="mx-auto max-w-[560px]">
        <div
          className="relative"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0].clientX;
          }}
          onTouchEnd={handleTouchEnd}
        >
          <div className="overflow-hidden rounded-xl border border-border/40 bg-black shadow-xl">
            <img
              src={SOCIAL_MEDIA_101_CAROUSEL_SLIDES[current]}
              alt=""
              className="aspect-square h-full w-full object-contain"
              draggable={false}
            />
          </div>

          <button
            type="button"
            onClick={() => goToSlide(current - 1)}
            disabled={current === 0}
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-primary/50 bg-black/70 text-primary shadow-lg transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Previous slide"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToSlide(current + 1)}
            disabled={current === SOCIAL_MEDIA_101_CAROUSEL_SLIDES.length - 1}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-primary/50 bg-black/70 text-primary shadow-lg transition-colors hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Next slide"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          {SOCIAL_MEDIA_101_CAROUSEL_SLIDES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
              className={`h-2.5 rounded-full transition-all ${
                index === current
                  ? "w-8 bg-primary"
                  : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SocialMedia101ReadAlong = () => {
  return (
    <div className="glass-card rounded-2xl p-4 md:p-6 animate-fade-up">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Read This After The Video
        </p>
        <h2 className="font-display text-2xl font-bold">
          Social Media 101 Lesson
        </h2>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-foreground/90">
          The main point of this lesson is simple: social media works when
          people see you often enough to remember you, trust your work, and
          know what to do next when they are ready to book.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {SOCIAL_MEDIA_101_LESSON_SECTIONS.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-border/40 bg-secondary/20 p-5"
          >
            <h3 className="mb-3 text-xl font-semibold">{section.title}</h3>
            <p className="text-lg leading-relaxed text-foreground/90">
              {section.body}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-border/40 bg-secondary/20 p-5">
        <div className="mb-4 flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-semibold">What To Remember</h3>
        </div>
        <ul className="space-y-3.5">
          {SOCIAL_MEDIA_101_BULLETS.map((item) => (
            <li key={item} className="flex gap-3 text-lg leading-relaxed">
              <CheckCircle2 className="mt-1.5 h-5 w-5 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const SECOND_POST_RESOURCE_FILE = {
  id: "second-post-hair-system-content-image",
  module_id: "hair-system-content",
  file_name: "second-post-hair-system-transformation.png",
  file_url: "/lesson-assets/second-post-hair-system-transformation.png",
  file_type: "png",
  order_index: 0,
  created_at: "",
};

type ResourcePreviewFile = {
  id?: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
};

// Copyable text component
const CopyableText = ({
  text,
  downloadFileName,
  allowDownload,
}: {
  text: string;
  downloadFileName?: string;
  allowDownload?: boolean;
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const renderTextWithPlaceholders = (value: string) => {
    const placeholderPattern = /(\[[^\]]+\])/g;
    return value.split(placeholderPattern).map((part, index) => {
      const isPlaceholder = placeholderPattern.test(part);
      placeholderPattern.lastIndex = 0;
      return isPlaceholder ? (
        <mark
          key={index}
          className="rounded bg-yellow-300/25 px-1 text-foreground ring-1 ring-yellow-300/45"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={index}>{part}</React.Fragment>
      );
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = downloadFileName || "lesson-content.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success("Downloaded lesson content");
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="px-4 py-3 bg-secondary/50 border border-border/50 rounded space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5" /> Copied</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copy Caption</>
          )}
        </button>
        {allowDownload ? (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Download as .txt"
          >
            {downloading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving</>
            ) : (
              <><Download className="w-3.5 h-3.5" /> Download</>
            )}
          </button>
        ) : null}
      </div>
      <div className="whitespace-pre-line text-base leading-relaxed">
        {renderTextWithPlaceholders(text)}
      </div>
    </div>
  );
};

const SECOND_POST_FALLBACK_COPY = [
  "This is one of the biggest reasons I wanted to start doing hair systems.",
  "",
  "A lot of guys are tired of hiding thinning hair with hats, Toppik, fibers, or styling their hair a special way just to cover it up.",
  "",
  "Hair systems are an incredible solution because you can look your best and still live your life.",
  "",
  "Swim in them.",
  "",
  "Shower in them.",
  "",
  "Work out in them.",
  "",
  "Go out and feel normal again.",
  "",
  "If you’re in the area, or know someone struggling with hair loss, DM me “HAIR” and I’ll walk you through how it works.",
  "",
  "#HairSystem #HairReplacement #HairLossSolution #NonSurgicalHairReplacement #MensHair #BarberLife",
].join("\n");

// Helper function to render markdown-style notes content
const renderNotesContent = (content: string, copyDownloadFileName?: string) => {
  // Pre-process: Extract all {copy:...} blocks (including multi-line) and replace with placeholders
  const copyBlocks = new Map<string, string>();
  let blockIndex = 0;
  const processedContent = content.replace(
    /\{copy:([\s\S]*?)\}/g,
    (match, text) => {
      const placeholder = `__COPY_BLOCK_${blockIndex}__`;
      copyBlocks.set(placeholder, text);
      blockIndex++;
      return placeholder;
    },
  );

  const renderInlineElements = (text: string, keyPrefix: string = "") => {
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

      if (match[0].startsWith("__COPY_BLOCK_")) {
        // It's a copy block placeholder
        const copyText = copyBlocks.get(match[0]);
        if (copyText) {
          parts.push(
            <CopyableText
              key={`${keyPrefix}-copy-${match.index}`}
              text={copyText}
              allowDownload={!!copyDownloadFileName}
              downloadFileName={copyDownloadFileName}
            />,
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
          </a>,
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
        <h4
          key={index}
          className="font-bold text-lg text-foreground mt-5 first:mt-0 mb-3"
        >
          {title}
        </h4>,
      );
    }
    // Checklist: - [ ] or - [x]
    else if (line.match(/^- \[([ x])\] /)) {
      const isChecked = line.includes("[x]");
      const text = line.replace(/^- \[[ x]\] /, "");
      elements.push(
        <div
          key={index}
          className="flex items-start gap-2 text-muted-foreground ml-2"
        >
          <span className="mt-0.5">{isChecked ? "☑" : "☐"}</span>
          <span>{renderInlineElements(text, `line-${index}`)}</span>
        </div>,
      );
    }
    // Bullet points: - text
    else if (line.match(/^- /)) {
      const text = line.replace(/^- /, "");
      elements.push(
        <div
          key={index}
          className="flex items-start gap-2 text-muted-foreground ml-2"
        >
          <span className="mt-1">•</span>
          <span>{renderInlineElements(text, `line-${index}`)}</span>
        </div>,
      );
    }
    // Empty lines
    else if (line.trim() === "") {
      elements.push(<div key={index} className="h-2" />);
    }
    // Regular text (skip placeholder-only lines as they're handled inline)
    else if (!line.match(/^__COPY_BLOCK_\d+__$/)) {
      elements.push(
        <p key={index} className="text-base text-foreground/90 leading-relaxed">
          {renderInlineElements(line, `line-${index}`)}
        </p>,
      );
    }
    // Standalone copy blocks (on their own line)
    else {
      const copyText = copyBlocks.get(line);
      if (copyText) {
        elements.push(
          <div key={index} className="my-2">
            <CopyableText
              text={copyText}
              allowDownload={!!copyDownloadFileName}
              downloadFileName={copyDownloadFileName}
            />
          </div>,
        );
      }
    }
  });

  return elements;
};

const YELP_MODULE_ID = "ae190000-0000-4000-8000-000000000001";

export default function Lesson() {
  const navigate = useNavigate();
  const { lessonId, courseType } = useParams();
  const [searchParams] = useSearchParams();
  const { data: courses = [], isLoading } = useCourses();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (lessonId === YELP_MODULE_ID) {
      navigate("/courses/business/lesson/setting-up-your-yelp", {
        replace: true,
      });
    }
  }, [lessonId, navigate]);

  const initialTab = searchParams.get("tab") as
    | "video"
    | "quiz"
    | "homework"
    | null;
  const [activeTab, setActiveTab] = useState<"video" | "quiz" | "homework">(
    initialTab || "video",
  );
  const sublessonId = searchParams.get("sublesson");
  const [previewFile, setPreviewFile] = useState<ResourcePreviewFile | null>(
    null,
  );

  // Update tab when URL changes
  useEffect(() => {
    const tab = searchParams.get("tab") as "video" | "quiz" | "homework" | null;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Fetch sublesson when in URL — drives title/video/description/quiz flags so each sublesson is distinct
  const { data: sublesson } = useQuery({
    queryKey: ["sublesson", sublessonId],
    queryFn: async () => {
      if (!sublessonId) return null;
      if (sublessonId === THIRD_POST_SUBLESSON_ID) return THIRD_POST_LESSON;
      if (sublessonId === FOURTH_POST_SUBLESSON_ID) return FOURTH_POST_LESSON;
      const { data } = await supabase
        .from("lessons")
        .select(
          "id, title, description, video_url, duration, type, has_quiz, has_homework",
        )
        .eq("id", sublessonId)
        .maybeSingle();
      return data;
    },
    enabled: !!sublessonId,
  });

  // Find the module and get all modules for navigation
  const allModules = courses.flatMap((c) =>
    (c.modules || []).map((m) => ({
      ...m,
      courseName: c.title,
      courseId: c.id,
      courseCategory: c.category,
    })),
  );
  const currentModuleIndex = allModules.findIndex((m) => m.id === lessonId);
  const module = allModules[currentModuleIndex];
  const nextModule =
    currentModuleIndex >= 0 && currentModuleIndex < allModules.length - 1
      ? allModules[currentModuleIndex + 1]
      : null;

  const quizScope = sublessonId ? { lessonId: sublessonId } : module?.id;

  // Hooks for the active lesson surface. Sub-lessons should not inherit parent files/quizzes/homework.
  const { data: files = [] } = useModuleFiles(module?.id);
  const { data: questions = [] } = useQuizQuestions(quizScope);
  const { data: attempts = [] } = useQuizAttempts(quizScope);
  const { data: existingSubmission } = useHomeworkSubmission(
    sublessonId ? undefined : module?.id,
  );
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if module's lessons are already completed
  const { data: lessonCompletionData } = useQuery({
    queryKey: ["lesson-completion", module?.id, user?.id],
    queryFn: async () => {
      if (!module?.id || !user?.id)
        return { lessons: [], completedIds: new Set<string>() };
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id")
        .eq("module_id", module.id);
      const lessonIds = (lessons || []).map((l) => l.id);
      if (lessonIds.length === 0)
        return { lessons: lessonIds, completedIds: new Set<string>() };
      const { data: progress } = await supabase
        .from("user_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("completed", true)
        .in("lesson_id", lessonIds);
      return {
        lessons: lessonIds,
        completedIds: new Set((progress || []).map((p) => p.lesson_id)),
      };
    },
    enabled: !!module?.id && !!user?.id,
  });

  const isModuleCompleted = lessonCompletionData
    ? lessonCompletionData.lessons.length > 0 &&
      lessonCompletionData.lessons.every((id) =>
        lessonCompletionData.completedIds.has(id),
      )
    : false;

  const { data: sublessonCompletion } = useQuery({
    queryKey: ["sublesson-completion", sublessonId, user?.id],
    queryFn: async () => {
      if (!sublessonId || !user?.id) return null;
      const { data } = await supabase
        .from("user_progress")
        .select("lesson_id")
        .eq("user_id", user.id)
        .eq("lesson_id", sublessonId)
        .eq("completed", true)
        .maybeSingle();
      return data;
    },
    enabled: !!sublessonId && !!user?.id,
  });

  const isCurrentLessonCompleted = sublessonId
    ? !!sublessonCompletion
    : isModuleCompleted;

  const markModuleComplete = async () => {
    if (!user?.id) return;

    if (sublessonId) {
      await supabase.from("user_progress").upsert(
        {
          user_id: user.id,
          lesson_id: sublessonId,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,lesson_id" },
      );
      queryClient.invalidateQueries({
        queryKey: ["sublesson-completion", sublessonId, user.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["lesson-completion", module?.id, user.id],
      });
      queryClient.invalidateQueries({ queryKey: ["user-progress", user.id] });
      toast.success("Sub-lesson marked as complete!");
      return;
    }

    if (!module?.id) return;
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("module_id", module.id);
    if (!lessons || lessons.length === 0) return;
    for (const lesson of lessons) {
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
    queryClient.invalidateQueries({
      queryKey: ["lesson-completion", module.id, user.id],
    });
    queryClient.invalidateQueries({ queryKey: ["user-progress", user.id] });
    toast.success("Lesson marked as complete!");
  };

  // Resolve the source URL based on active locale (Spanish overrides fall back to English).
  const { locale } = useLocale();
  const localizedVideoUrl = useMemo(
    () => resolveVideoUrlForModule(module, locale),
    [module, locale],
  );

  // Memoize the embed URL so the iframe src stays stable across re-renders
  const vimeoEmbedUrl = useMemo(
    () =>
      sublesson?.video_url
        ? getVimeoEmbedUrl(sublesson.video_url)
        : resolveVideoEmbedUrlForModule(module, locale, getVimeoEmbedUrl),
    [module, locale, sublesson],
  );

  // Auto-complete video lessons based on time on page
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const elapsedSeconds = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCompletedRef = useRef(false);

  // Fetch video duration from Vimeo oEmbed API
  useEffect(() => {
    if (!localizedVideoUrl || !localizedVideoUrl.includes("vimeo")) return;
    const rawUrl = localizedVideoUrl.replace(
      /player\.vimeo\.com\/video\//,
      "vimeo.com/",
    );
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.duration) setVideoDuration(data.duration);
      })
      .catch(() => {
        /* fallback to manual button */
      });
  }, [localizedVideoUrl]);

  // Time-on-page tracker for auto-completion
  useEffect(() => {
    if (!videoDuration || isCurrentLessonCompleted || !user?.id || !module?.id)
      return;
    autoCompletedRef.current = false;
    elapsedSeconds.current = 0;

    const threshold = Math.max(60, videoDuration);

    timerRef.current = setInterval(() => {
      elapsedSeconds.current += 1;
      if (elapsedSeconds.current >= threshold && !autoCompletedRef.current) {
        autoCompletedRef.current = true;
        if (timerRef.current) clearInterval(timerRef.current);
        markModuleComplete();
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    videoDuration,
    isCurrentLessonCompleted,
    user?.id,
    module?.id,
    sublessonId,
  ]);

  const submitQuiz = useSubmitQuiz();
  const submitHomework = useSubmitHomework();
  const deleteHomeworkFile = useDeleteHomeworkFile();

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [quizScore, setQuizScore] = useState<{
    score: number;
    total: number;
  } | null>(null);
  const [correctAnswersMap, setCorrectAnswersMap] = useState<
    Record<string, string>
  >({});
  const [incorrectQuestions, setIncorrectQuestions] = useState<Set<string>>(
    new Set(),
  );

  // Homework state
  const [textResponse, setTextResponse] = useState(
    existingSubmission?.text_response || "",
  );
  const [checklistCompleted, setChecklistCompleted] = useState(
    existingSubmission?.checklist_completed || false,
  );
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
          <h1 className="font-display text-2xl font-bold mb-4">
            Module not found
          </h1>
          <Button
            onClick={() => navigate(`/courses/${courseType || "hair-system"}`)}
          >
            Back to Courses
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleQuizSubmit = async () => {
    if (Object.keys(quizAnswers).length < questions.length) {
      toast.error("Please answer all questions");
      return;
    }

    const answers = Object.entries(quizAnswers).map(
      ([questionId, selectedAnswerId]) => ({
        questionId,
        selectedAnswerId,
      }),
    );

    const result = await submitQuiz.mutateAsync({
      moduleId: sublessonId ? undefined : module.id,
      lessonId: sublessonId || undefined,
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
    // Invalidate completion query since edge function auto-completed lessons
    queryClient.invalidateQueries({
      queryKey: ["lesson-completion", module.id, user?.id],
    });
    queryClient.invalidateQueries({
      queryKey: ["sublesson-completion", sublessonId, user?.id],
    });
    queryClient.invalidateQueries({ queryKey: ["user-progress", user?.id] });
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
    // Auto-mark lesson as complete on homework submit
    await markModuleComplete();
    toast.success("Homework submitted successfully!");
  };

  const handleDeleteFile = async (fileId: string, fileUrl: string) => {
    await deleteHomeworkFile.mutateAsync({
      fileId,
      moduleId: module.id,
      fileUrl,
    });
    toast.success("File deleted");
  };

  const bestAttempt =
    attempts.length > 0
      ? attempts.reduce((best, current) =>
          current.score / current.total_questions >
          best.score / best.total_questions
            ? current
            : best,
        )
      : null;

  const localizedCourseName = localizeCourseTitle(module.courseName, locale);
  const localizedModuleTitle =
    sublesson?.title || localizeHairSystemLessonTitle(module, locale);
  const isSecondPostSubLesson = sublesson?.id === SECOND_POST_SUBLESSON_ID;
  const isThirdPostSubLesson = sublesson?.id === THIRD_POST_SUBLESSON_ID;
  const isFourthPostSubLesson = sublesson?.id === FOURTH_POST_SUBLESSON_ID;
  const fallbackPostDescription = isSecondPostSubLesson
    ? SECOND_POST_FALLBACK_COPY
    : isThirdPostSubLesson
      ? THIRD_POST_FALLBACK_COPY
      : isFourthPostSubLesson
        ? FOURTH_POST_FALLBACK_COPY
        : "";
  const displayDescription = sublesson
    ? sublesson.description || fallbackPostDescription
    : module.description;
  const displayVideoUrl = sublesson
    ? sublesson.video_url || ""
    : module.video_url;
  const isSocialMedia101Lesson =
    !sublessonId && module.id === SOCIAL_MEDIA_101_MODULE_ID;
  const videoPosterSrc =
    isSocialMedia101Lesson ? SOCIAL_MEDIA_101_THUMBNAIL : undefined;
  const isSubLessonInFirstPostModule =
    !!sublessonId && module.id === FIRST_POST_MODULE_ID;
  const activeHasDownload =
    isSecondPostSubLesson ||
    isThirdPostSubLesson ||
    isFourthPostSubLesson ||
    ((!sublessonId || isSubLessonInFirstPostModule) && module.has_download);
  const activeHasQuiz = sublessonId ? !!sublesson?.has_quiz : module.has_quiz;
  const activeHasHomework = sublessonId ? false : module.has_homework;
  const notesContent = sublessonId ? null : module.notes_content;
  const firstPostCopyDownloadFileName =
    module.id === FIRST_POST_MODULE_ID ? "first-post.txt" : undefined;
  const activeFiles = isThirdPostSubLesson
    ? [THIRD_POST_VIDEO_FILE]
    : isSecondPostSubLesson
      ? [SECOND_POST_RESOURCE_FILE]
      : isFourthPostSubLesson
        ? FOURTH_POST_RESOURCE_FILES
        : files;
  const previewFileType = previewFile?.file_type?.toLowerCase() || "";
  const previewIsImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
    previewFileType,
  );
  const previewIsVideo = ["mp4", "mov", "avi", "webm", "mkv"].includes(
    previewFileType,
  );

  return (
    <DashboardLayout>
      <Dialog
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      >
        <DialogContent className="w-[calc(100vw-24px)] max-w-[560px] border-border/30 bg-black p-3 sm:rounded-xl">
          <DialogTitle className="sr-only">
            {previewFile?.file_name || "Resource preview"}
          </DialogTitle>
          {previewFile && previewIsVideo && (
            <video
              src={previewFile.file_url}
              className="max-h-[86vh] w-full rounded-lg bg-black object-contain"
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          )}
          {previewFile && previewIsImage && (
            <img
              src={previewFile.file_url}
              alt={previewFile.file_name}
              className="max-h-[86vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
      <div
        key={`${module.id}-${locale}`}
        className="max-w-5xl mx-auto space-y-4 pb-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                navigate(
                  `/courses/${courseType || (module as any).courseCategory || "hair-system"}`,
                )
              }
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <p
                key={`${module.id}-${locale}-course`}
                className="text-sm text-muted-foreground"
                data-no-translate
                translate="no"
              >
                {localizedCourseName}
              </p>
              <h1
                key={`${module.id}-${locale}-title`}
                className="font-display text-3xl font-bold"
                data-no-translate
                translate="no"
              >
                {localizedModuleTitle}
              </h1>
            </div>
          </div>
          {isCurrentLessonCompleted ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">
                {localizeCourseUi("Completed", locale)}
              </span>
            </div>
          ) : (
            <Button
              onClick={markModuleComplete}
              className="gold-gradient"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              {localizeCourseUi("Mark Complete", locale)}
            </Button>
          )}
        </div>

        {/* Video Player - only show if video exists and not a special lesson */}
        {displayVideoUrl?.trim() &&
          !(module as any).is_certification_requirement &&
          !(module as any).is_directory_enrollment && (
            <VideoPlayer
              key={`${module.id}-${sublesson?.id || "main"}-${locale}`}
              src={vimeoEmbedUrl}
              title={localizedModuleTitle}
              posterSrc={videoPosterSrc}
            />
          )}

        {/* Archived Instagramswipe section for later reuse. */}
        {isSocialMedia101Lesson && <SocialMedia101ReadAlong />}

        {/* Photo Upload Section for certification requirement modules */}
        {(module as any).is_certification_requirement && (
          <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <PhotoUploadSection courseId={module.courseId} />
          </div>
        )}

        {/* Directory enrollment lesson */}
        {(module as any).is_directory_enrollment && (
          <div className="animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <DirectoryEnrollmentLesson />
          </div>
        )}

        {/* Tabs - Hide on mobile since we show inline content */}
        {!isMobile && (
          <div
            className="flex flex-wrap items-center gap-2 animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            {activeHasQuiz && (
              <Button
                variant={activeTab === "quiz" ? "default" : "secondary"}
                onClick={() => setActiveTab("quiz")}
                className={`font-semibold gap-2 ${activeTab === "quiz" ? "gold-gradient" : ""}`}
              >
                <Trophy className="w-4 h-4" />
                {localizeCourseUi("Quiz", locale)}
                {bestAttempt && (
                  <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                    Best:{" "}
                    {Math.round(
                      (bestAttempt.score / bestAttempt.total_questions) * 100,
                    )}
                    %
                  </span>
                )}
              </Button>
            )}
            {activeHasHomework && (
              <Button
                variant={activeTab === "homework" ? "default" : "secondary"}
                onClick={() => setActiveTab("homework")}
                className={activeTab === "homework" ? "gold-gradient" : ""}
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {localizeCourseUi("Homework", locale)}
                {existingSubmission && (
                  <CheckCircle2 className="w-4 h-4 ml-2 text-green-400" />
                )}
              </Button>
            )}
            {nextModule && !(module as any).is_directory_enrollment && (
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`,
                  )
                }
              >
                {localizeCourseUi("Next Lesson", locale)}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Mobile: Resources section */}
        {isMobile &&
          activeHasDownload &&
          activeFiles.length > 0 &&
          (() => {
            const imageExtensions = [
              "jpg",
              "jpeg",
              "png",
              "gif",
              "webp",
              "svg",
            ];
            const videoExtensions = ["mp4", "mov", "avi", "webm", "mkv"];

            const mediaFiles = activeFiles.filter((f) => {
              if (!f.file_type) return false;
              const ext = f.file_type.toLowerCase();
              return (
                imageExtensions.includes(ext) || videoExtensions.includes(ext)
              );
            });
            const others = activeFiles.filter((f) => {
              if (!f.file_type) return true;
              const ext = f.file_type.toLowerCase();
              return (
                !imageExtensions.includes(ext) && !videoExtensions.includes(ext)
              );
            });

            const isImage = (fileType: string | null) =>
              fileType && imageExtensions.includes(fileType.toLowerCase());
            const isVideo = (fileType: string | null) =>
              fileType && videoExtensions.includes(fileType.toLowerCase());

            const triggerDownload = async (
              fileUrl: string,
              fileName: string,
            ) => {
              try {
                const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                const downloadUrl = fileUrl.startsWith("/")
                  ? fileUrl
                  : `${baseUrl}/functions/v1/download-file?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
                const response = await fetch(downloadUrl);
                if (!response.ok) throw new Error("Download failed");
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
                toast.success(`Downloaded ${fileName}`);
              } catch {
                toast.error("Download failed. Please try again.");
              }
            };

            const MobileFileCard = ({
              file,
            }: {
              file: (typeof activeFiles)[number];
            }) => {
              const [downloading, setDownloading] = useState(false);
              return (
                <div className="flex flex-col rounded-lg bg-secondary/30 border border-border/30 overflow-hidden w-full">
                  {isImage(file.file_type) ? (
                    <div className="aspect-square bg-black/20 relative">
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black/85"
                        aria-label={`Expand ${file.file_name}`}
                        title="Expand"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : isVideo(file.file_type) ? (
                    <div className="aspect-square bg-black/40 relative overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPreviewFile(file)}
                        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black/85"
                        aria-label={`Expand ${file.file_name}`}
                        title="Expand"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      <video
                        src={file.file_url}
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square bg-secondary/50 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-2 space-y-1">
                    <p
                      className="text-xs font-medium truncate"
                      title={file.file_name}
                    >
                      {file.file_name}
                    </p>
                    <button
                      onClick={async () => {
                        setDownloading(true);
                        await triggerDownload(file.file_url, file.file_name);
                        setDownloading(false);
                      }}
                      disabled={downloading}
                      className="flex items-center justify-center gap-1 text-xs text-primary hover:underline w-full"
                    >
                      {downloading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {downloading ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            };

            return (
              <div
                className="glass-card p-4 rounded-2xl space-y-3 animate-fade-up"
                style={{ animationDelay: "0.2s" }}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="font-display text-lg font-semibold">
                    Resources
                  </h2>
                </div>
                {isFourthPostSubLesson && (
                  <p className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                    Choose one of the videos below to use with this post.
                  </p>
                )}

                {mediaFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="w-4 h-4" />
                      <span>Media ({mediaFiles.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pb-2 overflow-visible">
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
                    <div className="grid grid-cols-3 gap-2 pb-2 overflow-visible">
                      {others.map((file) => (
                        <MobileFileCard key={file.id} file={file} />
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  Tap Save to download
                </p>
              </div>
            );
          })()}

        {/* Mobile: Quiz header with Next Lesson button */}
        {isMobile && activeHasQuiz && (
          <div
            className="flex items-center justify-between animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Quiz</h2>
              {bestAttempt && (
                <span className="px-2 py-0.5 bg-primary/20 rounded text-xs">
                  Best:{" "}
                  {Math.round(
                    (bestAttempt.score / bestAttempt.total_questions) * 100,
                  )}
                  %
                </span>
              )}
            </div>
            {nextModule && (
              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    `/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`,
                  )
                }
              >
                Next Lesson
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        )}

        {/* Mobile: Inline Quiz Content */}
        {isMobile && activeHasQuiz && (
          <div
            className="p-4 rounded-2xl bg-secondary/20 animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="text-center py-6">
                  <HelpCircle className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">
                    No quiz questions available yet.
                  </p>
                </div>
              ) : showResults && quizScore ? (
                showReview ? (
                  // Mobile Review Mode
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg font-semibold">
                        Quiz Review
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowReview(false)}
                      >
                        Back to Results
                      </Button>
                    </div>
                    {questions
                      .filter((q) => incorrectQuestions.has(q.id))
                      .map((question, index) => {
                        const selectedAnswerId = quizAnswers[question.id];
                        const correctAnswer = question.answers?.find(
                          (a) => a.is_correct,
                        );
                        return (
                          <div
                            key={question.id}
                            className="p-3 rounded-xl bg-destructive/10 border border-destructive/30"
                          >
                            <div className="flex items-start gap-2 mb-3">
                              <span className="w-6 h-6 rounded-full bg-destructive flex items-center justify-center text-xs font-bold text-destructive-foreground flex-shrink-0">
                                ✗
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-sm">
                                  {question.question_text}
                                </p>
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
                                const isSelected =
                                  answer.id === selectedAnswerId;
                                const isCorrect = answer.is_correct;
                                return (
                                  <div
                                    key={answer.id}
                                    className={`flex items-center space-x-2 p-2 rounded-lg text-sm ${
                                      isCorrect
                                        ? "bg-green-500/20 border border-green-500/50"
                                        : isSelected
                                          ? "bg-destructive/20 border border-destructive/50 line-through opacity-70"
                                          : "opacity-50"
                                    }`}
                                  >
                                    <span>
                                      {isCorrect ? "✓" : isSelected ? "✗" : "○"}
                                    </span>
                                    <span>{answer.answer_text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    <Button
                      onClick={resetQuiz}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
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
                      {Math.round((quizScore.score / quizScore.total) * 100)}%
                      Correct
                    </p>
                    <Progress
                      value={(quizScore.score / quizScore.total) * 100}
                      className="w-48 mx-auto mb-4"
                    />
                    <div className="flex flex-col gap-2">
                      {incorrectQuestions.size > 0 && (
                        <Button
                          onClick={() => setShowReview(true)}
                          variant="secondary"
                          size="sm"
                        >
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
                    <div
                      key={question.id}
                      className="p-3 rounded-xl bg-secondary/20"
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <span className="w-6 h-6 rounded-full gold-gradient flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {question.question_text}
                          </p>
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
                        value={quizAnswers[question.id] || ""}
                        onValueChange={(value) =>
                          setQuizAnswers((prev) => ({
                            ...prev,
                            [question.id]: value,
                          }))
                        }
                        className="space-y-2 ml-8"
                      >
                        {question.answers?.map((answer) => (
                          <label
                            key={answer.id}
                            htmlFor={`mobile-${answer.id}`}
                            className="flex items-center space-x-2 p-2 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                          >
                            <RadioGroupItem
                              value={answer.id}
                              id={`mobile-${answer.id}`}
                            />
                            <span className="flex-1 text-sm">
                              {answer.answer_text}
                            </span>
                          </label>
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
        {notesContent && (
          <div
            className="glass-card p-4 md:p-6 rounded-2xl animate-fade-up"
            style={{ animationDelay: "0.4s" }}
          >
            {!notesContent.trim().startsWith("**") && (
              <div className="flex items-center gap-2 mb-4">
                <StickyNote className="w-5 h-5 text-primary" />
                <h2 className="font-display text-lg md:text-xl font-semibold">
                  Notes
                </h2>
              </div>
            )}
            <div className="prose prose-invert prose-sm max-w-none">
              {renderNotesContent(notesContent, firstPostCopyDownloadFileName)}
            </div>
          </div>
        )}

        {isMobile && nextModule && !(module as any).is_directory_enrollment && (
          <div className="animate-fade-up" style={{ animationDelay: "0.5s" }}>
            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={() =>
                navigate(
                  `/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`,
                )
              }
            >
              Next Lesson
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Desktop: Tab Content */}
        {!isMobile && (
          <div
            className="animate-fade-up"
            style={{ animationDelay: "0.3s" }}
          >
            {activeTab === "video" && (
              <div className="space-y-6">
                {displayDescription &&
                  !(module as any).is_directory_enrollment && (
                    <div>
                      <h2 className="font-display text-xl font-semibold mb-2">
                        {sublesson?.id === SECOND_POST_SUBLESSON_ID ||
                        sublesson?.id === THIRD_POST_SUBLESSON_ID ||
                        sublesson?.id === FOURTH_POST_SUBLESSON_ID
                          ? "Copy Caption Below"
                          : sublesson
                            ? "About This Lesson"
                            : "About This Module"}
                      </h2>
                      {sublesson?.id === SECOND_POST_SUBLESSON_ID ||
                      sublesson?.id === THIRD_POST_SUBLESSON_ID ||
                      sublesson?.id === FOURTH_POST_SUBLESSON_ID ? (
                        <CopyableText
                          text={displayDescription}
                          allowDownload
                          downloadFileName={
                            sublesson?.id === FOURTH_POST_SUBLESSON_ID
                              ? "fourth-post.txt"
                              : sublesson?.id === THIRD_POST_SUBLESSON_ID
                                ? "third-post.txt"
                                : "second-post.txt"
                          }
                        />
                      ) : (
                        <p className="text-muted-foreground whitespace-pre-line">
                          {displayDescription}
                        </p>
                      )}
                    </div>
                  )}

                {activeHasDownload &&
                  activeFiles.length > 0 &&
                  (() => {
                    const imageExtensions = [
                      "jpg",
                      "jpeg",
                      "png",
                      "gif",
                      "webp",
                      "svg",
                    ];
                    const videoExtensions = [
                      "mp4",
                      "mov",
                      "avi",
                      "webm",
                      "mkv",
                    ];

                    const mediaFiles = activeFiles.filter((f) => {
                      if (!f.file_type) return false;
                      const ext = f.file_type.toLowerCase();
                      return (
                        imageExtensions.includes(ext) ||
                        videoExtensions.includes(ext)
                      );
                    });
                    const others = activeFiles.filter((f) => {
                      if (!f.file_type) return true;
                      const ext = f.file_type.toLowerCase();
                      return (
                        !imageExtensions.includes(ext) &&
                        !videoExtensions.includes(ext)
                      );
                    });

                    const isImage = (fileType: string | null) =>
                      fileType &&
                      imageExtensions.includes(fileType.toLowerCase());
                    const isVideo = (fileType: string | null) =>
                      fileType &&
                      videoExtensions.includes(fileType.toLowerCase());

                    const triggerDownloadDesktop = async (
                      fileUrl: string,
                      fileName: string,
                    ) => {
                      try {
                        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
                        const downloadUrl = fileUrl.startsWith("/")
                          ? fileUrl
                          : `${baseUrl}/functions/v1/download-file?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(fileName)}`;
                        const response = await fetch(downloadUrl);
                        if (!response.ok) throw new Error("Download failed");
                        const blob = await response.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = blobUrl;
                        a.download = fileName;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                        toast.success(`Downloaded ${fileName}`);
                      } catch {
                        toast.error("Download failed. Please try again.");
                      }
                    };

                    const FileCard = ({
                      file,
                    }: {
                      file: (typeof activeFiles)[number];
                    }) => {
                      const [downloading, setDownloading] = useState(false);
                      return (
                        <div className="flex flex-col rounded-lg bg-secondary/30 border border-border/30 overflow-hidden w-full">
                          {isImage(file.file_type) ? (
                            <div className="aspect-square bg-black/20 relative">
                              <img
                                src={file.file_url}
                                alt={file.file_name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black/85"
                                aria-label={`Expand ${file.file_name}`}
                                title="Expand"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </button>
                            </div>
                          ) : isVideo(file.file_type) ? (
                            <div className="aspect-square bg-black/40 relative overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setPreviewFile(file)}
                                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition-colors hover:bg-black/85"
                                aria-label={`Expand ${file.file_name}`}
                                title="Expand"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </button>
                              <video
                                src={file.file_url}
                                className="w-full h-full object-cover"
                                controls
                                playsInline
                                preload="metadata"
                              />
                            </div>
                          ) : (
                            <div className="aspect-square bg-secondary/50 flex items-center justify-center">
                              <FileText className="w-10 h-10 text-muted-foreground" />
                            </div>
                          )}
                          <div className="p-2 space-y-2">
                            <p
                              className="text-xs font-medium truncate"
                              title={file.file_name}
                            >
                              {file.file_name}
                            </p>
                            <button
                              onClick={async () => {
                                setDownloading(true);
                                await triggerDownloadDesktop(
                                  file.file_url,
                                  file.file_name,
                                );
                                setDownloading(false);
                              }}
                              disabled={downloading}
                              className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                              {downloading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              {downloading ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">
                            Downloadable Resources
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {activeFiles.length} file
                            {activeFiles.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {isFourthPostSubLesson && (
                          <p className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                            Choose one of the videos below to use with this
                            post.
                          </p>
                        )}

                        {mediaFiles.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ImageIcon className="w-4 h-4" />
                              <span>Media ({mediaFiles.length})</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3 pb-2 overflow-visible">
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
                            <div className="grid grid-cols-3 gap-3 pb-2 overflow-visible">
                              {others.map((file) => (
                                <FileCard key={file.id} file={file} />
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground text-center">
                          Tap Save to download
                        </p>
                      </div>
                    );
                  })()}

                <div className="flex flex-col gap-3">
                  {activeHasQuiz && (
                    <Button
                      size="lg"
                      className="gold-gradient text-primary-foreground font-bold gap-2 shadow-lg"
                      onClick={() => setActiveTab("quiz")}
                    >
                      <Trophy className="w-5 h-5" />
                      Start Quiz
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      nextModule &&
                      navigate(
                        `/courses/${nextModule.courseCategory}/lesson/${nextModule.id}`,
                      )
                    }
                    disabled={!nextModule}
                  >
                    Next Lesson
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {activeTab === "quiz" && activeHasQuiz && (
              <div className="space-y-6">
                {questions.length === 0 ? (
                  <div className="text-center py-8">
                    <HelpCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      No quiz questions available yet.
                    </p>
                  </div>
                ) : showResults && quizScore ? (
                  showReview ? (
                    // Desktop Review Mode
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h2 className="font-display text-xl font-semibold">
                          Quiz Review - Wrong Answers
                        </h2>
                        <Button
                          variant="outline"
                          onClick={() => setShowReview(false)}
                        >
                          Back to Results
                        </Button>
                      </div>
                      {questions
                        .filter((q) => incorrectQuestions.has(q.id))
                        .map((question, index) => {
                          const selectedAnswerId = quizAnswers[question.id];
                          const correctAnswerId =
                            correctAnswersMap[question.id];
                          return (
                            <div
                              key={question.id}
                              className="p-4 rounded-xl bg-destructive/10 border border-destructive/30"
                            >
                              <div className="flex items-start gap-3 mb-4">
                                <span className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-sm font-bold text-destructive-foreground flex-shrink-0">
                                  ✗
                                </span>
                                <div className="flex-1">
                                  <p className="font-medium">
                                    {question.question_text}
                                  </p>
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
                                  const isSelected =
                                    answer.id === selectedAnswerId;
                                  const isCorrect =
                                    answer.id === correctAnswerId;
                                  return (
                                    <div
                                      key={answer.id}
                                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                                        isCorrect
                                          ? "bg-green-500/20 border border-green-500/50"
                                          : isSelected
                                            ? "bg-destructive/20 border border-destructive/50 line-through opacity-70"
                                            : "opacity-50"
                                      }`}
                                    >
                                      <span className="text-lg">
                                        {isCorrect
                                          ? "✓"
                                          : isSelected
                                            ? "✗"
                                            : "○"}
                                      </span>
                                      <span>{answer.answer_text}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      <Button
                        onClick={resetQuiz}
                        variant="outline"
                        className="w-full"
                      >
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
                        {Math.round((quizScore.score / quizScore.total) * 100)}%
                        Correct
                      </p>
                      <Progress
                        value={(quizScore.score / quizScore.total) * 100}
                        className="w-64 mx-auto mb-6"
                      />
                      <div className="flex flex-col items-center gap-3">
                        {incorrectQuestions.size > 0 && (
                          <Button
                            onClick={() => setShowReview(true)}
                            variant="secondary"
                          >
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
                    <h2 className="font-display text-xl font-semibold">
                      Module Quiz
                    </h2>
                    <div className="space-y-6">
                      {questions.map((question, index) => (
                        <div
                          key={question.id}
                          className="p-4 rounded-xl bg-secondary/20"
                        >
                          <div className="flex items-start gap-3 mb-4">
                            <span className="w-8 h-8 rounded-full gold-gradient flex items-center justify-center text-sm font-bold text-primary-foreground flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium">
                                {question.question_text}
                              </p>
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
                            value={quizAnswers[question.id] || ""}
                            onValueChange={(value) =>
                              setQuizAnswers((prev) => ({
                                ...prev,
                                [question.id]: value,
                              }))
                            }
                            className="space-y-2 ml-11"
                          >
                            {question.answers?.map((answer) => (
                              <label
                                key={answer.id}
                                htmlFor={answer.id}
                                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer"
                              >
                                <RadioGroupItem
                                  value={answer.id}
                                  id={answer.id}
                                />
                                <span className="flex-1">
                                  {answer.answer_text}
                                </span>
                              </label>
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

            {activeTab === "homework" && activeHasHomework && (
              <div className="space-y-6">
                <h2 className="font-display text-xl font-semibold">
                  Homework Assignment
                </h2>

                <div className="bg-secondary/30 p-4 rounded-lg space-y-4">
                  <p className="text-muted-foreground">
                    Complete the following tasks for this module's homework
                    assignment.
                  </p>
                </div>

                {/* Text Response */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Written Response
                  </Label>
                  <Textarea
                    value={textResponse}
                    onChange={(e) => setTextResponse(e.target.value)}
                    placeholder="Share your thoughts, reflections, or answers..."
                    className="min-h-32 bg-secondary/30"
                  />
                </div>

                {/* File Upload */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Upload Photos/Videos
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) =>
                        setSelectedFiles(Array.from(e.target.files || []))
                      }
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
                  {existingSubmission?.files &&
                    existingSubmission.files.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Previously uploaded:
                        </p>
                        {existingSubmission.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 p-2 rounded bg-secondary/20"
                          >
                            {file.file_type?.startsWith("image") ? (
                              <ImageIcon className="w-4 h-4 text-primary" />
                            ) : (
                              <FileText className="w-4 h-4 text-primary" />
                            )}
                            <span className="flex-1 text-sm truncate">
                              {file.file_name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive"
                              onClick={() =>
                                handleDeleteFile(file.id, file.file_url)
                              }
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
                    onCheckedChange={(checked) =>
                      setChecklistCompleted(checked as boolean)
                    }
                    className="w-6 h-6"
                  />
                  <span className="font-medium">
                    I have completed all homework tasks for this module
                  </span>
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
                  {existingSubmission ? "Update Submission" : "Submit Homework"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
