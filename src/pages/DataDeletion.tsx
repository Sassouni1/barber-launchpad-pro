import { CheckCircle2, Mail, ShieldX } from "lucide-react";

const supportEmail = "Thebarberlaunch@gmail.com";

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-semibold text-foreground hover:text-primary">The Barber Launch</a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <div className="mb-10 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl gold-text">Data Deletion Instructions</h1>
          <p className="text-sm text-foreground md:text-base">For your Barber Launch account or Facebook connection</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-foreground md:text-base">
          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Request deletion</h2>
            </div>
            <p>Email <a className="text-primary underline hover:text-primary/80" href={`mailto:${supportEmail}?subject=Data%20Deletion%20Request`}>{supportEmail}</a> from the email address on your Barber Launch account with the subject line <strong>Data Deletion Request</strong>. Include whether you want us to delete your Facebook connection, your Barber Launch account, or both.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldX className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Disconnect Facebook immediately</h2>
            </div>
            <p>You can also remove The Barber Launch from Facebook at any time in Facebook&apos;s <strong>Settings &amp; privacy → Settings → Business integrations</strong>. Removing the integration prevents future access through that Facebook authorization.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><CheckCircle2 className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">What happens next</h2>
            </div>
            <p>We will verify the request using your account email, remove the requested Barber Launch account and/or Facebook connection data, and send a confirmation to that email address. Some information may be retained only where required for legal, security, billing, or recordkeeping purposes.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
