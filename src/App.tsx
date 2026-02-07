import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth-context";
import { TenantProvider } from "@/lib/tenant-context";
import ProtectedRoute from "@/components/ProtectedRoute";
import TenantGuard from "@/components/TenantGuard";
import DashboardLayout from "@/components/DashboardLayout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ResetPassword from "@/pages/ResetPassword";
import UpdatePassword from "@/pages/UpdatePassword";
import AcceptInvite from "@/pages/AcceptInvite";
import Onboarding from "@/pages/Onboarding";
import SelectTenant from "@/pages/SelectTenant";
import Dashboard from "@/pages/Dashboard";
import Members from "@/pages/Members";
import Invites from "@/pages/Invites";
import Settings from "@/pages/Settings";
import AuditLog from "@/pages/AuditLog";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/invite/:token" element={<AcceptInvite />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/select-tenant" element={<SelectTenant />} />

                <Route element={<TenantGuard />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/invites" element={<Invites />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/audit" element={<AuditLog />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
