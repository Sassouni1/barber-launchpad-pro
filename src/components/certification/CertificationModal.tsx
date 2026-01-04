import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, Award, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CertificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
  certificateUrl?: string | null;
  isGenerating: boolean;
}

type Step = 'analyzing' | 'name-entry' | 'complete';

export function CertificationModal({
  isOpen,
  onClose,
  onSubmit,
  certificateUrl,
  isGenerating,
}: CertificationModalProps) {
  const [step, setStep] = useState<Step>('name-entry');
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Analysis animation - 2 minutes
  useEffect(() => {
    if (!isOpen) {
      setStep('analyzing');
      setProgress(0);
      setName('');
      return;
    }

    if (step === 'analyzing') {
      const duration = 120000; // 2 minutes
      const interval = 100;
      const increment = (interval / duration) * 100;

      const timer = setInterval(() => {
        setProgress(prev => {
          const next = prev + increment;
          if (next >= 100) {
            clearInterval(timer);
            setStep('name-entry');
            return 100;
          }
          return next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [isOpen, step]);

  // Move to complete when certificate URL is available
  useEffect(() => {
    if (certificateUrl && step === 'name-entry') {
      setStep('complete');
    }
  }, [certificateUrl, step]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownload = () => {
    if (certificateUrl) {
      window.open(certificateUrl, '_blank');
    }
  };

  const analysisMessages = [
    'Reviewing your quiz scores...',
    'Analyzing your work photos...',
    'Evaluating technique quality...',
    'Checking completion requirements...',
    'Preparing your certification...',
  ];

  const currentMessage = analysisMessages[Math.floor((progress / 100) * (analysisMessages.length - 1))];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && step === 'complete' && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            {step === 'analyzing' && 'Analyzing Your Work'}
            {step === 'name-entry' && 'Enter Your Name'}
            {step === 'complete' && 'Certificate Ready!'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 'analyzing' && (
            <div className="space-y-4">
              <div className="relative">
                <Progress value={progress} className="h-3" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground animate-pulse">
                  {currentMessage}
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.round(progress)}% complete
                </p>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 animate-spin border-t-primary" />
                  <Award className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          )}

          {step === 'name-entry' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Congratulations! Enter your name as you want it to appear on your certificate.
              </p>
              <div className="space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  className="text-center text-lg font-certificate"
                  autoFocus
                />
                <p className="text-center font-certificate text-2xl text-primary mt-4">
                  {name || 'Your Name Here'}
                </p>
              </div>
              <Button
                className="w-full gold-gradient"
                onClick={handleSubmit}
                disabled={!name.trim() || isSubmitting || isGenerating}
              >
                {isSubmitting || isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Certificate...
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4 mr-2" />
                    Generate My Certificate
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'complete' && certificateUrl && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border border-primary/30 shadow-lg">
                <img
                  src={certificateUrl}
                  alt="Your Certificate"
                  className="w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 gold-gradient"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Certificate
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Congratulations on completing your Hair System Mastery certification!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
