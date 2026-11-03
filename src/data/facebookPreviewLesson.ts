import type { ModuleWithLessons } from "@/hooks/useCourses";

export const FACEBOOK_PREVIEW_MODULE_ID = "b1050000-0000-4000-8000-000000000105";
export const FACEBOOK_PREVIEW_PATH = "/courses/business/lesson/setting-up-your-facebook";
export const FACEBOOK_BANNER_PATH = "/lesson-assets/facebook/facebook-banner-original.png";

export const canViewFacebookPreview = (email?: string | null) =>
  email?.trim().toLowerCase() === "chris@invasiondigitalmedia.com";

export const FACEBOOK_PREVIEW_MODULE: ModuleWithLessons = {
  id: FACEBOOK_PREVIEW_MODULE_ID,
  course_id: "b431323d-f61e-4447-baaa-a70467cac4ac",
  title: "Setting Up Your Facebook",
  description: "Preview the Facebook setup lesson and save the cover image for your Page.",
  video_url: null,
  duration: "",
  has_download: true,
  has_homework: false,
  has_quiz: false,
  is_certification_requirement: false,
  certification_photo_type: null,
  is_directory_enrollment: false,
  is_published: false,
  notes_content: null,
  order_index: 16,
  created_at: "",
  updated_at: "",
  lessons: [],
};
