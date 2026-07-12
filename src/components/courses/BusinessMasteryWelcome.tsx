import { ArrowRight, CheckCircle2, Mail, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessMasteryWelcomeProps {
  onContinue: () => void;
}

export const BUSINESS_MASTERY_WELCOME_PENDING_KEY =
  "business-mastery-welcome-pending";

/**
 * A lightweight transition between certification and the business curriculum.
 * It is intentionally dismissible: it orients a newly certified member without
 * turning the welcome message into another course requirement.
 */
export function BusinessMasteryWelcome({ onContinue }: BusinessMasteryWelcomeProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="business-mastery-welcome-title"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border-2 border-primary/45 bg-card/95 p-6 shadow-2xl shadow-primary/15 sm:p-8 animate-in zoom-in-95 duration-300">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gold-gradient shadow-lg shadow-primary/25">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Level 1 certification
              </p>
              <h1
                id="business-mastery-welcome-title"
                className="mt-1 font-display text-2xl font-bold gold-text sm:text-3xl"
              >
                Congratulations!
              </h1>
            </div>
          </div>

          <div className="space-y-5 text-muted-foreground">
            <div>
              <p className="text-base font-semibold text-foreground sm:text-lg">
                Congratulations — you are officially Hair System Certified.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what happens next:</p>
            </div>

            <ul className="space-y-3 rounded-2xl border border-border/50 bg-secondary/20 p-4">
              <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-soft" />
                <span>Your certification is complete.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>We&apos;ll mail your official Hair System Certification.</span>
              </li>
              <li className="flex items-start gap-3 text-sm leading-relaxed text-foreground/90">
                <Upload className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>
                  When it arrives, return to Hair System Training and upload your photo in <strong>Get Added to the Men&apos;s Hair Expert Search Database</strong>.
                </span>
              </li>
            </ul>

            <div className="border-t border-border/50 pt-4">
              <p className="text-sm text-muted-foreground">While you wait, it&apos;s time to build your business.</p>
              <p className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
                Welcome to Business Mastery.
              </p>
            </div>
          </div>

          <Button
            type="button"
            className="mt-7 h-12 w-full gap-2 gold-gradient text-base font-bold text-primary-foreground shadow-lg shadow-primary/20"
            onClick={onContinue}
          >
            Start Business Mastery
            <ArrowRight className="h-5 w-5" />
          </Button>
          <button
            type="button"
            className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={onContinue}
          >
            Continue later
          </button>
        </div>
      </div>
    </div>
  );
}
