import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setLocation("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userRole = userDoc.data().role;
          setRole(userRole);

          // Check if user has access - only allow if their role is in the allowed roles
          if (!allowedRoles.includes(userRole)) {
            console.warn(
              `⚠️ User with role "${userRole}" attempted to access restricted page. Redirecting to dashboard.`
            );
            // Redirect to dashboard if user doesn't have access
            setLocation("/");
          }
        } else {
          // Fallback for users without role in database
          if (currentUser.email === "admin@hrgroup.com") {
            setRole("superadmin");
            // Check if this user is allowed access
            if (!allowedRoles.includes("superadmin")) {
              setLocation("/");
            }
          } else {
            setRole("employee");
            // Check if employee role is allowed
            if (!allowedRoles.includes("employee")) {
              setLocation("/");
            }
          }
        }
      } catch (error) {
        console.error("❌ Error fetching role:", error);
        // On error, default to employee and redirect if not allowed
        setRole("employee");
        if (!allowedRoles.includes("employee")) {
          setLocation("/");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [allowedRoles, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render children if user has the right role
  if (role && allowedRoles.includes(role)) {
    return <>{children}</>;
  }

  // Return null while redirecting
  return null;
}
