import { useLocation } from "wouter";
import { useUser } from "@/contexts/UserContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { currentUser, loading } = useUser();

  // Check authentication and role
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!currentUser) {
    setLocation("/login");
    return null;
  }

  // Check role access - only allow if user has a role that's in the allowed roles
  if (currentUser.role && allowedRoles.includes(currentUser.role)) {
    return <>{children}</>;
  }

  // Role not allowed, redirect to dashboard
  console.warn(
    `⚠️ User with role "${currentUser.role}" attempted to access restricted page. Redirecting to dashboard.`
  );
  setLocation("/");
  return null;
}

export default ProtectedRoute;
