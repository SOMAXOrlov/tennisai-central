// ============================================================
// TennisAI — Role-Based Route Guard
// ============================================================

import { Navigate, useLocation } from "react-router-dom";
import type { UserRole } from "@/types";
import { useAuth } from "@/auth/AuthContext";
import { AccessDeniedState } from "@/components/ui/shared";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  /** Show AccessDenied instead of redirect */
  showDenied?: boolean;
}

/** Protects routes — redirects to /login if not authenticated */
export function RouteGuard({ children, allowedRoles, showDenied }: RouteGuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (showDenied) {
      return <AccessDeniedState />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/** Redirects authenticated users away from auth pages */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
