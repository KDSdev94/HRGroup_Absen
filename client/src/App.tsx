import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import FirebaseErrorBoundary from "@/components/FirebaseErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Scan from "@/pages/Scan";
import Reports from "@/pages/Reports";
import AttendanceHistory from "@/pages/AttendanceHistory";
import Admins from "@/pages/Admins";
import EmployeeUsers from "@/pages/EmployeeUsers";
import DataCleanup from "@/pages/DataCleanup";
import Profile from "@/pages/Profile";
import Layout from "@/components/Layout";
import { UserProvider } from "./contexts/UserContext";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={Dashboard} />

        {/* Admin-only routes */}
        <Route path="/employees">
          <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
            <Employees />
          </ProtectedRoute>
        </Route>
        <Route path="/reports">
          <ProtectedRoute allowedRoles={["superadmin", "admin"]}>
            <Reports />
          </ProtectedRoute>
        </Route>

        {/* Superadmin-only routes */}
        <Route path="/admins">
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <Admins />
          </ProtectedRoute>
        </Route>
        <Route path="/employee-users">
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <EmployeeUsers />
          </ProtectedRoute>
        </Route>
        <Route path="/data-cleanup">
          <ProtectedRoute allowedRoles={["superadmin"]}>
            <DataCleanup />
          </ProtectedRoute>
        </Route>

        {/* Employee-only routes */}
        <Route path="/scan">
          <ProtectedRoute allowedRoles={["employee"]}>
            <Scan />
          </ProtectedRoute>
        </Route>
        <Route path="/attendance-history">
          <ProtectedRoute allowedRoles={["employee"]}>
            <AttendanceHistory />
          </ProtectedRoute>
        </Route>
        <Route path="/profile">
          <ProtectedRoute allowedRoles={["employee"]}>
            <Profile />
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hrgroup-attendance-theme">
      <FirebaseErrorBoundary>
        <UserProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </QueryClientProvider>
        </UserProvider>
      </FirebaseErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
