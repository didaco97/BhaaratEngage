import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");

  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => {
      if (!isValidElement(children)) {
        return null;
      }

      return cloneElement(children as ReactElement<{ width?: number; height?: number }>, { width: 960, height: 320 });
    },
  };
});

import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGate from "@/components/AuthGate";
import AppLayout from "@/components/AppLayout";
import RequireRole from "@/components/RequireRole";
import CallRecords from "@/pages/CallRecords";
import CampaignBuilder from "@/pages/CampaignBuilder";
import CampaignDetail from "@/pages/CampaignDetail";
import Campaigns from "@/pages/Campaigns";
import Contacts from "@/pages/Contacts";
import Dashboard from "@/pages/Dashboard";
import Journeys from "@/pages/Journeys";
import Landing from "@/pages/Landing";
import NotFound from "@/pages/NotFound";
import Reports from "@/pages/Reports";
import SettingsPage from "@/pages/Settings";

function renderRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter
          initialEntries={[initialEntry]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
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
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("application routes", () => {
  it("renders the landing page", async () => {
    renderRoute("/");

    expect(
      await screen.findByText(/clean, calm product design for voice journeys, data capture, and operational control/i),
    ).toBeInTheDocument();
  });

  it("renders the dashboard route inside the app layout", async () => {
    renderRoute("/dashboard");

    expect(await screen.findByText(/keep launches, verification quality, and sensitive-data handling/i)).toBeInTheDocument();
    expect(screen.getAllByText(/bharatvaani engage/i).length).toBeGreaterThan(0);
  });

  it("renders the campaign detail route with route params", async () => {
    renderRoute("/campaigns/camp-001");

    expect(await screen.findByText(/kyc verification drive - mumbai/i)).toBeInTheDocument();
    expect(await screen.findByText(/collection schema/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /edit campaign/i })).toBeInTheDocument();
  });

  it("renders the other operational routes without crashing", async () => {
    const routeAssertions = [
      { path: "/campaigns", text: /campaign cards are now structured around launch readiness/i },
      { path: "/campaigns/new", text: /progressive disclosure keeps complex setup calm/i },
      { path: "/contacts", text: /csv uploads, consent state, suppression, and quiet-hour eligibility/i },
      { path: "/journeys", text: /voice remains the lead channel/i },
      { path: "/call-records", text: /records are easier to scan now/i },
      { path: "/reports", text: /analytics now emphasize the v1 success metrics/i },
      { path: "/settings", text: /governance, defaults, and integrations now live in a cleaner admin surface/i },
      { path: "/missing-route", text: /page not found/i },
    ];

    for (const { path, text } of routeAssertions) {
      const { unmount } = renderRoute(path);
      expect(await screen.findByText(text)).toBeInTheDocument();
      unmount();
    }
  });
});
