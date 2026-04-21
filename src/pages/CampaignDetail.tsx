import { useEffect, useState } from "react";
import { ArrowLeft, Pause, Pencil, Play, Plus, Save, Shield, ShieldCheck, Trash2, UserRoundCheck, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PageStateCard from "@/components/PageStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { hasRoleAtLeast } from "@/lib/access-control";
import { ApiError, api } from "@/lib/api-client";
import { formatDate, formatDateTime, formatProvider } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";
import type { CampaignField, CreateCampaignRequest } from "@/lib/api-contracts";

type CampaignDetailRecord = Awaited<ReturnType<typeof api.getCampaign>> & {
  setup: CreateCampaignRequest["setup"];
  journey: CreateCampaignRequest["journey"];
  fields: CampaignField[];
  sequence: string[];
};

const languageOptions: Array<{ value: CreateCampaignRequest["setup"]["language"]; label: string }> = [
  { value: "hindi", label: "Hindi" },
  { value: "english", label: "English" },
  { value: "tamil", label: "Tamil" },
  { value: "telugu", label: "Telugu" },
  { value: "kannada", label: "Kannada" },
  { value: "bengali", label: "Bengali" },
  { value: "marathi", label: "Marathi" },
  { value: "gujarati", label: "Gujarati" },
];

const verticalOptions: Array<{ value: CreateCampaignRequest["setup"]["vertical"]; label: string }> = [
  { value: "banking", label: "Banking" },
  { value: "insurance", label: "Insurance" },
  { value: "lending", label: "Lending" },
  { value: "healthcare", label: "Healthcare" },
  { value: "telecom", label: "Telecom" },
];

const fieldTypeOptions: Array<{ value: CampaignField["type"]; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Boolean" },
  { value: "select", label: "Select" },
];

const journeyActionOptions: Array<{ value: CreateCampaignRequest["journey"]["unansweredAction"]; label: string }> = [
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "retry", label: "Retry voice" },
  { value: "none", label: "No follow-up" },
];

const createBlankField = (index: number): CampaignField => ({
  field_key: `field_${index + 1}`,
  label: "New field",
  prompt: "Describe the prompt for this field.",
  type: "text",
  required: true,
  sensitive: false,
  verification_label: "",
  retry_limit: 1,
  validation_rule: "",
});

const cloneField = (field: CampaignField): CampaignField => ({
  ...field,
  verification_label: field.verification_label ?? "",
  validation_rule: field.validation_rule ?? "",
});

const buildSequencePreview = (journey: CreateCampaignRequest["journey"]) => {
  const sequence = ["Voice first"];

  if (journey.unansweredAction === "sms") sequence.push("SMS if unanswered");
  else if (journey.unansweredAction === "whatsapp") sequence.push("WhatsApp if unanswered");
  else if (journey.unansweredAction === "retry") sequence.push("Retry voice if unanswered");
  else sequence.push("No unanswered follow-up");

  if (journey.partialAction === "sms") sequence.push("SMS if partial");
  else if (journey.partialAction === "whatsapp") sequence.push("WhatsApp if partial");
  else if (journey.partialAction === "retry") sequence.push("Retry voice if partial");
  else sequence.push("No partial follow-up");

  return sequence;
};

const buildDraft = (campaign: CampaignDetailRecord): CreateCampaignRequest => ({
  setup: { ...campaign.setup, transferQueue: campaign.setup.transferQueue ?? "" },
  fields: campaign.fields.map(cloneField),
  journey: { ...campaign.journey },
});

const sanitizeDraft = (draft: CreateCampaignRequest): CreateCampaignRequest => ({
  setup: {
    ...draft.setup,
    campaignName: draft.setup.campaignName.trim(),
    callerIdentity: draft.setup.callerIdentity.trim(),
    introScript: draft.setup.introScript.trim(),
    purposeStatement: draft.setup.purposeStatement.trim(),
    transferQueue: draft.setup.transferEnabled ? draft.setup.transferQueue.trim() : "",
  },
  fields: draft.fields.map((field) => ({
    ...field,
    field_key: field.field_key.trim(),
    label: field.label.trim(),
    prompt: field.prompt.trim(),
    verification_label: field.verification_label.trim(),
    validation_rule: field.validation_rule.trim(),
  })),
  journey: { ...draft.journey, csvSource: draft.journey.csvSource.trim() },
});

export default function CampaignDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const { viewer } = useCurrentViewer();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CreateCampaignRequest | null>(null);

  const campaignQuery = useQuery({
    queryKey: queryKeys.campaign(id),
    queryFn: () => api.getCampaign(id),
    enabled: id.length > 0,
  });
  const relatedCallsQuery = useQuery({
    queryKey: queryKeys.callRecords({ campaignId: id }),
    queryFn: () => api.listCallRecords({ campaignId: id }),
    enabled: id.length > 0,
  });

  const campaign = campaignQuery.data as CampaignDetailRecord | undefined;
  const relatedCalls = relatedCallsQuery.data ?? [];

  useEffect(() => {
    if (campaign && !isEditing) setDraft(buildDraft(campaign));
  }, [campaign, isEditing]);

  const invalidateViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.campaign(id) }),
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.journeys }),
      queryClient.invalidateQueries({ queryKey: queryKeys.callRecords({ campaignId: id }) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const statusMutation = useMutation({
    mutationFn: async (action: "pause" | "resume") => (action === "pause" ? api.pauseCampaign(id) : api.resumeCampaign(id)),
    onSuccess: async (_campaign, action) => {
      await invalidateViews();
      toast({
        title: action === "pause" ? "Campaign paused" : "Campaign resumed",
        description: action === "pause" ? "Launch activity has been paused cleanly." : "The campaign is live again.",
      });
    },
    onError: (error) => {
      toast({
        title: "Campaign update failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
  const saveMutation = useMutation({
    mutationFn: async (payload: CreateCampaignRequest) => api.updateCampaign(id, payload),
    onSuccess: async (updatedCampaign) => {
      await invalidateViews();
      setIsEditing(false);
      setDraft(buildDraft(updatedCampaign as CampaignDetailRecord));
      toast({
        title: "Campaign saved",
        description: "The updated campaign configuration is now active in the workspace.",
      });
    },
    onError: (error) => {
      toast({
        title: "Unable to save campaign",
        description: error instanceof Error ? error.message : "Please review the form and try again.",
        variant: "destructive",
      });
    },
  });

  if (campaignQuery.isPending) {
    return <PageStateCard title="Loading campaign" description="Fetching campaign architecture, metrics, and recent attempt history." />;
  }

  if (campaignQuery.error && !(campaignQuery.error instanceof ApiError && campaignQuery.error.status === 404)) {
    return (
      <PageStateCard
        title="Campaign unavailable"
        description={campaignQuery.error instanceof Error ? campaignQuery.error.message : "Campaign data could not be loaded."}
      />
    );
  }

  if (!campaign || (campaignQuery.error instanceof ApiError && campaignQuery.error.status === 404)) {
    return (
      <Card className="rounded-[32px]">
        <CardContent className="py-20 text-center">
          <p className="text-lg font-semibold text-foreground">Campaign not found</p>
          <p className="mt-2 text-sm text-muted-foreground">The requested campaign could not be loaded from the current workspace.</p>
          <Link to="/campaigns" className="mt-6 inline-flex">
            <Button variant="outline">Back to campaigns</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const activeSetup = isEditing && draft ? draft.setup : campaign.setup;
  const activeJourney = isEditing && draft ? draft.journey : campaign.journey;
  const activeFields = isEditing && draft ? draft.fields : campaign.fields;
  const sequence = isEditing && draft ? buildSequencePreview(draft.journey) : campaign.sequence;
  const quietHours = `${activeSetup.callingWindowStart} to ${activeSetup.callingWindowEnd} IST`;
  const transferQueue = activeSetup.transferEnabled ? activeSetup.transferQueue : "Transfers disabled";
  const canManageCampaign = hasRoleAtLeast(viewer?.role, "campaign_manager");
  const canEdit = canManageCampaign && campaign.status !== "completed";

  const updateSetup = (patch: Partial<CreateCampaignRequest["setup"]>) => setDraft((current) => (current ? { ...current, setup: { ...current.setup, ...patch } } : current));
  const updateJourney = (patch: Partial<CreateCampaignRequest["journey"]>) => setDraft((current) => (current ? { ...current, journey: { ...current.journey, ...patch } } : current));
  const updateField = (index: number, patch: Partial<CampaignField>) => {
    setDraft((current) =>
      current
        ? { ...current, fields: current.fields.map((field, currentIndex) => (currentIndex === index ? { ...field, ...patch } : field)) }
        : current,
    );
  };

  const handleStartEditing = () => {
    setDraft(buildDraft(campaign));
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setDraft(buildDraft(campaign));
    setIsEditing(false);
  };

  const handleSave = () => {
    if (draft) saveMutation.mutate(sanitizeDraft(draft));
  };

  const addField = () => setDraft((current) => (current ? { ...current, fields: [...current.fields, createBlankField(current.fields.length)] } : current));
  const removeField = (index: number) =>
    setDraft((current) => (current ? { ...current, fields: current.fields.filter((_, currentIndex) => currentIndex !== index) } : current));

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <Link to="/campaigns" className="inline-flex">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to campaigns
              </Button>
            </Link>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusBadge status={campaign.status} />
              <Badge variant="secondary">{campaign.template}</Badge>
              <Badge variant="secondary">{campaign.workspace}</Badge>
              {canEdit ? <Badge variant="outline">{isEditing ? "Editing" : "Editable"}</Badge> : <Badge variant="outline">Locked</Badge>}
            </div>

            <h2 className="page-hero-title mt-5 font-semibold text-foreground">{activeSetup.campaignName}</h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{activeSetup.purposeStatement}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canEdit && !isEditing ? (
              <Button variant="secondary" className="gap-2" onClick={handleStartEditing}>
                <Pencil className="h-4 w-4" />
                Edit campaign
              </Button>
            ) : null}
            {canEdit && isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEditing} disabled={saveMutation.isPending}>
                  Cancel
                </Button>
                <Button className="gap-2" onClick={handleSave} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </>
            ) : null}
            {canManageCampaign && campaign.status === "active" ? (
              <Button variant="outline" className="gap-2" onClick={() => statusMutation.mutate("pause")} disabled={statusMutation.isPending || saveMutation.isPending}>
                <Pause className="h-4 w-4" />
                Pause campaign
              </Button>
            ) : null}
            {canManageCampaign && campaign.status === "paused" ? (
              <Button className="gap-2" onClick={() => statusMutation.mutate("resume")} disabled={statusMutation.isPending || saveMutation.isPending}>
                <Play className="h-4 w-4" />
                Resume campaign
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="inset-surface rounded-[24px] p-5">
            <p className="section-eyebrow">Caller identity</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{activeSetup.callerIdentity}</p>
            <p className="mt-2 text-sm text-muted-foreground">Launched {campaign.launchedAt ? formatDate(campaign.launchedAt) : "Not launched yet"}</p>
          </div>
          <div className="inset-surface rounded-[24px] p-5">
            <p className="section-eyebrow">Quiet hours</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{quietHours}</p>
            <p className="mt-2 text-sm text-muted-foreground">Auto-pause protects delivery policy.</p>
          </div>
          <div className="inset-surface rounded-[24px] p-5">
            <p className="section-eyebrow">Transfer queue</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{transferQueue}</p>
            <p className="mt-2 text-sm text-muted-foreground">Single shared handoff queue in v1.</p>
          </div>
          <div className="inset-surface rounded-[24px] p-5">
            <p className="section-eyebrow">Schema depth</p>
            <p className="mt-3 text-lg font-semibold text-foreground">{activeFields.length} fields</p>
            <p className="mt-2 text-sm text-muted-foreground">{activeFields.filter((field) => field.sensitive).length} marked as sensitive.</p>
          </div>
        </div>
      </section>

      {isEditing && draft ? (
        <Card className="rounded-[32px] border border-dashed border-foreground/15 bg-white/70">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Editing mode</Badge>
              <Badge variant="outline">{draft.fields.length} fields</Badge>
              <Badge variant="outline">{draft.journey.csvSource}</Badge>
            </div>
            <CardTitle className="mt-3 text-2xl">Update campaign setup, field schema, and journey rules</CardTitle>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Changes here stay local until you save, so the history cards and call records below remain intact while you work.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign name</Label>
                  <Input id="campaign-name" value={draft.setup.campaignName} onChange={(event) => updateSetup({ campaignName: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Vertical</Label>
                  <Select value={draft.setup.vertical} onValueChange={(value) => updateSetup({ vertical: value as CreateCampaignRequest["setup"]["vertical"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {verticalOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={draft.setup.language} onValueChange={(value) => updateSetup({ language: value as CreateCampaignRequest["setup"]["language"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caller-identity">Caller identity</Label>
                  <Input id="caller-identity" value={draft.setup.callerIdentity} onChange={(event) => updateSetup({ callerIdentity: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calling-start">Calling window start</Label>
                  <Input id="calling-start" type="time" value={draft.setup.callingWindowStart} onChange={(event) => updateSetup({ callingWindowStart: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calling-end">Calling window end</Label>
                  <Input id="calling-end" type="time" value={draft.setup.callingWindowEnd} onChange={(event) => updateSetup({ callingWindowEnd: event.target.value })} />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-2">
                  <Label htmlFor="intro-script">Intro script</Label>
                  <Textarea id="intro-script" value={draft.setup.introScript} onChange={(event) => updateSetup({ introScript: event.target.value })} className="min-h-[120px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose-statement">Purpose statement</Label>
                  <Textarea id="purpose-statement" value={draft.setup.purposeStatement} onChange={(event) => updateSetup({ purposeStatement: event.target.value })} className="min-h-[120px]" />
                </div>
              </div>

              <div className="rounded-[28px] bg-white/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">Transfer behavior</p>
                    <p className="text-sm text-muted-foreground">Use a shared handoff queue when the campaign should route to an agent.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={draft.setup.transferEnabled}
                      onCheckedChange={(checked) =>
                        updateSetup({
                          transferEnabled: checked,
                          transferQueue: checked ? draft.setup.transferQueue : "",
                        })
                      }
                    />
                    <span className="text-sm text-muted-foreground">{draft.setup.transferEnabled ? "Enabled" : "Disabled"}</span>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="transfer-queue">Transfer queue</Label>
                  <Input id="transfer-queue" value={draft.setup.transferQueue} onChange={(event) => updateSetup({ transferQueue: event.target.value })} disabled={!draft.setup.transferEnabled} />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] bg-white/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-foreground">Field schema</p>
                  <p className="mt-1 text-sm text-muted-foreground">Keep the form linear, explicit, and ready for the save validation step.</p>
                </div>
                <Button type="button" variant="outline" className="gap-2" onClick={addField}>
                  <Plus className="h-4 w-4" />
                  Add field
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                {draft.fields.map((field, index) => (
                  <div key={`${field.field_key}-${index}`} className="rounded-[24px] bg-background/80 p-5 shadow-sm ring-1 ring-border/70">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Field {index + 1}</Badge>
                        <Badge variant={field.sensitive ? "destructive" : "outline"}>{field.sensitive ? "Sensitive" : "Standard"}</Badge>
                      </div>
                      <Button type="button" variant="ghost" className="gap-2 text-muted-foreground" onClick={() => removeField(index)} disabled={draft.fields.length === 1}>
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Field key</Label>
                        <Input value={field.field_key} onChange={(event) => updateField(index, { field_key: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Prompt</Label>
                        <Textarea value={field.prompt} onChange={(event) => updateField(index, { prompt: event.target.value })} className="min-h-[96px]" />
                      </div>
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={field.type} onValueChange={(value) => updateField(index, { type: value as CampaignField["type"] })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldTypeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Retry limit</Label>
                        <Input type="number" min={1} max={5} value={field.retry_limit} onChange={(event) => updateField(index, { retry_limit: Number.parseInt(event.target.value, 10) || 1 })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Verification label</Label>
                        <Input value={field.verification_label} onChange={(event) => updateField(index, { verification_label: event.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Validation rule</Label>
                        <Input value={field.validation_rule} onChange={(event) => updateField(index, { validation_rule: event.target.value })} />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-6">
                      <label className="flex items-center gap-3 text-sm text-foreground">
                        <Switch checked={field.required} onCheckedChange={(checked) => updateField(index, { required: checked })} />
                        Required field
                      </label>
                      <label className="flex items-center gap-3 text-sm text-foreground">
                        <Switch checked={field.sensitive} onCheckedChange={(checked) => updateField(index, { sensitive: checked })} />
                        Sensitive value
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] bg-white/60 p-5">
              <p className="text-base font-semibold text-foreground">Journey rules</p>
              <p className="mt-1 text-sm text-muted-foreground">These controls define the retry envelope and follow-up behavior for unanswered or partial calls.</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Unanswered action</Label>
                  <Select value={draft.journey.unansweredAction} onValueChange={(value) => updateJourney({ unansweredAction: value as CreateCampaignRequest["journey"]["unansweredAction"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {journeyActionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Partial action</Label>
                  <Select value={draft.journey.partialAction} onValueChange={(value) => updateJourney({ partialAction: value as CreateCampaignRequest["journey"]["partialAction"] })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {journeyActionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CSV source</Label>
                  <Input value={draft.journey.csvSource} onChange={(event) => updateJourney({ csvSource: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Retry window hours</Label>
                  <Input type="number" min={0} max={168} value={draft.journey.retryWindowHours} onChange={(event) => updateJourney({ retryWindowHours: Number.parseInt(event.target.value, 10) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Max retries</Label>
                  <Input type="number" min={0} max={10} value={draft.journey.maxRetries} onChange={(event) => updateJourney({ maxRetries: Number.parseInt(event.target.value, 10) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Concurrency limit</Label>
                  <Input type="number" min={1} max={500} value={draft.journey.concurrencyLimit} onChange={(event) => updateJourney({ concurrencyLimit: Number.parseInt(event.target.value, 10) || 1 })} />
                </div>
                <div className="space-y-2">
                  <Label>Pacing per minute</Label>
                  <Input type="number" min={1} max={500} value={draft.journey.pacingPerMinute} onChange={(event) => updateJourney({ pacingPerMinute: Number.parseInt(event.target.value, 10) || 1 })} />
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-background/80 p-5 ring-1 ring-border/70">
                <p className="text-sm font-semibold text-foreground">Live sequence preview</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {buildSequencePreview(draft.journey).map((step) => (
                    <span key={step} className="inline-flex rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-foreground">{step}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contacts" value={campaign.contactCount.toLocaleString()} subtitle="Eligible contacts assigned to this campaign" icon={Users} />
        <StatCard label="Answer rate" value={`${campaign.answerRate}%`} subtitle="Live reach across the current dialing window" icon={UserRoundCheck} variant="primary" />
        <StatCard label="Completion" value={`${campaign.completionRate}%`} subtitle="All required fields captured before close" icon={ShieldCheck} variant="accent" />
        <StatCard label="Confirmed" value={`${campaign.confirmationRate}%`} subtitle="Read-back verification after collection" icon={Shield} variant="warning" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Campaign architecture</p>
            <CardTitle className="mt-3 text-2xl">Sequence and governance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="inset-surface rounded-[24px] p-5">
              <p className="text-base font-semibold text-foreground">Journey sequence</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {sequence.map((step) => (
                  <span key={step} className="inline-flex rounded-full bg-white/70 px-3 py-2 text-sm font-medium text-foreground">{step}</span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="inset-surface rounded-[24px] p-5">
                <p className="text-base font-semibold text-foreground">Collection policy</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Linear field ordering only in v1</li>
                  <li>Window: {quietHours}</li>
                  <li>Retries: {activeJourney.maxRetries} in {activeJourney.retryWindowHours} hours</li>
                  <li>Pacing: {activeJourney.pacingPerMinute}/minute at concurrency {activeJourney.concurrencyLimit}</li>
                </ul>
              </div>
              <div className="inset-surface rounded-[24px] p-5">
                <p className="text-base font-semibold text-foreground">Security posture</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Sensitive values encrypted at rest</li>
                  <li>Transfer queue: {transferQueue}</li>
                  <li>CSV source: {activeJourney.csvSource}</li>
                  <li>Transcript access restricted by role</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Field design</p>
            <CardTitle className="mt-3 text-2xl">Collection schema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeFields.map((field, index) => (
              <div key={field.field_key} className="inset-surface rounded-[24px] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-foreground text-background">{index + 1}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-foreground">{field.label}</p>
                        {field.sensitive ? <Badge variant="destructive">Sensitive</Badge> : <Badge variant="outline">Standard</Badge>}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{field.prompt}</p>
                    </div>
                  </div>
                  <div className="rounded-[18px] bg-white/70 px-4 py-3 text-sm text-muted-foreground">{field.required ? "Required" : "Optional"} | {field.type}</div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] bg-white/70 px-4 py-3">
                    <p className="text-sm text-muted-foreground">Verification label</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{field.verification_label || "Not set"}</p>
                  </div>
                  <div className="rounded-[20px] bg-white/70 px-4 py-3">
                    <p className="text-sm text-muted-foreground">Validation rule</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{field.validation_rule || "Free text"}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[32px]">
        <CardHeader>
          <p className="section-eyebrow">Attempt history</p>
          <CardTitle className="mt-3 text-2xl">Recent call records for this campaign</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/60 hover:bg-transparent">
                <TableHead className="px-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">Contact</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Fields</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Confirmed</TableHead>
                <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Provider</TableHead>
                <TableHead className="pr-6 text-right text-xs uppercase tracking-[0.14em] text-muted-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatedCallsQuery.error ? (
                <TableRow className="border-white/50">
                  <TableCell colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground">
                    {relatedCallsQuery.error instanceof Error ? relatedCallsQuery.error.message : "Recent attempt history could not be loaded."}
                  </TableCell>
                </TableRow>
              ) : relatedCalls.length > 0 ? (
                relatedCalls.map((record) => (
                  <TableRow key={record.id} className="border-white/50 hover:bg-white/35">
                    <TableCell className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{record.contactName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{record.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={record.status} /></TableCell>
                    <TableCell className="min-w-[180px]">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{record.fieldsCollected}/{record.fieldsTotal} captured</span>
                          <span>{Math.round((record.fieldsCollected / Math.max(record.fieldsTotal, 1)) * 100)}%</span>
                        </div>
                        <Progress value={(record.fieldsCollected / Math.max(record.fieldsTotal, 1)) * 100} />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{record.confirmed ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatProvider(record.provider)}</TableCell>
                    <TableCell className="pr-6 text-right text-sm text-muted-foreground">{formatDateTime(record.startedAt)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="border-white/50">
                  <TableCell colSpan={6} className="px-6 py-16 text-center text-sm text-muted-foreground">No attempts recorded yet for this campaign.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
