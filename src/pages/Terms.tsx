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
              <h2 className="text-xl font-semibold">Refund Policy — The 3 Client Guarantee</h2>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground md:text-base">
              <p className="font-medium text-foreground">
                The Barber Launch Hair System Mastery &amp; Business Training program is backed by our 3 Client Guarantee: get 3 paying hair system clients within your first 16 weeks with us, or get your money back.
              </p>
              <p>To qualify for a refund under the 3 Client Guarantee, you must complete every one of the following:</p>
              <ul className="list-disc space-y-2 pl-6 text-foreground">
                <li>Complete all required training modules and quizzes</li>
                <li>Post the 8 pieces of content we give you on your social media</li>
                <li>Submit certification photos and pass certification</li>
                <li>Attend at least 50% of weekly live group coaching calls (minimum 8 of 16)</li>
                <li>Run the required ad spend of $10 per day for at least 50 days</li>
                <li>Respond to Barber Launch calls, text, and emails at <a href="mailto:Thebarberlaunch@gmail.com" className="text-primary underline hover:text-primary/80">Thebarberlaunch@gmail.com</a> or <a href="tel:727-637-4672" className="text-primary underline hover:text-primary/80">727-637-4672</a></li>
                <li>Stay active in the program during the 16-week period</li>
              </ul>
              <p>
                If you complete every requirement above and still have not secured 3 paying hair system clients within 16 weeks, you are eligible for a full refund.
              </p>
              <p className="font-medium text-foreground">
                The 3 Client Guarantee applies only to the Barber Launch Hair System Mastery &amp; Business Training program. Standalone hair system training (without the business &amp; marketing components) and all other memberships, products, and services are non-refundable.
              </p>
              <p>
                To start a guarantee-related refund request, contact our support team with your order details and proof of completion.
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
                Our 3 Client Guarantee applies to the Barber Launch Hair System Mastery &amp; Business Training program. To remain eligible you must complete all required training modules and quizzes, post the 8 pieces of content we give you on your social media, submit certification photos and pass certification, attend at least 50% of weekly live group coaching calls (minimum 8 of 16), run the required ad spend of $10 per day for at least 50 days, respond to Barber Launch calls, text, and emails at <a href="mailto:Thebarberlaunch@gmail.com" className="text-primary underline hover:text-primary/80">Thebarberlaunch@gmail.com</a> or <a href="tel:727-637-4672" className="text-primary underline hover:text-primary/80">727-637-4672</a>, and stay active in the program during the 16-week period. Failing to complete any of these voids guarantee eligibility.
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
                  href="mailto:Thebarberlaunch@gmail.com"
                  className="text-primary underline hover:text-primary/80"
                >
                  Thebarberlaunch@gmail.com
                </a>
                {" "}or{" "}
                <a
                  href="tel:727-637-4672"
                  className="text-primary underline hover:text-primary/80"
                >
                  727-637-4672
                </a>
                .
              </p>
          </section>
        </div>
      </main>
    </div>
  );
}
