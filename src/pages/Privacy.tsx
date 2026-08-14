import { Database, Eye, LockKeyhole, Mail, Share2 } from "lucide-react";

const supportEmail = "Thebarberlaunch@gmail.com";

export default function PrivacyPage() {
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
          <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl gold-text">Privacy Policy</h1>
          <p className="text-sm text-foreground md:text-base">Last updated: August 14, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-foreground md:text-base">
          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Database className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Information we collect</h2>
            </div>
            <p>We collect the information needed to provide The Barber Launch education, member tools, support, orders, and marketing features. This can include account details such as your name and email address, training and platform activity, business information you submit, and communications you send us.</p>
            <p className="mt-4">If you choose to connect a Facebook account, we receive the Page information and permissions that you authorize in Facebook&apos;s consent screen. We use that connection only to provide the Facebook Page and managed-ad features you request.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Eye className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">How we use information</h2>
            </div>
            <p>We use information to operate and improve the platform, deliver the products and services you request, maintain security, communicate with you, provide support, and meet legal obligations. We do not sell your personal information.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Share2 className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Sharing and third-party services</h2>
            </div>
            <p>We share information with service providers only as needed to operate the platform and provide requested services. When you connect Facebook, Meta processes information under its own policies and your Facebook settings. Your use of third-party services is also subject to their terms and privacy policies.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Your choices and deletion requests</h2>
            </div>
            <p>You may request access to, correction of, or deletion of personal information associated with your Barber Launch account. For a Facebook connection or account deletion request, use our <a className="text-primary underline hover:text-primary/80" href="/data-deletion">data-deletion instructions</a>.</p>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="h-5 w-5" /></div>
              <h2 className="text-xl font-semibold">Contact</h2>
            </div>
            <p>For privacy questions or requests, email <a className="text-primary underline hover:text-primary/80" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
