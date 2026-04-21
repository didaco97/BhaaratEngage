import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AuthGate from "@/components/AuthGate";
import RequireRole from "@/components/RequireRole";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignBuilder from "./pages/CampaignBuilder";
import CampaignDetail from "./pages/CampaignDetail";
import Contacts from "./pages/Contacts";
import Journeys from "./pages/Journeys";
import CallRecords from "./pages/CallRecords";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AuthGate />}>
            <Route element={<AppLayout />}>
              <Route
                path="/dashboard"
                element={
                  <RequireRole minimumRole="viewer">
                    <Dashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/campaigns"
                element={
                  <RequireRole minimumRole="viewer">
                    <Campaigns />
                  </RequireRole>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <RequireRole minimumRole="campaign_manager">
                    <CampaignBuilder />
                  </RequireRole>
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <RequireRole minimumRole="viewer">
                    <CampaignDetail />
                  </RequireRole>
                }
              />
              <Route
                path="/contacts"
                element={
                  <RequireRole minimumRole="operator">
                    <Contacts />
                  </RequireRole>
                }
              />
              <Route
                path="/journeys"
                element={
                  <RequireRole minimumRole="viewer">
                    <Journeys />
                  </RequireRole>
                }
              />
              <Route
                path="/call-records"
                element={
                  <RequireRole minimumRole="operator">
                    <CallRecords />
                  </RequireRole>
                }
              />
              <Route
                path="/reports"
                element={
                  <RequireRole minimumRole="viewer">
                    <Reports />
                  </RequireRole>
                }
              />
              <Route
                path="/settings"
                element={
                  <RequireRole minimumRole="workspace_admin">
                    <SettingsPage />
                  </RequireRole>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
