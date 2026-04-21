import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FileDown,
  PhoneCall,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";

import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PageStateCard from "@/components/PageStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api-client";
import { formatDuration, formatProvider } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: api.getDashboardSnapshot,
  });
  const dashboard = dashboardQuery.data;

  const overview = dashboard?.overview;
  const activeCampaigns = dashboard?.liveCampaigns ?? [];
  const voiceThroughput = dashboard?.voiceThroughput ?? [];
  const complianceAlerts = dashboard?.complianceAlerts ?? [];
  const transferQueues = dashboard?.transferQueues ?? [];
  const auditEvents = dashboard?.auditEvents ?? [];
  const dispositionBreakdown = dashboard?.dispositionBreakdown ?? [];
  const recentAttempts = dashboard?.recentAttempts ?? [];

  if (dashboardQuery.isPending && !dashboard) {
    return (
      <PageStateCard
        title="Loading dashboard"
        description="Fetching launch metrics, live campaign performance, and operational activity."
      />
    );
  }

  if (dashboardQuery.error) {
    return (
      <PageStateCard
        title="Dashboard unavailable"
        description={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Dashboard data could not be loaded."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-strong overflow-hidden rounded-[34px] p-6 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Badge variant="secondary" className="gap-2">
              <span className="h-2 w-2 rounded-full bg-success" />
              Live command center
            </Badge>

            <h2 className="page-hero-title mt-6 max-w-2xl font-semibold text-foreground">
              Keep launches, verification quality, and sensitive-data handling in one calm view.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground">
              The dashboard is now organized around the PRD priorities: active campaigns, completion quality, export
              readiness, provider health, and the operational events that need attention right now.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/campaigns/new">
                <Button className="gap-2">
                  Create campaign
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="outline">Open reports</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Total attempts",
                value: overview ? overview.totalCalls.toLocaleString() : "--",
                note: "All voice and follow-up attempts stay recorded, not only completed calls.",
              },
              {
                label: "Average handling",
                value: overview ? `${Math.floor(overview.avgHandlingTime / 60)}m ${overview.avgHandlingTime % 60}s` : "--",
                note: "Call time stays short while still leaving room for read-back and correction.",
              },
              {
                label: "Audit events today",
                value: overview ? overview.auditEventsToday : "--",
                note: "Launches, exports, transcript views, and pauses remain visible to reviewers.",
              },
              {
                label: "Masked exports",
                value: overview ? overview.maskedExportsToday : "--",
                note: "Sensitive values stay hidden by default across CSV and operational review views.",
              },
            ].map((item) => (
              <div key={item.label} className="inset-surface rounded-[24px] p-5">
                <p className="section-eyebrow">{item.label}</p>
                <p className="metric-value mt-4 text-4xl text-foreground">{item.value}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active campaigns"
          value={overview?.activeCampaigns ?? 0}
          subtitle={`${overview?.totalCampaigns ?? 0} campaigns in workspace`}
          icon={Activity}
          trend={{ value: 12, positive: true }}
          variant="primary"
        />
        <StatCard
          label="Contacts ready"
          value={(overview?.totalContacts ?? 0).toLocaleString()}
          subtitle="Policy-checked contacts available for current campaigns"
          icon={Users}
        />
        <StatCard
          label="Confirmed data"
          value={`${overview?.avgConfirmationRate ?? 0}%`}
          subtitle="Read-back confirmation across completed journeys"
          icon={CheckCircle2}
          trend={{ value: 4.1, positive: true }}
          variant="accent"
        />
        <StatCard
          label="Opt-out rate"
          value={`${overview?.optOutRate ?? 0}%`}
          subtitle="Suppression and consent controls remain within threshold"
          icon={ShieldCheck}
          variant="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-[32px]">
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow">Voice throughput</p>
              <CardTitle className="mt-3 text-2xl">Attempts, answered calls, and completed collections</CardTitle>
            </div>
            <Badge variant="secondary">Last 10 days</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] sm:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={voiceThroughput} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(255,255,255,0.72)",
                      borderRadius: "20px",
                      background: "rgba(255,255,255,0.94)",
                      boxShadow: "0 24px 80px -40px rgba(15,23,42,0.3)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#callsGradient)"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--chart-1))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="hsl(var(--chart-2))"
                    fill="url(#completedGradient)"
                    strokeWidth={2.2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--chart-2))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">Attention queue</p>
              <CardTitle className="mt-3 text-2xl">Current alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {complianceAlerts.map((alert) => (
                <div key={`${alert.title}-${alert.detail}`} className="inset-surface rounded-[22px] p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                        alert.severity === "warning"
                          ? "bg-warning/[0.12] text-warning"
                          : alert.severity === "risk"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-info/10 text-info"
                      }`}
                    >
                      <CircleAlert className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
              {complianceAlerts.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border/70 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  Provider health, quiet hours, and export readiness are currently clear.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">Transfer queues</p>
              <CardTitle className="mt-3 text-2xl">Human handoff coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transferQueues.map((queue) => (
                <div key={queue.queue} className="flex items-center justify-between rounded-[22px] bg-white/65 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{queue.queue}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Current SLA {queue.sla}</p>
                  </div>
                  <div className="text-right">
                    <p className="metric-value text-3xl text-foreground">{queue.waiting}</p>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">waiting</p>
                  </div>
                </div>
              ))}
              {transferQueues.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-border/70 px-4 py-5 text-sm leading-6 text-muted-foreground">
                  Transfer queue metrics will appear here once human handoffs start flowing.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[32px]">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow">Live campaigns</p>
              <CardTitle className="mt-3 text-2xl">Voice-first launches in progress</CardTitle>
            </div>
            <Link to="/campaigns">
              <Button variant="outline" size="sm">
                View all campaigns
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeCampaigns.map((campaign) => (
              <div key={campaign.id} className="inset-surface rounded-[24px] p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                      <StatusBadge status={campaign.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{campaign.summary}</p>
                  </div>

                  <Link to={`/campaigns/${campaign.id}`}>
                    <Button variant="secondary" size="sm">
                      Open details
                    </Button>
                  </Link>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Answer", value: `${campaign.answerRate}%` },
                    { label: "Completion", value: `${campaign.completionRate}%` },
                    { label: "Confirmed", value: `${campaign.confirmationRate}%` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[20px] bg-white/70 px-4 py-3">
                      <p className="text-sm text-muted-foreground">{item.label}</p>
                      <p className="metric-value mt-2 text-3xl text-foreground">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">Recent audit log</p>
              <CardTitle className="mt-3 text-2xl">Operational activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {auditEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-[22px] bg-white/65 px-4 py-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                    <FileDown className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{event.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {event.actor} on {event.entity}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{event.time}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">Recent outcomes</p>
              <CardTitle className="mt-3 text-2xl">Call dispositions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-[0.95fr_1.05fr] sm:items-center">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dispositionBreakdown}
                        dataKey="value"
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {dispositionBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value}%`, "Share"]}
                        contentStyle={{
                          border: "1px solid rgba(255,255,255,0.72)",
                          borderRadius: "20px",
                          background: "rgba(255,255,255,0.94)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {dispositionBreakdown.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-[20px] bg-white/65 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                      </div>
                      <span className="metric-value text-2xl text-foreground">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-[32px]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">Recent attempts</p>
            <CardTitle className="mt-3 text-2xl">Latest call activity</CardTitle>
          </div>
          <Link to="/call-records">
            <Button variant="outline" size="sm">
              Open call records
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 hover:bg-transparent">
                <TableHead className="px-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">Contact</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Campaign</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Provider</TableHead>
                <TableHead className="text-right pr-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Duration
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentAttempts.length > 0 ? (
                recentAttempts.map((record) => (
                  <TableRow key={record.id} className="border-white/50 hover:bg-white/35">
                    <TableCell className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{record.contactName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{record.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{record.campaignName}</TableCell>
                    <TableCell>
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-sm text-foreground">
                        <PhoneCall className="h-4 w-4 text-primary" />
                        {formatProvider(record.provider)}
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                      {formatDuration(record.durationSeconds)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-white/50">
                  <TableCell colSpan={5} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    Recent call activity will appear here once attempt data is available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
