import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  skipAgreementCheck?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false, skipAgreementCheck = false }: ProtectedRouteProps) {
  const { user, loading, isAdmin, hasSignedAgreement } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasSignedAgreement && !skipAgreementCheck) {
    return <Navigate to="/agreement" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
