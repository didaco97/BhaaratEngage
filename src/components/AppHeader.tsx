import { Bell, Search, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const pageMeta: Record<string, { eyebrow: string; title: string; sub: string }> = {
  "/dashboard": {
    eyebrow: "Workspace overview",
    title: "BharatVaani Engage",
    sub: "Monitor live campaigns, verification quality, exports, and operational health in one place.",
  },
  "/campaigns": {
    eyebrow: "Campaign management",
    title: "Campaign workspace",
    sub: "Build template-led journeys, monitor launches, and review field capture quality.",
  },
  "/campaigns/new": {
    eyebrow: "Campaign builder",
    title: "Design a new campaign",
    sub: "Configure scripts, schema, policy controls, and launch sequencing before upload.",
  },
  "/contacts": {
    eyebrow: "Contact operations",
    title: "Contact ledger",
    sub: "Review consent, suppression, quiet-hour eligibility, and CSV ingestion health.",
  },
  "/journeys": {
    eyebrow: "Journey orchestration",
    title: "Sequence control",
    sub: "Track voice-first journeys and the follow-up branches that recover incomplete outcomes.",
  },
  "/call-records": {
    eyebrow: "Call intelligence",
    title: "Attempt records",
    sub: "Inspect dispositions, transcript access, provider performance, and confirmation outcomes.",
  },
  "/reports": {
    eyebrow: "Analytics and exports",
    title: "Performance reports",
    sub: "Compare answer rates, field drop-off, provider health, and export readiness over time.",
  },
  "/settings": {
    eyebrow: "Workspace controls",
    title: "Settings and governance",
    sub: "Manage roles, security defaults, notifications, and webhooks for the shared tenant.",
  },
};

function resolveMeta(pathname: string) {
  const matchedEntry = Object.entries(pageMeta)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname === path || pathname.startsWith(`${path}/`));

  return matchedEntry?.[1] ?? pageMeta["/dashboard"];
}

export default function AppHeader() {
  const location = useLocation();
  const meta = resolveMeta(location.pathname);

  return (
    <header className="panel-strong sticky top-4 z-30 rounded-[32px] px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="section-eyebrow">{meta.eyebrow}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="page-chrome-title font-semibold text-foreground">{meta.title}</h1>
            <Badge variant="secondary" className="gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              India workspace
            </Badge>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">{meta.sub}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="relative min-w-[220px] max-w-[320px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search campaigns, contacts, or calls" className="pl-10" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="bg-white/40">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Command center
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
