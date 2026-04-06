import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
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
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/new" element={<CampaignBuilder />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/journeys" element={<Journeys />} />
            <Route path="/call-records" element={<CallRecords />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
