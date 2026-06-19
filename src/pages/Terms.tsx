import { FileText, RefreshCcw, Shield, Mail } from "lucide-react";

export default function TermsPage() {
  const lastUpdated = "June 19, 2026";

  return (
    <div className="min-h-screen bg-background cyber-grid">
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
            Terms & Refund Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-8">
          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">Terms of Service</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>
                By accessing or using The Barber Launch platform, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, please do not use our services.
              </p>
              <p>
                The Barber Launch provides online education, tools, and resources for hair system and business training. Your membership grants you a limited, non-exclusive, non-transferable license to access the content for your personal or business use.
              </p>
              <p>
                You may not share your login credentials, redistribute course materials, resell access, or use the platform for any unlawful purpose. We reserve the right to suspend or terminate accounts that violate these rules.
              </p>
              <p>
                All content, trademarks, and materials on the platform are the property of The Barber Launch and are protected by copyright and intellectual property laws.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <RefreshCcw className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">Refund Policy</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p className="font-medium text-foreground">
                All sales are final. We do not offer refunds on any membership, course, product, or service purchases.
              </p>
              <p>
                The only exception is our 3 Client Guarantee. If you complete all guarantee requirements — including the specified course modules, required homework submissions, and scheduled coaching calls — and do not secure three clients within the defined eligibility window, you may qualify for a refund under the terms of the guarantee.
              </p>
              <p>
                Refund requests outside of the 3 Client Guarantee, or for accounts that have not satisfied the guarantee requirements, will not be honored.
              </p>
              <p>
                To inquire about a guarantee-related refund, contact our support team with your order details and proof of completion.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">Disclaimers & Guarantees</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p>
                Results from our training programs depend on individual effort, experience, and market conditions. Testimonials shown are real experiences but are not a guarantee of future results.
              </p>
              <p>
                Our 3 Client Guarantee, where applicable, requires that you complete the specified course modules, submit all required homework, and attend the scheduled coaching calls. Failure to meet these requirements voids guarantee eligibility.
              </p>
              <p>
                The platform is provided "as is" without warranties of any kind, either express or implied. We do not guarantee uninterrupted access or that the platform will be error-free at all times.
              </p>
            </div>
          </section>

          <section className="glass-card rounded-xl p-6 md:p-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">Contact Us</h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
              If you have any questions about these Terms or our Refund Policy, please contact us at{" "}
              <a
                href="mailto:support@thebarberlaunch.com"
                className="text-primary underline hover:text-primary/80"
              >
                support@thebarberlaunch.com
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
