import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Flame,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  PhoneCall,
  Route,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { hasRoleAtLeast } from "@/lib/access-control";
import type { Role } from "@/lib/api-contracts";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", minimumRole: "viewer" },
  { to: "/campaigns", icon: Megaphone, label: "Campaigns", minimumRole: "viewer" },
  { to: "/contacts", icon: Users, label: "Contacts", minimumRole: "operator" },
  { to: "/journeys", icon: Route, label: "Journeys", minimumRole: "viewer" },
  { to: "/call-records", icon: PhoneCall, label: "Call records", minimumRole: "operator" },
  { to: "/reports", icon: BarChart3, label: "Reports", minimumRole: "viewer" },
  { to: "/settings", icon: Settings, label: "Settings", minimumRole: "workspace_admin" },
] satisfies Array<{ to: string; icon: LucideIcon; label: string; minimumRole: Role }>;

function isActivePath(currentPath: string, itemPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

export default function AppSidebar() {
  const location = useLocation();
  const { data: dashboard, viewer } = useCurrentViewer();

  const activeCampaigns = dashboard?.overview.activeCampaigns ?? 0;
  const totalCalls = dashboard?.overview.totalCalls ?? 0;
  const workspaceName = dashboard?.workspace.name ?? "Workspace";
  const visibleNavItems = navItems.filter((item) => hasRoleAtLeast(viewer?.role, item.minimumRole));

  return (
    <>
      <div className="mb-4 lg:hidden">
        <div className="panel-strong rounded-[30px] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-foreground text-background shadow-[0_18px_40px_-24px_rgba(15,23,42,0.7)]">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">BharatVaani Engage</p>
                <p className="text-sm text-muted-foreground">Voice-first India workspace</p>
              </div>
            </div>

            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {activeCampaigns} live
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {visibleNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    active ? "bg-foreground text-background" : "bg-white/55 text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="hidden lg:fixed lg:left-[max(1.75rem,calc((100vw-1600px)/2+1.75rem))] lg:top-6 lg:z-40 lg:block lg:h-[calc(100vh-3rem)] lg:w-[290px]">
        <div className="panel-strong flex h-full flex-col rounded-[34px] px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background shadow-[0_24px_60px_-34px_rgba(15,23,42,0.72)]">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">BharatVaani Engage</p>
              <p className="text-sm text-muted-foreground">Structured outreach for India</p>
            </div>
          </div>

          <div className="mt-5 rounded-[22px] bg-white/55 px-4 py-3">
            <p className="section-eyebrow">Workspace</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{workspaceName}</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {activeCampaigns} live
              </span>
            </div>
          </div>

          <nav className="mt-5 flex-1 space-y-2 overflow-y-auto pr-1">
            {visibleNavItems.map((item) => {
              const active = isActivePath(location.pathname, item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition-all",
                    active
                      ? "bg-foreground text-background shadow-[0_18px_40px_-26px_rgba(15,23,42,0.65)]"
                      : "text-sidebar-foreground hover:bg-white/55 hover:text-foreground",
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !active && "text-muted-foreground group-hover:text-foreground")} />
                  <span>{item.label}</span>
                  {active ? <span className="ml-auto h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="space-y-3 pt-4">
            <div className="panel-subtle rounded-[24px] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                  <Activity className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Launch pacing is healthy</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {totalCalls.toLocaleString()} attempts logged with quiet-hour controls active.
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-subtle rounded-[24px] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-success/10 text-success">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Security defaults on</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Sensitive values stay encrypted and exports remain masked across every workspace.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
