import { ArrowRight, Gauge, MessageCircle, MessageSquare, Phone, TimerReset } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import PageStateCard from "@/components/PageStateCard";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const channelIcons = {
  Voice: Phone,
  SMS: MessageSquare,
  WhatsApp: MessageCircle,
};

function getChannelIcon(step: string) {
  const entry = Object.entries(channelIcons).find(([channel]) => step.includes(channel));
  return entry?.[1] ?? Phone;
}

export default function Journeys() {
  const journeysQuery = useQuery({
    queryKey: queryKeys.journeys,
    queryFn: api.listJourneys,
  });
  const journeys = journeysQuery.data ?? [];

  if (journeysQuery.isPending && !journeysQuery.data) {
    return (
      <PageStateCard
        title="Loading journeys"
        description="Fetching orchestration state, retry windows, pacing, and next checkpoints."
      />
    );
  }

  if (journeysQuery.error) {
    return (
      <PageStateCard
        title="Journey monitor unavailable"
        description={journeysQuery.error instanceof Error ? journeysQuery.error.message : "Journey data could not be loaded."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="max-w-3xl">
          <p className="section-eyebrow">Journey orchestration</p>
          <h2 className="page-hero-title mt-4 font-semibold text-foreground">
            Voice remains the lead channel, while follow-up branches stay explicit and easy to reason about.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            The redesigned journey page focuses on what the PRD calls for: sequenced outcomes, retry windows,
            concurrency, pacing, and the next checkpoint for every active campaign.
          </p>
        </div>
      </section>

      <div className="space-y-4">
        {journeys.map((journey) => {
          const completion = (journey.processed / Math.max(journey.totalContacts, 1)) * 100;

          return (
            <Card key={journey.id} className="rounded-[32px]">
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="section-eyebrow">Journey plan</p>
                      <StatusBadge status={journey.status} />
                    </div>
                    <CardTitle className="mt-3 text-[1.9rem]">{journey.campaignName}</CardTitle>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                      Sequence logic stays tied to campaign outcomes so operators can see exactly what happens after each
                      unanswered, partial, or completed interaction.
                    </p>
                  </div>

                  <div className="rounded-[24px] bg-white/65 px-5 py-4 text-right">
                    <p className="text-sm text-muted-foreground">Success rate</p>
                    <p className="metric-value mt-2 text-4xl text-foreground">{journey.successRate}%</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="inset-surface rounded-[24px] p-5">
                    <p className="section-eyebrow">Retry window</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                        <TimerReset className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{journey.retryWindowHours} hours</p>
                        <p className="text-sm text-muted-foreground">Before the next follow-up action</p>
                      </div>
                    </div>
                  </div>

                  <div className="inset-surface rounded-[24px] p-5">
                    <p className="section-eyebrow">Concurrency</p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-accent/10 text-accent">
                        <Gauge className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">{journey.concurrencyLimit} active jobs</p>
                        <p className="text-sm text-muted-foreground">{journey.pacingPerMinute} calls per minute pacing</p>
                      </div>
                    </div>
                  </div>

                  <div className="inset-surface rounded-[24px] p-5">
                    <p className="section-eyebrow">Next checkpoint</p>
                    <p className="mt-4 text-lg font-semibold text-foreground">{journey.nextCheckpoint}</p>
                    <p className="mt-2 text-sm text-muted-foreground">Operators review the next checkpoint instead of guessing the schedule.</p>
                  </div>
                </div>

                <div className="rounded-[26px] bg-white/65 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="section-eyebrow">Progress</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {journey.processed.toLocaleString()} of {journey.totalContacts.toLocaleString()} contacts processed.
                      </p>
                    </div>
                    <Badge variant="secondary">{Math.round(completion)}% complete</Badge>
                  </div>
                  <div className="mt-4">
                    <Progress value={completion} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  {journey.sequence.map((step, index) => {
                    const Icon = getChannelIcon(step);

                    return (
                      <div key={`${journey.id}-${step}`} className="flex items-center gap-2">
                        <div className="flex items-center gap-3 rounded-[20px] bg-white/70 px-4 py-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-foreground text-background">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{step}</p>
                            <p className="text-xs text-muted-foreground">Outcome-based action</p>
                          </div>
                        </div>

                        {index < journey.sequence.length - 1 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {journeys.length === 0 ? (
          <Card className="rounded-[32px]">
            <CardContent className="py-16 text-center">
              <p className="text-lg font-semibold text-foreground">No journeys are active right now.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Journey orchestration summaries will appear here once campaigns are launched.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
