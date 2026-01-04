import { useState } from 'react';
import { Award, CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuizProgressList } from './QuizProgressList';
import { PhotoUploader } from './PhotoUploader';
import { CertificationModal } from './CertificationModal';
import {
  useCertificationEligibility,
  useCertificationPhotos,
  useUserCertification,
  useIssueCertification,
  useResetCertification,
} from '@/hooks/useCertification';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CertificationSectionProps {
  courseId: string;
}

interface DebugInfo {
  templateWidth: number;
  templateHeight: number;
  imageCenterX: number;
  nameAnchorX: number;
  nameAnchorY: number;
  drawX: number;
  measuredTextWidth: number;
  textLeftEdge: number;
  textRightEdge: number;
  textCenter: number;
  fontSizeUsed: number;
  textAlign: string;
}

export function CertificationSection({ courseId }: CertificationSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedCertificateUrl, setGeneratedCertificateUrl] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  const { data: eligibility, isLoading: isLoadingEligibility } = useCertificationEligibility(courseId);
  const { data: existingCertification, isLoading: isLoadingCertification } = useUserCertification(courseId);
  const {
    photos,
    isLoading: isLoadingPhotos,
    uploadPhoto,
    isUploading,
    deletePhoto,
    isDeleting,
  } = useCertificationPhotos(courseId);
  const issueCertification = useIssueCertification();
  const resetCertification = useResetCertification();

  const isLoading = isLoadingEligibility || isLoadingCertification || isLoadingPhotos;

  const handleGetCertified = () => {
    setGeneratedCertificateUrl(null);
    setDebugInfo(null);
    setIsModalOpen(true);
  };

  const handleSubmitCertification = async (name: string) => {
    const result = await issueCertification.mutateAsync({
      courseId,
      certificateName: name,
    });
    if (result?.certificateUrl) {
      setGeneratedCertificateUrl(result.certificateUrl);
    }
    if (result?.debug) {
      setDebugInfo(result.debug);
    }
  };

  const handleResetCertification = async () => {
    await resetCertification.mutateAsync(courseId);
  };

  // If user already has a certification, show it
  if (existingCertification) {
    return (
      <div className="glass-card rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gold-gradient flex items-center justify-center">
              <Award className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold gold-text">Certified!</h3>
              <p className="text-sm text-muted-foreground">
                Issued on {new Date(existingCertification.issued_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-muted-foreground">
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Certification?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete your current certificate and uploaded photos. You'll need to re-upload your work photos and generate a new certificate. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetCertification}
                  disabled={resetCertification.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {resetCertification.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Certification'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {existingCertification.certificate_url && (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-primary/30">
              <img
                src={existingCertification.certificate_url}
                alt="Your Certificate"
                className="w-full"
              />
            </div>
            <Button
              className="w-full gold-gradient"
              onClick={() => window.open(existingCertification.certificate_url!, '_blank')}
            >
              Download Certificate
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 mt-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="glass-card rounded-xl p-6 mt-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            eligibility?.isEligible ? "gold-gradient" : "bg-secondary"
          )}>
            <Award className={cn(
              "w-6 h-6",
              eligibility?.isEligible ? "text-primary-foreground" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold gold-text">Get Certified</h3>
            <p className="text-sm text-muted-foreground">
              Complete the requirements below to earn your certificate
            </p>
          </div>
        </div>

        {/* Requirements - Stacked layout */}
        <div className="space-y-4">
          {/* Quiz Progress */}
          <div className="p-4 rounded-lg bg-secondary/20 border border-border">
            <QuizProgressList quizProgress={eligibility?.quizProgress || []} />
          </div>

          {/* Photo Upload */}
          <div className="p-4 rounded-lg bg-secondary/20 border border-border">
            <PhotoUploader
              photos={photos}
              onUpload={uploadPhoto}
              onDelete={deletePhoto}
              isUploading={isUploading}
              isDeleting={isDeleting}
            />
          </div>
        </div>

        {/* Status & Action */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/10 border border-border">
          <div className="flex items-center gap-3">
            {eligibility?.isEligible ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">
                  You're eligible for certification!
                </span>
              </>
            ) : (
              <>
                <Award className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Complete all requirements to get certified
                </span>
              </>
            )}
          </div>
          <Button
            className={cn(
              "transition-all",
              eligibility?.isEligible ? "gold-gradient" : ""
            )}
            disabled={!eligibility?.isEligible}
            onClick={handleGetCertified}
          >
            <Award className="w-4 h-4 mr-2" />
            Get Certified
          </Button>
        </div>
      </div>

      <CertificationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmitCertification}
        certificateUrl={generatedCertificateUrl}
        isGenerating={issueCertification.isPending}
        debugInfo={debugInfo}
      />
    </>
  );
}
