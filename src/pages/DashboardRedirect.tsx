import { useAuth } from "@/auth/AuthContext";
import { Navigate } from "react-router-dom";

/** Redirects /dashboard to the correct role-specific dashboard */
export default function DashboardRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case "player":
      return <Navigate to="/dashboard/player" replace />;
    case "coach":
      return <Navigate to="/dashboard/coach" replace />;
    case "observer":
      return <Navigate to="/dashboard/observer" replace />;
    case "admin":
      return <Navigate to="/dashboard/admin" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
