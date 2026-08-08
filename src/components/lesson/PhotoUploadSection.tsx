import { Link } from 'react-router-dom';
import { Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { PhotoUploader } from '@/components/certification/PhotoUploader';
import { useCertificationPhotos, type CertificationPhotoType } from '@/hooks/useCertification';

interface PhotoUploadSectionProps {
  courseId: string;
  photoType?: CertificationPhotoType;
}

const COPY: Record<CertificationPhotoType, {
  heading: string;
  subheading: string;
  intro: string;
  steps: string[];
  uploaderTitle: string;
  uploaderHint: string;
}> = {
  template: {
    heading: 'Upload Your Template Photo',
    subheading: 'This is required to earn your certification',
    intro:
      "Send a picture of you doing a hair system template on yourself, loved one, or client. Show a picture of it cut out and on the person's head showing that it fit.",
    steps: [
      'Take a clear photo of your completed hair system template',
      'Make sure the lighting is good and the template is clearly visible',
      'Upload the photo using the uploader below',
    ],
    uploaderTitle: 'Upload Photo of Hair System Template',
    uploaderHint: 'Upload a photo of your hair system template',
  },
  installation: {
    heading: 'Upload Your Installation & Cut Photos',
    subheading: 'This is required to earn your certification',
    intro:
      'Send photos of a hair system you installed on yourself, a loved one, or a client — after it has been cut in and blended. We want to see the finished install and the cut.',
    steps: [
      'Take a clear photo of the installed hair system on the head',
      'Take a photo showing the cut and blend (front hairline and sides)',
      'Make sure the lighting is good and nothing is blurry',
      'Upload the photos using the uploader below',
    ],
    uploaderTitle: 'Upload Installation & Cut Photos',
    uploaderHint: 'Upload photos of the finished install and cut',
  },
};

export function PhotoUploadSection({ courseId, photoType = 'template' }: PhotoUploadSectionProps) {
  const {
    photos,
    isLoading,
    uploadPhoto,
    isUploading,
    deletePhoto,
    isDeleting,
  } = useCertificationPhotos(courseId, photoType);

  const copy = COPY[photoType];
  const hasPhotos = photos.length > 0;

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full gold-gradient flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold gold-text">{copy.heading}</h2>
            <p className="text-sm text-muted-foreground">{copy.subheading}</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-secondary/20 border border-border space-y-3">
          <p className="text-sm text-muted-foreground">{copy.intro}</p>
          <h3 className="font-semibold text-sm">Instructions:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {copy.steps.map((step, index) => (
              <li key={step} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Photo Uploader */}
      <div className="glass-card rounded-xl p-6">
        <PhotoUploader
          photos={photos}
          onUpload={uploadPhoto}
          onDelete={deletePhoto}
          isUploading={isUploading}
          isDeleting={isDeleting}
          title={copy.uploaderTitle}
          hint={copy.uploaderHint}
        />
      </div>

      {/* Status */}
      <div className="glass-card rounded-xl p-4">
        {hasPhotos ? (
          <div className="flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <div>
              <p className="font-medium">Photo uploaded successfully!</p>
              <p className="text-sm text-muted-foreground">
                You've completed this requirement. Return to{' '}
                <Link to="/courses/hair-system" className="text-primary hover:underline">
                  the course page
                </Link>{' '}
                to claim your certificate.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm">
              Upload at least one photo to complete this certification requirement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
