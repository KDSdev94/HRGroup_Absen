import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import DashboardAdmin from "./DashboardAdmin";
import DashboardEmployee from "./DashboardEmployee";

export default function Dashboard() {
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth state to be ready before fetching role
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const userRole = userDoc.data().role;
            setRole(userRole);
          } else {
            if (currentUser.email === "admin@hrgroup.com") {
              setRole("superadmin");
            } else {
              setRole("employee");
            }
          }
        } catch (error) {
          console.error("❌ Error fetching role:", error);
          setRole("employee");
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading || role === null) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Route to appropriate dashboard based on role
  // Employee role gets employee dashboard, everything else gets admin dashboard
  return role === "employee" ? <DashboardEmployee /> : <DashboardAdmin />;
}
