import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ShieldCheck } from 'lucide-react';

export function GuaranteeCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left"
      >
        <Card className="glass-card border-primary/10 hover:border-primary/30 transition-colors">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-full bg-primary/10 p-2 shrink-0">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Backed by our 3 Client Guarantee</p>
              <p className="text-xs text-muted-foreground">
                Complete the work, get the results — or your money back. Tap to read the terms.
              </p>
            </div>
          </CardContent>
        </Card>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Our 3 Client Guarantee
            </DialogTitle>
            <DialogDescription>
              Barber Launch is designed to help you get real results, master a real skill, and our guarantee exists to support that.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm leading-relaxed">
            <p>
              Barber Launch guarantees that if you complete the required steps and do not get three paying hair system
              clients within <strong>16 weeks</strong>, you are eligible for your money back.
            </p>

            <p className="text-muted-foreground">
              Refunds are only available through the 3 Client Guarantee for students who complete the required steps.
              Otherwise, all sales are final.
            </p>

            <div>
              <p className="font-semibold mb-2">To qualify, you must:</p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Complete all required training modules and quizzes</li>
                <li>Submit your certification photos and pass certification</li>
                <li>Attend at least 50% of weekly live group coaching calls (minimum 8 of 16)</li>
                <li>Run the required ad spend for at least 50 days</li>
                <li>Respond to Barber Launch when support, setup, or campaign updates are needed</li>
                <li>Stay active in the program during the 16-week period</li>
              </ul>
            </div>

            <p>
              If you complete the requirements above and still do not get three paying clients within 16 weeks,
              Barber Launch will honor the guarantee.
            </p>

            <p className="text-muted-foreground">
              You will also keep your website, certification, training access, CRM setup, and business assets created
              during the program.
            </p>

            <p className="font-semibold">
              We want to help you win, but you have to help us help you.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
