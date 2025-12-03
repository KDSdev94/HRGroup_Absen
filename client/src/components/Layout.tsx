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
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Users2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Check if auth is available
    if (!auth) {
      console.error(
        "❌ Firebase Auth is not initialized. Check your .env.local file."
      );
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
      label: "Dasbor",
      href: "/",
      roles: ["superadmin", "admin", "employee"],
    },
    {
      icon: Users,
      label: "Peserta",
      href: "/employees",
      roles: ["superadmin", "admin"],
    },
    {
      icon: Shield,
      label: "Admin",
      href: "/admins",
      roles: ["superadmin"],
    },
    {
      icon: Users2,
      label: "User Karyawan",
      href: "/employee-users",
      roles: ["superadmin"],
    },
    {
      icon: Database,
      label: "Pembersihan Data",
      href: "/data-cleanup",
      roles: ["superadmin"],
    },
    {
      icon: QrCode,
      label: "Scan Absensi",
      href: "/scan",
      roles: ["employee"],
    },
    {
      icon: History,
      label: "Riwayat Absensi",
      href: "/attendance-history",
      roles: ["employee"],
    },
    {
      icon: FileText,
      label: "Laporan",
      href: "/reports",
      roles: ["superadmin", "admin"],
    },
    {
      icon: UserCircle,
      label: "Profil Saya",
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
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-all duration-300 ease-in-out
          ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }
          ${isCollapsed ? "w-20" : "w-64"}
          flex flex-col
        `}
      >
        <div
          className={`h-16 flex items-center justify-between ${
            isCollapsed ? "px-2" : "px-6"
          } border-b border-gray-200 dark:border-gray-700 transition-all duration-300 dark:bg-white dark:text-gray-900`}
        >
          <div className="flex items-center overflow-hidden">
            <img
              src="/header.webp"
              alt="HR Group Attendance"
              className={`transition-all duration-300 ${
                isCollapsed ? "h-10" : "h-12"
              } object-contain`}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="h-9 w-9"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {theme === "dark" ? "Mode Terang" : "Mode Gelap"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Mobile Close Button */}
            <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <div
                        className={`
                          flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                          ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          }
                          ${isCollapsed ? "justify-center" : ""}
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon
                          className={`h-5 w-5 shrink-0 ${
                            isActive ? "text-primary" : ""
                          }`}
                        />
                        <span
                          className={`whitespace-nowrap transition-all duration-300 ${
                            isCollapsed ? "opacity-0 w-0 hidden" : "opacity-100"
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  {isCollapsed && (
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        {/* Collapse Toggle Button (Desktop Only) */}
        <div className="hidden lg:flex justify-end p-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div
          className={`p-4 border-t border-gray-200 dark:border-gray-700 ${
            isCollapsed ? "items-center" : ""
          }`}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-3 px-2 py-2 mb-2 animate-in fade-in duration-300">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                {user?.email?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-sm font-medium truncate text-gray-900 dark:text-white">
                  {user?.email || "User"}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {role || "Loading..."}
                </p>
              </div>
            </div>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full ${
                    isCollapsed ? "justify-center px-2" : "justify-start gap-2"
                  } text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100 transition-all`}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  {!isCollapsed && <span>Keluar</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">Keluar</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 lg:px-8 justify-between lg:justify-end sticky top-0 z-30">
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
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
