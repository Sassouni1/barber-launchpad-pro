import { useState, useCallback } from 'react';
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
  const { user } = useAuth();

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
                <h2 className="text-lg font-semibold gold-text">Money-Back Guarantee</h2>
                <p>
                  Barber Launch offers a full money-back guarantee if, after six (6) months, the Client 
                  has not secured three (3) paying hair system clients, provided all requirements below are met.
                </p>
                
                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Requirements to Qualify</h3>
                  <p>Client must provide proof of all of the following:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Completion of at least two (2) paid hair system installs</li>
                    <li>Promotional poster hung and visibly displayed at the Client{"'"}s place of business</li>
                    <li>Facebook and/or Instagram ads launched and published as instructed, with a minimum ad spend of $600</li>
                    <li>At least fifty (50) leads contacted by phone</li>
                    <li>Completion of all required quizzes</li>
                    <li>Posting on social media two (2) times per week</li>
                  </ul>
                  <p className="text-muted-foreground text-sm">
                    Proof of completion must be provided in the form of photos, screenshots, call logs, 
                    ad receipts, CRM records, and/or platform data.
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium text-foreground">Refund Terms</h3>
                  <p>
                    If all requirements above are met and the Client has not secured three (3) paying 
                    hair system clients, Barber Launch will issue a full refund within thirty (30) business 
                    days of a written request. Refund requests must be submitted no later than seven (7) 
                    months from the program start date.
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
