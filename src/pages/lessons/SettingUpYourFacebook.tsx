import { ArrowLeft, Video } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { FileDownloadButton } from "@/components/ui/file-download-button";
import { useAuth } from "@/hooks/useAuth";
import { canViewFacebookPreview, FACEBOOK_BANNER_PATH, FACEBOOK_PROFILE_PICTURE_PATH } from "@/data/facebookPreviewLesson";

export default function SettingUpYourFacebook() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!canViewFacebookPreview(user?.email)) {
    return <Navigate to="/courses/business" replace />;
  }

  return (
    <DashboardLayout>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" aria-label="Back to Business Mastery" onClick={() => navigate("/courses/business")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">Business Mastery</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Setting Up Your Facebook</h1>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-400">Unpublished</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create a Facebook Page for your hair replacement services and add the cover and profile images below.</p>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Lesson video</h2>
          <div className="mt-4 flex aspect-video flex-col items-center justify-center gap-3 rounded-xl border border-border bg-black text-center">
            <Video className="h-8 w-8 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Video coming soon</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Facebook cover image</h2>
          <p className="mt-1 text-sm text-muted-foreground">Preview the image, then save the original PNG file to use as your Page cover photo.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border">
            <img src={FACEBOOK_BANNER_PATH} alt="Chris's hair system before-and-after on the left and a red-haired before-and-after on the right" className="block h-auto w-full" />
          </div>
          <div className="mt-4">
            <FileDownloadButton url={FACEBOOK_BANNER_PATH} filename="barber-launch-facebook-cover.png" label="Download cover image" className="gap-2" />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Facebook profile picture</h2>
          <p className="mt-1 text-sm text-muted-foreground">Download this before-and-after image and use it as your Page profile picture.</p>
          <div className="mt-4 w-full max-w-48 overflow-hidden rounded-xl border border-border">
            <img src={FACEBOOK_PROFILE_PICTURE_PATH} alt="Hair system before-and-after for the Facebook Page profile picture" className="block h-auto w-full" />
          </div>
          <div className="mt-4">
            <FileDownloadButton url={FACEBOOK_PROFILE_PICTURE_PATH} filename="hair-system-facebook-profile-picture.png" label="Download profile picture" className="gap-2" />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <h2 className="font-display text-xl font-semibold">Set up your Page</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-foreground/90">
            <li>In Facebook, create a Page for your barber or hair replacement business. Use the business name clients know.</li>
            <li>Download the profile picture above and upload it to your Page. Then enter your location, contact details, hours, and booking link.</li>
            <li>Download the cover image above. On your Page, choose <strong>Edit cover photo</strong> and upload the saved PNG.</li>
            <li>Check the cover on both desktop and mobile. Reposition it if Facebook crops an important part of the image.</li>
            <li>Add a short description of your services and a booking action button, then review the Page before sharing it.</li>
          </ol>
        </section>
      </main>
    </DashboardLayout>
  );
}
