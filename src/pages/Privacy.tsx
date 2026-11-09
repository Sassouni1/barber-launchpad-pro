import { Database, Facebook, Settings, Share2, UserCheck, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const linkClass = "text-primary underline hover:text-primary/80";

export default function PrivacyPage() {
  const lastUpdated = "August 14, 2026";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-semibold text-foreground hover:text-primary">
            The Barber Launch
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl gold-text">
            Privacy Policy
          </h1>
          <p className="text-sm text-foreground md:text-base">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-8">
          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Information We Collect</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                We collect information needed for education, member tools, support, orders, and marketing, including account name/email, platform activity, business information, and communications.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Facebook className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Facebook Connection</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                If someone connects Facebook, we receive the Page information and permissions they authorize and use that connection only for requested Facebook Page and managed-ad features.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">How We Use Information</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                We use data to operate and improve the platform, deliver requested services, maintain security, communicate, provide support, and meet legal obligations.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Sharing</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p className="font-semibold text-foreground">We do not sell personal information.</p>
              <p>
                We share information with service providers only as needed for requested services; Meta processes information under its own policies and Facebook settings.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Your Choices</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                Members may request access, correction, or deletion. See our{" "}
                <Link to="/data-deletion" className={linkClass}>
                  Data Deletion Instructions
                </Link>
                .
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Contact Us</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground md:text-base">
              Questions about this Privacy Policy? Contact us at{" "}
              <a href="mailto:Thebarberlaunch@gmail.com" className={linkClass}>
                Thebarberlaunch@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
