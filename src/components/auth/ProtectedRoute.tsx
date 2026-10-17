import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireManufacturer?: boolean;
  skipAgreementCheck?: boolean;
  skipPasswordResetCheck?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, requireManufacturer = false, skipAgreementCheck = false, skipPasswordResetCheck = false }: ProtectedRouteProps) {
  const { user, loading, statusError, refreshUserStatus, isAdmin, isManufacturer, hasSignedAgreement, isAgreementRequired, requiresPasswordReset } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (statusError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-6 text-center" role="alert">
        <p>{statusError}</p>
        <Button onClick={() => { void refreshUserStatus().catch(() => {}); }}>Try Again</Button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiresPasswordReset && !skipPasswordResetCheck) {
    return <Navigate to="/reset-password" replace />;
  }

  if (requireManufacturer && !isManufacturer && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isManufacturer && !isAdmin && !requireManufacturer) {
    return <Navigate to="/newtimes" replace />;
  }

  if (isAgreementRequired && !hasSignedAgreement && !skipAgreementCheck && !isAdmin && !isManufacturer) {
    return <Navigate to="/agreement" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
