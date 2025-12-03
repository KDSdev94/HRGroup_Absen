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
      label: "User Peserta",
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:flex">
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
          ${isCollapsed ? "lg:w-20" : "lg:w-64"}
          w-64
          flex-col relative
          hidden lg:flex
          ${sidebarOpen ? "!flex" : ""}
        `}
      >
        <div
          className={`h-16 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 transition-all duration-300 dark:bg-white dark:text-gray-900 ${
            isCollapsed ? "lg:px-2" : "lg:px-6"
          } px-4`}
        >
          <div className="flex items-center justify-center overflow-hidden w-full">
            <img
              src={isCollapsed ? "/logo.png" : "/header.webp"}
              alt="HR Group Attendance"
              className={`transition-all duration-300 object-contain ${
                isCollapsed ? "lg:h-10 lg:w-10 h-12" : "h-12"
              }`}
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

        <nav className="p-2 sm:p-3 space-y-1 flex-1 overflow-y-auto">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <div
                        className={`
                          flex items-center gap-3 px-3 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer
                          ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          }
                          ${isCollapsed ? "lg:justify-center" : ""}
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
                            isCollapsed ? "lg:opacity-0 lg:w-0 lg:hidden" : "opacity-100"
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

        {/* Collapse Toggle Button - Floating in Center (Desktop Only) */}
        <div className="hidden lg:block absolute top-1/2 -right-5 transform -translate-y-1/2 z-50">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="h-8 w-8 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div
          className={`p-3 sm:p-4 border-t border-gray-200 dark:border-gray-700 ${
            isCollapsed ? "lg:items-center" : ""
          }`}
        >
          <div className={`flex items-center gap-3 px-2 py-2 mb-2 animate-in fade-in duration-300 ${
            isCollapsed ? "lg:hidden" : ""
          }`}>
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

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-100 transition-all ${
                    isCollapsed ? "lg:justify-center lg:px-2 justify-start gap-2" : "justify-start gap-2"
                  }`}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className={isCollapsed ? "lg:hidden" : ""}> Keluar</span>
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
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300 w-full overflow-hidden">
        <header className="h-14 sm:h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 sm:px-4 lg:px-8 justify-between lg:justify-end sticky top-0 z-30">
          <button
            className="lg:hidden p-1.5 sm:p-2 -ml-1.5 sm:-ml-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          <div className="hidden lg:flex items-center gap-4 text-xs sm:text-sm text-gray-500">
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

        <main className="flex-1 p-3 sm:p-4 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
