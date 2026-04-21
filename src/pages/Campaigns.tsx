import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter, Plus, Search, Shield, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import StatusBadge from "@/components/StatusBadge";
import PageStateCard from "@/components/PageStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { formatLabel } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";

export default function Campaigns() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const campaignInventoryQuery = useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => api.listCampaigns(),
  });
  const filteredQuery = useQuery({
    queryKey: queryKeys.campaigns({ search, status: statusFilter }),
    queryFn: () => api.listCampaigns({ search, status: statusFilter as "all" | "active" | "paused" | "completed" | "draft" }),
  });
  const campaignInventory = campaignInventoryQuery.data ?? [];
  const filtered = filteredQuery.data ?? [];
  const pageError = campaignInventoryQuery.error ?? filteredQuery.error;

  if (campaignInventoryQuery.isPending && !campaignInventoryQuery.data) {
    return (
      <PageStateCard
        title="Loading campaigns"
        description="Fetching campaign inventory, launch status, and field architecture summaries."
      />
    );
  }

  if (pageError) {
    return (
      <PageStateCard
        title="Campaign workspace unavailable"
        description={pageError instanceof Error ? pageError.message : "Campaign data could not be loaded."}
      />
    );
  }

  const activeCount = campaignInventory.filter((campaign) => campaign.status === "active").length;
  const draftCount = campaignInventory.filter((campaign) => campaign.status === "draft").length;
  const averageCompletion =
    campaignInventory.reduce((total, campaign) => total + campaign.completionRate, 0) / Math.max(campaignInventory.length, 1);

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Template-led campaign workspace
            </Badge>
            <h2 className="page-hero-title mt-6 font-semibold text-foreground">
              Campaign cards are now structured around launch readiness, field collection, and journey quality.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              Each campaign surface mirrors the PRD: template metadata, field schema depth, sensitive-field markers,
              orchestration sequence, and completion performance all stay visible before you open the detail page.
            </p>
          </div>

          <Link to="/campaigns/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-4 w-4" />
              New campaign
            </Button>
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { label: "Active campaigns", value: activeCount, note: "Currently running across voice and follow-up messaging." },
            { label: "Drafts awaiting review", value: draftCount, note: "Drafts often wait on CSV upload, compliance, or field review." },
            { label: "Average completion", value: `${averageCompletion.toFixed(1)}%`, note: "Measured after read-back and confirmation handling." },
          ].map((item) => (
            <div key={item.label} className="inset-surface rounded-[24px] p-5">
              <p className="section-eyebrow">{item.label}</p>
              <p className="metric-value mt-4 text-4xl text-foreground">{item.value}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="rounded-[32px]">
        <CardHeader className="gap-4">
          <div>
            <p className="section-eyebrow">Filter and search</p>
            <CardTitle className="mt-3 text-2xl">Explore campaign inventory</CardTitle>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by campaign, vertical, or template"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {filtered.map((campaign) => (
          <Card key={campaign.id} className="rounded-[32px]">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-[1.6rem]">{campaign.name}</CardTitle>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{campaign.summary}</p>
                </div>

                <Link to={`/campaigns/${campaign.id}`}>
                  <Button variant="secondary" size="sm">
                    Open campaign
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{campaign.template}</Badge>
                <Badge variant="secondary">{formatLabel(campaign.vertical)}</Badge>
                <Badge variant="secondary">{formatLabel(campaign.language)}</Badge>
                <Badge variant="secondary">{campaign.workspace}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Contacts", value: campaign.contactCount.toLocaleString() },
                  { label: "Answer rate", value: `${campaign.answerRate}%` },
                  { label: "Completion", value: `${campaign.completionRate}%` },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] bg-white/65 px-4 py-3">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                    <p className="metric-value mt-2 text-3xl text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
                <div className="inset-surface rounded-[24px] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="section-eyebrow">Journey sequence</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Voice remains primary, with follow-up branches tied to disposition outcomes.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {campaign.sequence.map((step) => (
                      <span
                        key={step}
                        className="inline-flex items-center rounded-full bg-white/70 px-3 py-2 text-sm font-medium text-foreground"
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="inset-surface rounded-[24px] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="section-eyebrow">Field architecture</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Linear collection steps with explicit retries and verification labels.
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Total fields</span>
                      <span className="font-semibold text-foreground">{campaign.fields.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Sensitive fields</span>
                      <span className="font-semibold text-foreground">{campaign.sensitiveFieldCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Quiet hours</span>
                      <span className="font-semibold text-foreground">{campaign.quietHours}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Completion quality</span>
                    <span>{campaign.completionRate}%</span>
                  </div>
                  <Progress value={campaign.completionRate} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Confirmation quality</span>
                    <span>{campaign.confirmationRate}%</span>
                  </div>
                  <Progress value={campaign.confirmationRate} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-[32px]">
          <CardContent className="py-16 text-center">
            <p className="text-lg font-semibold text-foreground">No campaigns match your current filters.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try clearing the search or switching the status filter to review the full workspace inventory.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
