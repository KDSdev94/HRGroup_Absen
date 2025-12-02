import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import FirebaseErrorBoundary from "@/components/FirebaseErrorBoundary";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Scan from "@/pages/Scan";
import Reports from "@/pages/Reports";
import AttendanceHistory from "@/pages/AttendanceHistory";
import Admins from "@/pages/Admins";
import Profile from "@/pages/Profile";
import Layout from "@/components/Layout";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/" component={Dashboard} />
        <Route path="/employees" component={Employees} />
        <Route path="/scan" component={Scan} />
        <Route path="/reports" component={Reports} />
        <Route path="/attendance-history" component={AttendanceHistory} />
        <Route path="/profile" component={Profile} />
        <Route path="/admins" component={Admins} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="hrgroup-attendance-theme">
      <FirebaseErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </FirebaseErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
