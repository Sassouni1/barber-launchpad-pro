import { Link } from 'react-router-dom';
import { Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { PhotoUploader } from '@/components/certification/PhotoUploader';
import { useCertificationPhotos } from '@/hooks/useCertification';

interface PhotoUploadSectionProps {
  courseId: string;
}

export function PhotoUploadSection({ courseId }: PhotoUploadSectionProps) {
  const {
    photos,
    isLoading,
    uploadPhoto,
    isUploading,
    deletePhoto,
    isDeleting,
  } = useCertificationPhotos(courseId);

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
            <h2 className="font-display text-lg font-bold gold-text">Upload Your Template Photo</h2>
            <p className="text-sm text-muted-foreground">
              This is required to earn your certification
            </p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-secondary/20 border border-border space-y-3">
          <h3 className="font-semibold text-sm">Instructions:</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span>Take a clear photo of your completed hair system template</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span>Make sure the lighting is good and the template is clearly visible</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span>Upload the photo using the uploader below</span>
            </li>
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
