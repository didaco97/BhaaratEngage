import { Calendar, Download } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageStateCard from "@/components/PageStateCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { hasRoleAtLeast } from "@/lib/access-control";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export default function Reports() {
  const { viewer } = useCurrentViewer();
  const reportsQuery = useQuery({
    queryKey: queryKeys.reports,
    queryFn: api.getReportsSnapshot,
  });
  const exportMutation = useMutation({
    mutationFn: api.exportReports,
    onSuccess: () => {
      toast({
        title: "Report export ready",
        description: "The reporting snapshot was downloaded as a CSV file.",
      });
    },
    onError: (error) => {
      toast({
        title: "Report export failed",
        description: error instanceof Error ? error.message : "The reporting export could not be created.",
        variant: "destructive",
      });
    },
  });
  const reports = reportsQuery.data;

  const overview = reports?.overview;
  const dailyVolume = reports?.dailyVolume ?? [];
  const fieldDropoff = reports?.fieldDropoff ?? [];
  const providerPerformance = reports?.providerPerformance ?? [];
  const dispositionBreakdown = reports?.dispositionBreakdown ?? [];
  const canExportReports = hasRoleAtLeast(viewer?.role, "reviewer");
  const providerHealthValues = providerPerformance.flatMap((point) =>
    [point.plivo, point.exotel].filter((value): value is number => typeof value === "number"),
  );
  const providerHealthDomain =
    providerHealthValues.length > 0
      ? [
          Math.max(0, Math.floor(Math.min(...providerHealthValues) - 2)),
          Math.min(100, Math.ceil(Math.max(...providerHealthValues) + 1)),
        ]
      : [0, 100];

  if (providerHealthDomain[0] === providerHealthDomain[1]) {
    providerHealthDomain[0] = Math.max(0, providerHealthDomain[0] - 2);
    providerHealthDomain[1] = Math.min(100, providerHealthDomain[1] + 2);
  }

  if (reportsQuery.isPending && !reports) {
    return (
      <PageStateCard
        title="Loading reports"
        description="Fetching answer rates, drop-off analysis, provider health, and export posture."
      />
    );
  }

  if (reportsQuery.error) {
    return (
      <PageStateCard
        title="Reports unavailable"
        description={reportsQuery.error instanceof Error ? reportsQuery.error.message : "Reporting data could not be loaded."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-eyebrow">Reporting and exports</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              Analytics now emphasize the v1 success metrics that matter for launch quality and auditability.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Instead of generic chart panels, the reporting surface tracks completion, confirmation, field drop-off,
              provider reliability, and export readiness the way your PRD describes them.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Select defaultValue="7d">
              <SelectTrigger className="w-[180px] gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            {canExportReports ? (
              <Button variant="outline" className="gap-2" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? "Exporting..." : "Export report"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {[
            { label: "Answer rate", value: overview ? `${overview.avgAnswerRate}%` : "--" },
            { label: "Completion", value: overview ? `${overview.avgCompletionRate}%` : "--" },
            { label: "Confirmed", value: overview ? `${overview.avgConfirmationRate}%` : "--" },
            { label: "Opt-out", value: overview ? `${overview.optOutRate}%` : "--" },
            { label: "Transfer", value: overview ? `${overview.transferRate}%` : "--" },
          ].map((item) => (
            <div key={item.label} className="inset-surface rounded-[24px] p-5 text-center">
              <p className="section-eyebrow">{item.label}</p>
              <p className="metric-value mt-4 text-4xl text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[32px]">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-eyebrow">Field drop-off</p>
              <CardTitle className="mt-3 text-2xl">Where completion slows down</CardTitle>
            </div>
            <Badge variant="secondary">KYC campaign sample</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldDropoff} layout="vertical" margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="field"
                    axisLine={false}
                    tickLine={false}
                    width={100}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(255,255,255,0.72)",
                      borderRadius: "20px",
                      background: "rgba(255,255,255,0.94)",
                    }}
                  />
                  <Bar dataKey="captured" fill="hsl(var(--chart-2))" radius={[0, 10, 10, 0]} name="Captured %" />
                  <Bar dataKey="dropped" fill="hsl(var(--chart-5))" radius={[0, 10, 10, 0]} name="Dropped %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Provider health</p>
            <CardTitle className="mt-3 text-2xl">Reliability by provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={providerPerformance} margin={{ top: 8, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  />
                  <YAxis
                    domain={providerHealthDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(255,255,255,0.72)",
                      borderRadius: "20px",
                      background: "rgba(255,255,255,0.94)",
                    }}
                  />
                  <Line type="monotone" dataKey="exotel" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="plivo" stroke="hsl(var(--chart-3))" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Volume and completion</p>
            <CardTitle className="mt-3 text-2xl">Attempts versus outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyVolume} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.16)" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "JetBrains Mono" }}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid rgba(255,255,255,0.72)",
                      borderRadius: "20px",
                      background: "rgba(255,255,255,0.94)",
                    }}
                  />
                  <Bar dataKey="calls" fill="hsl(var(--chart-1))" radius={[12, 12, 0, 0]} name="Total calls" />
                  <Bar dataKey="answered" fill="hsl(var(--chart-2))" radius={[12, 12, 0, 0]} name="Answered" />
                  <Bar dataKey="completed" fill="hsl(var(--chart-3))" radius={[12, 12, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Export readiness</p>
            <CardTitle className="mt-3 text-2xl">Outcome mix and audit posture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dispositionBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-[22px] bg-white/65 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm font-medium text-foreground">{item.name}</span>
                </div>
                <span className="metric-value text-2xl text-foreground">{item.value}%</span>
              </div>
            ))}

            <div className="rounded-[24px] bg-primary/8 p-5">
              <p className="text-base font-semibold text-foreground">Why this layout matters</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Field drop-off highlights script or validation friction.</li>
                <li>Provider uptime supports routing decisions before quality drops.</li>
                <li>Export and disposition views stay close together for audit review.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
