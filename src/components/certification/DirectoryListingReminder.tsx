import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useUserCertification } from "@/hooks/useCertification";
import { useCourses } from "@/hooks/useCourses";
import { useMyListing } from "@/hooks/useSpecialistDirectory";
import { getDirectoryListingReminderKey } from "@/lib/directoryListingReminder";

export function DirectoryListingReminder() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { data: courses = [], isLoading: isLoadingCourses } = useCourses();
  const hairSystemCourse = useMemo(
    () => courses.find((course) => course.category === "hair-system"),
    [courses],
  );
  const directoryModule = hairSystemCourse?.modules.find(
    (module) => module.is_directory_enrollment,
  );
  const { data: certification, isLoading: isLoadingCertification } =
    useUserCertification(hairSystemCourse?.id);
  const { data: listing, isLoading: isLoadingListing } = useMyListing(user?.id);
  const [isOpen, setIsOpen] = useState(false);

  const shouldRemind = Boolean(
    user && !isAdmin && certification && !listing && directoryModule,
  );

  useEffect(() => {
    if (!shouldRemind || !user) {
      setIsOpen(false);
      return;
    }

    setIsOpen(sessionStorage.getItem(getDirectoryListingReminderKey(user.id)) !== "true");
  }, [shouldRemind, user]);

  const dismiss = () => {
    if (user) {
      sessionStorage.setItem(getDirectoryListingReminderKey(user.id), "true");
    }
    setIsOpen(false);
  };

  const startEnrollment = () => {
    dismiss();
    navigate(`/courses/hair-system/lesson/${directoryModule!.id}`);
  };

  if (isLoadingCourses || isLoadingCertification || isLoadingListing || !shouldRemind) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <DialogContent className="max-w-lg border-primary/30 bg-card">
        <DialogHeader className="space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <DialogTitle className="text-2xl">Get added to the Hair System Database</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            Your certification is complete. Finish your directory listing so clients can find you.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3">
            <Printer className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-foreground">
              Please also print out your certification and take a picture holding it so we can add it to the database.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss}>
            Exit
          </Button>
          <Button className="gold-gradient" onClick={startEnrollment}>
            Get Added to the Database
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
