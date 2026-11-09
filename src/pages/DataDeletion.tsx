import { Mail, Facebook, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const linkClass = "text-primary underline hover:text-primary/80";
const requestMailto =
  "mailto:Thebarberlaunch@gmail.com?subject=" + encodeURIComponent("Data Deletion Request");

export default function DataDeletionPage() {
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
            Data Deletion Instructions
          </h1>
        </div>

        <div className="space-y-8">
          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Request Deletion by Email</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                Email{" "}
                <a href={requestMailto} className={linkClass}>
                  Thebarberlaunch@gmail.com
                </a>{" "}
                from the email address on your member account, with the subject{" "}
                <span className="font-semibold">&ldquo;Data Deletion Request&rdquo;</span>.
              </p>
              <p>In your email, specify what you want deleted:</p>
              <ul className="list-disc space-y-2 pl-6 text-foreground">
                <li>Your Facebook connection</li>
                <li>Your Barber Launch account</li>
                <li>Or both</li>
              </ul>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Facebook className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Remove Access in Facebook</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                To stop future access, you can remove The Barber Launch in Facebook under{" "}
                <span className="font-semibold">Settings &amp; privacy &gt; Settings &gt; Business integrations</span>.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">What Happens Next</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-foreground md:text-base">
              <p>
                We verify your request using your account email, remove the requested account and/or Facebook connection data, and confirm by email.
              </p>
              <p>
                We retain only what is required for legal, security, billing, or recordkeeping purposes.
              </p>
              <p>
                For more about how we handle information, see our{" "}
                <Link to="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
