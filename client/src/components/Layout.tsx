import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  QrCode,
  FileText,
  LogOut,
  Menu,
  X,
  UserCircle,
  History,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check if auth is available
    if (!auth) {
      console.error("❌ Firebase Auth is not initialized. Check your .env.local file.");
      if (location !== "/login" && location !== "/register") {
        setLocation("/login");
      }
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser && location !== "/login" && location !== "/register") {
        setLocation("/login");
      } else {
        setUser(currentUser);
        if (currentUser && db) {
          // Fetch user role
          try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
              setRole(userDoc.data().role);
            } else {
              // Fallback if no role found (e.g. old admin account)
              // Assuming admin@hrgroup.com is always superadmin (panel admin)
              if (currentUser.email === "admin@hrgroup.com") {
                setRole("superadmin");
              } else {
                // Default to employee role for new users without explicit role
                setRole("employee");
              }
            }
          } catch (error) {
            console.error("Error fetching user role:", error);
          }
        } else {
          setRole(null);
        }
      }
    });
    return () => unsubscribe();
  }, [location, setLocation]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      setLocation("/login");
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  if (location === "/login" || location === "/register") {
    return <>{children}</>;
  }

  const allNavItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      href: "/",
      roles: ["superadmin", "admin", "employee"],
    },
    {
      icon: Users,
      label: "Employees",
      href: "/employees",
      roles: ["superadmin", "admin"],
    },
    {
      icon: Shield,
      label: "Admins",
      href: "/admins",
      roles: ["superadmin"],
    },
    {
      icon: QrCode,
      label: "Scan Attendance",
      href: "/scan",
      roles: ["employee"],
    },
    {
      icon: History,
      label: "Attendance History",
      href: "/attendance-history",
      roles: ["employee"],
    },
    {
      icon: FileText,
      label: "Reports",
      href: "/reports",
      roles: ["superadmin", "admin"],
    },
    {
      icon: UserCircle,
      label: "My Profile",
      href: "/profile",
      roles: ["employee"],
    },
    // Add more employee specific routes here if needed
  ];

  const navItems = allNavItems.filter(
    (item) => role && item.roles.includes(role)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-200 ease-in-out
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <img src="/logo.png" alt="Logo" className="h-6 w-6" />
            <span>AttendanceQR</span>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 px-4 py-3 mb-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                {user?.email || "User"}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {role || "Loading..."}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-8 justify-between lg:justify-end">
          <button
            className="lg:hidden p-2 -ml-2 text-gray-600"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="hidden lg:flex items-center gap-4 text-sm text-gray-500">
            <span>
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
