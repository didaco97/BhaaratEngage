import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileText, Filter, Search } from "lucide-react";

import PageStateCard from "@/components/PageStateCard";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { hasRoleAtLeast } from "@/lib/access-control";
import { api } from "@/lib/api-client";
import { formatDateTime, formatLabel, formatProvider } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";

export default function CallRecords() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const { viewer } = useCurrentViewer();
  const activeStatusFilter = statusFilter as "all" | "in_progress" | "completed" | "no_answer" | "busy" | "failed" | "transferred";
  const callRecordInventoryQuery = useQuery({
    queryKey: queryKeys.callRecords(),
    queryFn: () => api.listCallRecords(),
  });
  const filteredQuery = useQuery({
    queryKey: queryKeys.callRecords({ search, status: statusFilter }),
    queryFn: () => api.listCallRecords({ search, status: activeStatusFilter }),
  });
  const exportMutation = useMutation({
    mutationFn: () => api.exportCallRecords({ search, status: activeStatusFilter }),
    onSuccess: () => {
      toast({
        title: "Call record export ready",
        description: "The current attempt review queue was downloaded as a CSV file.",
      });
    },
    onError: (error) => {
      toast({
        title: "Call record export failed",
        description: error instanceof Error ? error.message : "The call record export could not be created.",
        variant: "destructive",
      });
    },
  });
  const callRecordInventory = callRecordInventoryQuery.data ?? [];
  const filtered = filteredQuery.data ?? [];
  const pageError = callRecordInventoryQuery.error ?? filteredQuery.error;
  const selectedRecord = callRecordInventory.find((record) => record.id === selectedRecordId) ?? null;
  const transcriptQuery = useQuery({
    queryKey: selectedRecordId ? queryKeys.callTranscript(selectedRecordId) : ["call-transcript", "idle"],
    queryFn: () => api.getCallTranscript(selectedRecordId ?? ""),
    enabled: Boolean(selectedRecordId) && hasRoleAtLeast(viewer?.role, "reviewer"),
  });
  const collectedDataQuery = useQuery({
    queryKey: selectedRecordId ? ["call-data", selectedRecordId] : ["call-data", "idle"],
    queryFn: () => api.getCallCollectedData(selectedRecordId ?? ""),
    enabled: Boolean(selectedRecordId) && hasRoleAtLeast(viewer?.role, "reviewer"),
  });

  const completedCount = callRecordInventory.filter((record) => record.status === "completed").length;
  const transferredCount = callRecordInventory.filter((record) => record.status === "transferred").length;
  const failedCount = callRecordInventory.filter((record) => record.status === "failed").length;
  const restrictedCount = callRecordInventory.filter((record) => record.transcriptMode === "restricted").length;
  const canReviewArtifacts = hasRoleAtLeast(viewer?.role, "reviewer");

  if (callRecordInventoryQuery.isPending && !callRecordInventoryQuery.data) {
    return (
      <PageStateCard
        title="Loading call records"
        description="Fetching attempt history, transcript modes, and collected-field progress."
      />
    );
  }

  if (pageError) {
    return (
      <PageStateCard
        title="Call records unavailable"
        description={pageError instanceof Error ? pageError.message : "Call record data could not be loaded."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-eyebrow">Call intelligence</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              Records are easier to scan now, while transcript access still honors masking and review boundaries.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              The new layout surfaces disposition, field capture depth, confirmation, provider, and transcript mode
              without forcing operators to open every record to understand what happened.
            </p>
          </div>

          {canReviewArtifacts ? (
            <Button variant="outline" className="gap-2" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              <Download className="h-4 w-4" />
              {exportMutation.isPending ? "Exporting..." : "Export CSV"}
            </Button>
          ) : null}
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {[
            { label: "Completed", value: completedCount },
            { label: "Transferred", value: transferredCount },
            { label: "Failed", value: failedCount },
            { label: "Restricted transcripts", value: restrictedCount },
          ].map((item) => (
            <div key={item.label} className="inset-surface rounded-[24px] p-5">
              <p className="section-eyebrow">{item.label}</p>
              <p className="metric-value mt-4 text-4xl text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="rounded-[32px]">
        <CardHeader className="gap-4">
          <div>
            <p className="section-eyebrow">Filter and search</p>
            <CardTitle className="mt-3 text-2xl">Attempt review queue</CardTitle>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by contact, phone, campaign, or provider"
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
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_answer">No answer</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 hover:bg-transparent">
                <TableHead className="px-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">Contact</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Campaign</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fields</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Transcript</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Provider</TableHead>
                <TableHead className="pr-6 text-right text-xs uppercase tracking-[0.14em] text-muted-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => {
                const fieldProgress = (record.fieldsCollected / Math.max(record.fieldsTotal, 1)) * 100;

                return (
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
                    <TableCell className="min-w-[200px]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>
                            {record.fieldsCollected}/{record.fieldsTotal} captured
                          </span>
                          <span>{Math.round(fieldProgress)}%</span>
                        </div>
                        <Progress value={fieldProgress} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.transcriptMode === "none" ? (
                        <Badge variant="outline">No transcript</Badge>
                      ) : !canReviewArtifacts ? (
                        <Badge variant="outline">Reviewer access required</Badge>
                      ) : (
                        <Dialog
                          open={selectedRecordId === record.id}
                          onOpenChange={(open) => setSelectedRecordId(open ? record.id : null)}
                        >
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm" className="gap-2">
                              <FileText className="h-4 w-4" />
                              {record.transcriptMode === "restricted" ? "Restricted view" : "Redacted view"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="panel-strong max-w-2xl rounded-[30px] border-white/70 p-0">
                            <DialogHeader className="border-b border-white/60 px-6 py-5">
                              <DialogTitle className="text-2xl">
                                {selectedRecord?.contactName ?? record.contactName} - {selectedRecord?.campaignName ?? record.campaignName}
                              </DialogTitle>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Transcript mode: {selectedRecord?.transcriptMode ?? record.transcriptMode}. Sensitive values remain masked in this surface.
                              </p>
                            </DialogHeader>
                            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-6">
                              {transcriptQuery.isPending ? (
                                <div className="rounded-[24px] bg-white/65 px-4 py-5 text-sm text-muted-foreground">
                                  Loading transcript and collected fields.
                                </div>
                              ) : null}

                              {transcriptQuery.error ? (
                                <div className="rounded-[24px] bg-destructive/10 px-4 py-5 text-sm text-destructive">
                                  {transcriptQuery.error instanceof Error ? transcriptQuery.error.message : "Transcript could not be loaded."}
                                </div>
                              ) : null}

                              {transcriptQuery.data?.map((line, index) => (
                                <div key={`${line.speaker}-${index}`} className={`flex ${line.speaker === "Bot" ? "justify-start" : "justify-end"}`}>
                                  <div
                                    className={`max-w-[80%] rounded-[24px] px-4 py-3 ${
                                      line.speaker === "Bot" ? "bg-white/75" : line.speaker === "System" ? "bg-warning/10" : "bg-primary/10"
                                    }`}
                                  >
                                    <p className="section-eyebrow">{line.speaker}</p>
                                    <p className="mt-2 text-sm leading-7 text-foreground">{line.text}</p>
                                  </div>
                                </div>
                              ))}

                              {collectedDataQuery.data?.length ? (
                                <div className="rounded-[24px] bg-white/65 p-4">
                                  <p className="section-eyebrow">Collected fields</p>
                                  <div className="mt-4 space-y-3">
                                    {collectedDataQuery.data.map((field) => (
                                      <div key={field.fieldKey} className="flex items-start justify-between gap-4 rounded-[18px] bg-white/75 px-4 py-3">
                                        <div>
                                          <p className="text-sm font-semibold text-foreground">{field.label}</p>
                                          <p className="mt-1 text-sm text-muted-foreground">{field.value}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold text-foreground">{Math.round(field.confidenceScore * 100)}%</p>
                                          <p className="text-xs text-muted-foreground">
                                            {field.confirmed ? "Confirmed" : "Pending"}{field.masked ? " | Masked" : ""}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{formatProvider(record.provider)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatLabel(record.disposition)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm text-muted-foreground">{formatDateTime(record.startedAt)}</TableCell>
                  </TableRow>
                );
              })}

              {filtered.length === 0 ? (
                <TableRow className="border-white/50">
                  <TableCell colSpan={7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    No call records match the current filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
