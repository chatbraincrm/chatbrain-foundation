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
import Pipelines from "@/pages/crm/Pipelines";
import Leads from "@/pages/crm/Leads";
import LeadDetail from "@/pages/crm/LeadDetail";
import Companies from "@/pages/crm/Companies";
import CompanyDetail from "@/pages/crm/CompanyDetail";
import DealsKanban from "@/pages/crm/DealsKanban";
import DealDetail from "@/pages/crm/DealDetail";
import Tasks from "@/pages/crm/Tasks";
import Tags from "@/pages/crm/Tags";
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
                    {/* CRM Routes */}
                    <Route path="/crm/pipelines" element={<Pipelines />} />
                    <Route path="/crm/leads" element={<Leads />} />
                    <Route path="/crm/leads/:id" element={<LeadDetail />} />
                    <Route path="/crm/companies" element={<Companies />} />
                    <Route path="/crm/companies/:id" element={<CompanyDetail />} />
                    <Route path="/crm/deals" element={<DealsKanban />} />
                    <Route path="/crm/deals/:id" element={<DealDetail />} />
                    <Route path="/crm/tasks" element={<Tasks />} />
                    <Route path="/crm/tags" element={<Tags />} />
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
