import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/ui/Logo';
import { SignaturePad } from '@/components/agreement/SignaturePad';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Agreement() {
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const navigate = useNavigate();
  const { user, refreshUserStatus, isAgreementRequired, hasSignedAgreement, isAdmin } = useAuth();

  // Redirect away if agreement is not required, already signed, or user is admin
  useEffect(() => {
    if (!isAgreementRequired || hasSignedAgreement || isAdmin) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAgreementRequired, hasSignedAgreement, isAdmin, navigate]);

  const handleSignatureChange = useCallback((hasSig: boolean, data: string | null) => {
    setHasSignature(hasSig);
    setSignatureData(data);
  }, []);

  const handleSign = async () => {
    if (!user || !hasSignature) return;
    
    setSigning(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          agreement_signed_at: new Date().toISOString(),
          signature_data: signatureData
        })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh auth context to update hasSignedAgreement state
      await refreshUserStatus();
      
      toast.success('Agreement signed successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error signing agreement:', error);
      toast.error('Failed to sign agreement. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const canSign = hasSignature;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="py-8 px-6 border-b border-border/50">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <Logo size="lg" />
          <h1 className="text-2xl md:text-3xl font-display font-bold gold-text text-center">
            SERVICE AGREEMENT
          </h1>
          <p className="text-muted-foreground text-center">
            Please read and sign the agreement below to access the platform
          </p>
        </div>
      </div>

      {/* Agreement Content */}
      <div className="flex-1 py-8 px-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Scroll indicator */}
            <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50 animate-pulse">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              Scroll to read
            </div>
            {/* Bottom fade overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/80 to-transparent pointer-events-none rounded-b-lg z-10" />
            
            <ScrollArea className="h-[calc(100vh-520px)] min-h-[300px] rounded-lg border border-border/50 bg-card/50 p-6 md:p-8">
              <div className="space-y-6 text-foreground/90 leading-relaxed pr-4">
              <p className="text-muted-foreground italic">
                This Agreement ("Agreement") is entered into as of {today}, by and between Sassouni Digital Media, 
                also known as "Barber Launch" (the "Service Provider"), and {user?.email || 'Client'} (the "Client").
              </p>
              <p className="text-muted-foreground italic">Collectively referred to as the "Parties."</p>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">Purpose of the Agreement</h2>
                <p>
                  Client has paid $1,997 to enroll in an educational program focused on launching a business 
                  in the hair systems industry. Barber Launch agrees to provide training, instruction, and 
                  related services under the terms laid out in this Agreement.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">Included Services</h2>
                <p>Barber Launch will provide the following services, depending on the Client{"'"}s selected package:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Instruction and guidance on how to perform hair systems</li>
                  <li>Website creation and setup for the Client{"'"}s hair systems business</li>
                  <li>Facebook and/or Instagram ad setup and publishing, as instructed in the program</li>
                  <li>CRM setup, including automated email and text message follow-up</li>
                  <li>Client acquisition systems and support</li>
                  <li>Hair system kit, if included in the Client{"'"}s selected package</li>
                </ul>
                <p className="text-muted-foreground text-sm">
                  Specific deliverables may vary based on the package purchased.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-lg font-semibold gold-text">Key Terms</h2>
                
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Confidentiality & Trade Secrets</h3>
                  <p>
                    Client agrees not to sell, share, distribute, reproduce, or teach any proprietary methods, 
                    strategies, or materials provided by Barber Launch. All documents, strategies, videos, systems, 
                    and proprietary knowledge remain the intellectual property of Barber Launch.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Non-Disparagement</h3>
                  <p>
                    Both Parties agree not to publicly or privately make negative, harmful, or disparaging 
                    statements about the other Party, its business, services, employees, or reputation.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Non-Compete</h3>
                  <p>
                    Client agrees not to create, sell, or promote any competing program, course, or service 
                    that teaches hair systems, hair system business setup, or advertising strategies 
                    substantially similar to those taught by Barber Launch for a period of three (3) years 
                    from the date of this Agreement.
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">The 3 Client Guarantee</h2>
                <p>
                  The Barber Launch Hair System Mastery &amp; Business Training program is backed by
                  our 3 Client Guarantee: get 3 paying hair system clients within your first
                  <strong> 16 weeks </strong> with us, or get your money back.
                </p>

                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">To qualify, Client must:</h3>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Complete all required training modules and quizzes</li>
                    <li>Post the 8 pieces of content we give you on your social media</li>
                    <li>Submit certification photos and pass certification</li>
                    <li>Attend your onboarding call, tech call, and half way call</li>
                    <li>Run the required ad spend of $10 per day for at least 50 days</li>
                    <li>Call at least 50 of the leads we generate for you, using the phone number we provide, so we can verify the calls</li>
                    <li>Respond to Barber Launch calls, text, and emails at <a href="mailto:Thebarberlaunch@gmail.com" className="text-primary underline hover:text-primary/80">Thebarberlaunch@gmail.com</a> or <a href="tel:727-637-4672" className="text-primary underline hover:text-primary/80">727-637-4672</a></li>
                    <li>Stay active in the program during the 16-week period</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Refund Terms</h3>
                  <p>
                    If Client completes every requirement above and has not secured 3 paying
                    hair system clients within 16 weeks, Barber Launch will issue a full refund.
                    Client will keep their website, certification, training access, CRM setup,
                    and business assets created during the program.
                  </p>
                  <p className="text-muted-foreground text-sm">
                    The 3 Client Guarantee applies only to the Barber Launch Hair System Mastery
                    &amp; Business Training program. Standalone hair system training (without the
                    business &amp; marketing components) and all other memberships, products, and
                    services are non-refundable.
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">NDA (Non-Disclosure Agreement)</h2>
                <p>
                  Client agrees not to disclose, replicate, or utilize any proprietary systems, strategies, 
                  or information from Barber Launch in any other venture, company, or educational format 
                  without express written permission.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">Relationship of the Parties</h2>
                <p>
                  Nothing in this Agreement creates a partnership, joint venture, or employment relationship. 
                  Both Parties remain independent contractors.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">Governing Law</h2>
                <p>
                  This Agreement shall be governed by and construed in accordance with the laws of the 
                  State of Florida.
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold gold-text">Entire Agreement</h2>
                <p>
                  This document reflects the entire agreement between the Parties and supersedes all prior 
                  agreements, whether written or verbal.
                </p>
              </section>

              <section className="space-y-4 pt-4 border-t border-border/50">
                <h2 className="text-lg font-semibold gold-text">Signatures</h2>
                
                <div className="space-y-2">
                  <p className="font-medium">Service Provider:</p>
                  <p className="text-muted-foreground">Sassouni Digital Media (Barber Launch)</p>
                  <p className="text-muted-foreground italic">Digitally signed</p>
                </div>
              </section>
              </div>
            </ScrollArea>
          </div>

          {/* Client Signature Section */}
          <div className="mt-6 p-6 rounded-lg border border-border/50 bg-card/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Client Signature</p>
                <p className="text-sm text-muted-foreground">{user?.email || 'Client'} • {today}</p>
              </div>
            </div>
            
            <SignaturePad onSignatureChange={handleSignatureChange} />
          </div>
        </div>
      </div>

      {/* Sign Button */}
      <div className="py-6 px-6 border-t border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto flex justify-end">
          <Button
            onClick={handleSign}
            disabled={!canSign || signing}
            className="min-w-[180px]"
          >
            {signing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Signing...
              </>
            ) : (
              'Sign Agreement'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
