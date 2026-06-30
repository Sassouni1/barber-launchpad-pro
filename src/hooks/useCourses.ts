import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import { toast } from "sonner";
import {
  FIRST_POST_MODULE_ID,
  FOURTH_POST_LESSON,
  THIRD_POST_LESSON,
} from "@/data/postLessons";

const MARKETING_FOUNDATIONS_COURSE_ID = "b431323d-f61e-4447-baaa-a70467cac4ac";
const WHAT_IS_A_LEAD_MODULE_ID = "a15b0533-2ec1-429f-8a57-fde4cbd32d98";
const PRINTING_POSTER_MODULE_ID = "01ae1c1b-ff79-48a0-b809-1d2c63b01f48";
const GOOGLE_PROFILE_MODULE_ID = "0647eba3-0765-4998-80ba-7ae3a71e579d";
const YELP_MODULE_ID = "ae190000-0000-4000-8000-000000000001";
const SETTING_UP_SOCIAL_MEDIA_PT1_MODULE_ID =
  "2d31d834-e497-4559-8d6b-cb139e95e368";
const SOCIAL_MEDIA_101_MODULE_ID = "b1010000-0000-4000-8000-000000000101";
const SOCIAL_MEDIA_101_VIDEO_URL =
  "https://vimeo.com/1203262619/ceb7bc6d26?share=copy&fl=sv&fe=ci";
const SETTING_UP_INSTAGRAM_MODULE_ID = "b1030000-0000-4000-8000-000000000103";
const SETTING_UP_INSTAGRAM_VIDEO_URL =
  "https://vimeo.com/1203259010/b8028d19bb?fl=ip&fe=ec";
const CONSUMER_FINANCING_MODULE_ID = "b1040000-0000-4000-8000-000000000104";
const CONSUMER_FINANCING_VIDEO_URL =
  "/lesson-assets/consumer-financing-stripe-privacy-v8.mp4";
const GO_HIGH_LEVEL_MODULE_ID = "c1100000-0000-4000-8000-000000000001";
const BEFORE_PHOTOS_MODULE_ID = "b1020000-0000-4000-8000-000000000102";

export type Course = Tables<"courses">;
export type Module = Tables<"modules">;
export type Lesson = Tables<"lessons">;

export type ModuleWithLessons = Module & {
  lessons: Lesson[];
};

export type CourseWithModules = Course & {
  modules: ModuleWithLessons[];
};

const SOCIAL_MEDIA_101_MODULE: ModuleWithLessons = {
  id: SOCIAL_MEDIA_101_MODULE_ID,
  course_id: MARKETING_FOUNDATIONS_COURSE_ID,
  title: "Social Media 101",
  description: "",
  video_url: SOCIAL_MEDIA_101_VIDEO_URL,
  duration: "",
  has_download: false,
  has_homework: false,
  has_quiz: true,
  is_certification_requirement: false,
  is_directory_enrollment: false,
  is_published: true,
  notes_content: null,
  order_index: 15,
  created_at: "",
  updated_at: "",
  lessons: [],
};

const INSTAGRAM_BIO_COPY = `**Instagram Bio**

Copy the Instagram bio below and change the highlighted parts before pasting it into your profile.

Option 1

{copy:💈 Hair Replacement Expert
📍 [Your City]
👇 Schedule Your Free Consultation 👇
🔗 [Your link to booking calendar, website, or hair system page]}

Option 2

{copy:💈 Hair Replacement Expert
📍 [Your City]
👇 Book Your Next Cut Or Hair System Consultation Below👇
🔗 [Your link to booking calendar, website, or hair system page]}`;

const SETTING_UP_INSTAGRAM_MODULE: ModuleWithLessons = {
  id: SETTING_UP_INSTAGRAM_MODULE_ID,
  course_id: MARKETING_FOUNDATIONS_COURSE_ID,
  title: "Setting Up Your Instagram",
  description: "",
  video_url: SETTING_UP_INSTAGRAM_VIDEO_URL,
  duration: "",
  has_download: false,
  has_homework: false,
  has_quiz: false,
  is_certification_requirement: false,
  is_directory_enrollment: false,
  is_published: true,
  notes_content: INSTAGRAM_BIO_COPY,
  order_index: 16,
  created_at: "",
  updated_at: "",
  lessons: [],
};

const CONSUMER_FINANCING_MODULE: ModuleWithLessons = {
  id: CONSUMER_FINANCING_MODULE_ID,
  course_id: MARKETING_FOUNDATIONS_COURSE_ID,
  title: "Consumer Financing",
  description: "",
  video_url: CONSUMER_FINANCING_VIDEO_URL,
  duration: "",
  has_download: false,
  has_homework: false,
  has_quiz: false,
  is_certification_requirement: false,
  is_directory_enrollment: false,
  is_published: true,
  notes_content: null,
  order_index: 17,
  created_at: "",
  updated_at: "",
  lessons: [],
};

const BEFORE_PHOTOS_NOTES = `**Finding Your Before Photos**

Use this as the example set for the photos you need before making hair loss content.

{copy:Grey beanie / dress shirt:
/Users/chrissassouni/Downloads/IMG_6906.jpg

Black bar over eyes:
/Users/chrissassouni/Downloads/New Project.png

Bald:
/Users/chrissassouni/Desktop/Screenshots/Screenshot 2026-05-13 at 12.08.38 AM.png

Balding:
/Users/chrissassouni/Downloads/IMG_6903.jpg

Side-profile balding:
/Users/chrissassouni/Desktop/Screenshots/Screenshot 2026-05-13 at 12.08.52 AM.png

Buzzed top-down:
/Users/chrissassouni/Desktop/Screenshots/Screenshot 2026-05-13 at 12.08.46 AM.png

CapCut project:
/Users/chrissassouni/Movies/CapCut/User Data/Projects/com.lveditor.draft/0513}`;

const BEFORE_PHOTOS_MODULE: ModuleWithLessons = {
  id: BEFORE_PHOTOS_MODULE_ID,
  course_id: MARKETING_FOUNDATIONS_COURSE_ID,
  title: "Finding Your Before Photos",
  description:
    "Find the grey beanie, bald, balding, and black-bar photos to use for hair system content.",
  video_url: null,
  duration: "",
  has_download: false,
  has_homework: false,
  has_quiz: false,
  is_certification_requirement: false,
  is_directory_enrollment: false,
  is_published: true,
  notes_content: BEFORE_PHOTOS_NOTES,
  order_index: 16,
  created_at: "",
  updated_at: "",
  lessons: [],
};

const withMarketingDisplayTitle = (
  module: ModuleWithLessons,
): ModuleWithLessons =>
  module.id === FIRST_POST_MODULE_ID
    ? {
        ...module,
        title: "Announcement Post",
      }
    : module;

const positionMarketingFoundationsModules = (
  courseId: string,
  modules: ModuleWithLessons[],
) => {
  if (courseId !== MARKETING_FOUNDATIONS_COURSE_ID) return modules;

  const archivedModuleIds = new Set([
    SETTING_UP_SOCIAL_MEDIA_PT1_MODULE_ID,
    SETTING_UP_INSTAGRAM_MODULE_ID,
    BEFORE_PHOTOS_MODULE_ID,
  ]);
  const orderedModuleIds = [
    WHAT_IS_A_LEAD_MODULE_ID,
    PRINTING_POSTER_MODULE_ID,
    GOOGLE_PROFILE_MODULE_ID,
    YELP_MODULE_ID,
    SOCIAL_MEDIA_101_MODULE_ID,
    SETTING_UP_INSTAGRAM_MODULE_ID,
    FIRST_POST_MODULE_ID,
    CONSUMER_FINANCING_MODULE_ID,
  ];
  const orderedModules = orderedModuleIds
    .map((moduleId) =>
      moduleId === SOCIAL_MEDIA_101_MODULE_ID
        ? modules.find((module) => module.id === moduleId) ||
          SOCIAL_MEDIA_101_MODULE
        : moduleId === SETTING_UP_INSTAGRAM_MODULE_ID
          ? modules.find((module) => module.id === moduleId) ||
            SETTING_UP_INSTAGRAM_MODULE
          : moduleId === CONSUMER_FINANCING_MODULE_ID
            ? modules.find((module) => module.id === moduleId) ||
              CONSUMER_FINANCING_MODULE
            : modules.find((module) => module.id === moduleId),
    )
    .filter((module): module is ModuleWithLessons => Boolean(module))
    .map(withMarketingDisplayTitle);
  const customOrderedModuleIds = new Set([
    ...orderedModuleIds,
    ...archivedModuleIds,
  ]);
  const remainingModules = modules.filter(
    (module) => !customOrderedModuleIds.has(module.id),
  );

  return [...orderedModules, ...remainingModules];
};

export function useCourses(options?: { includeUnpublished?: boolean }) {
  return useQuery({
    queryKey: ["courses", options?.includeUnpublished],
    queryFn: async () => {
      let coursesQuery = supabase
        .from("courses")
        .select("*")
        .order("order_index");
      let modulesQuery = supabase
        .from("modules")
        .select("*")
        .order("order_index");
      const lessonsQuery = supabase
        .from("lessons")
        .select("*")
        .order("order_index");

      // Filter unpublished content unless explicitly including it (admin view)
      if (!options?.includeUnpublished) {
        coursesQuery = coursesQuery.eq("is_published", true);
        modulesQuery = modulesQuery.eq("is_published", true);
      }

      const { data: courses, error: coursesError } = await coursesQuery;
      if (coursesError) throw coursesError;

      const { data: modules, error: modulesError } = await modulesQuery;
      if (modulesError) throw modulesError;

      const { data: lessons, error: lessonsError } = await lessonsQuery;
      if (lessonsError) throw lessonsError;

      // Combine data
      const coursesWithModules: CourseWithModules[] = courses.map((course) => ({
        ...course,
        modules: positionMarketingFoundationsModules(
          course.id,
          modules
            .filter((m) => m.course_id === course.id)
            .map((module) => ({
              ...module,
              lessons:
                module.id === FIRST_POST_MODULE_ID
                  ? [
                      ...lessons.filter(
                        (lesson) => lesson.module_id === module.id,
                      ),
                      ...(!lessons.some(
                        (lesson) => lesson.id === THIRD_POST_LESSON.id,
                      )
                        ? [THIRD_POST_LESSON]
                        : []),
                      ...(!lessons.some(
                        (lesson) => lesson.id === FOURTH_POST_LESSON.id,
                      )
                        ? [FOURTH_POST_LESSON]
                        : []),
                    ]
                  : lessons.filter((lesson) => lesson.module_id === module.id),
            })),
        ),
      }));

      return coursesWithModules;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Course mutations
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (course: TablesInsert<"courses">) => {
      const { data, error } = await supabase
        .from("courses")
        .insert(course)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create course: " + error.message);
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"courses"> & { id: string }) => {
      const { data, error } = await supabase
        .from("courses")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update course: " + error.message);
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Course deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete course: " + error.message);
    },
  });
}

// Module mutations
export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (module: TablesInsert<"modules">) => {
      const { data, error } = await supabase
        .from("modules")
        .insert(module)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Module created successfully");
    },
    onError: (error) => {
      toast.error("Failed to create module: " + error.message);
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"modules"> & { id: string }) => {
      const { data, error } = await supabase
        .from("modules")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Module updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update module: " + error.message);
    },
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Module deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete module: " + error.message);
    },
  });
}

// Lesson (sub-lesson) mutations
export function useCreateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lesson: TablesInsert<"lessons">) => {
      const { data, error } = await supabase
        .from("lessons")
        .insert(lesson)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Sub-lesson created");
    },
    onError: (error) =>
      toast.error("Failed to create sub-lesson: " + error.message),
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: TablesUpdate<"lessons"> & { id: string }) => {
      const { data, error } = await supabase
        .from("lessons")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Sub-lesson updated");
    },
    onError: (error) =>
      toast.error("Failed to update sub-lesson: " + error.message),
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Sub-lesson deleted");
    },
    onError: (error) =>
      toast.error("Failed to delete sub-lesson: " + error.message),
  });
}
