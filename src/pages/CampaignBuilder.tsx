import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, GripVertical, Plus, Save, Shield, Trash2, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { CampaignField, CreateCampaignRequest, FieldType } from "@/lib/api-contracts";

const stepMeta = [
  {
    id: 1,
    label: "Campaign setup",
    description: "Define the campaign identity, language, purpose, and calling policy before any data schema is added.",
  },
  {
    id: 2,
    label: "Field schema",
    description: "Design a linear collection flow with prompts, verification labels, retry limits, and sensitivity markers.",
  },
  {
    id: 3,
    label: "Journey rules",
    description: "Set retries, follow-up branches, pacing, concurrency, and the contact upload source before launch.",
  },
];

const defaultField: CampaignField = {
  field_key: "",
  label: "",
  prompt: "",
  type: "text",
  required: true,
  sensitive: false,
  verification_label: "",
  retry_limit: 3,
  validation_rule: "",
};

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<CreateCampaignRequest["setup"]>({
    campaignName: "Credit Card Activation - Karnataka",
    vertical: "banking",
    language: "kannada",
    callerIdentity: "HDFC Bank",
    introScript: "Hello, this is HDFC Bank calling regarding your credit card activation.",
    purposeStatement: "The purpose of this call is to verify card ownership and confirm activation readiness.",
    callingWindowStart: "09:00",
    callingWindowEnd: "21:00",
    transferEnabled: true,
    transferQueue: "Card support",
  });
  const [journey, setJourney] = useState({
    unansweredAction: "sms" as CreateCampaignRequest["journey"]["unansweredAction"],
    partialAction: "whatsapp" as CreateCampaignRequest["journey"]["partialAction"],
    retryWindowHours: "4",
    maxRetries: "3",
    concurrencyLimit: "50",
    pacingPerMinute: "20",
    csvSource: "April activation upload",
  });
  const [fields, setFields] = useState<CampaignField[]>([
    {
      field_key: "last_four_digits",
      label: "Card last four digits",
      prompt: "Please confirm the last four digits of your card.",
      type: "number",
      required: true,
      sensitive: true,
      verification_label: "Card ending",
      retry_limit: 3,
      validation_rule: "Exactly four digits",
    },
    {
      field_key: "activation_confirm",
      label: "Activation confirmation",
      prompt: "Would you like to activate your card now?",
      type: "boolean",
      required: true,
      sensitive: false,
      verification_label: "Activation choice",
      retry_limit: 2,
      validation_rule: "Yes or no",
    },
  ]);
  const createCampaignMutation = useMutation({
    mutationFn: async ({ launch }: { readonly launch: boolean }) => {
      const payload: CreateCampaignRequest = {
        setup: {
          ...config,
          transferQueue: config.transferEnabled ? config.transferQueue : "",
        },
        fields: fields.map((field) => ({
          ...field,
          field_key: field.field_key.trim(),
          label: field.label.trim(),
          prompt: field.prompt.trim(),
          verification_label: field.verification_label?.trim() ?? "",
          validation_rule: field.validation_rule?.trim() ?? "",
        })),
        journey: {
          unansweredAction: journey.unansweredAction,
          partialAction: journey.partialAction,
          retryWindowHours: Number.parseInt(journey.retryWindowHours, 10) || 0,
          maxRetries: Number.parseInt(journey.maxRetries, 10) || 0,
          concurrencyLimit: Number.parseInt(journey.concurrencyLimit, 10) || 1,
          pacingPerMinute: Number.parseInt(journey.pacingPerMinute, 10) || 1,
          csvSource: journey.csvSource.trim(),
        },
      };

      const createdCampaign = await api.createCampaign(payload);

      if (!launch) {
        return createdCampaign;
      }

      return api.launchCampaign(createdCampaign.id);
    },
    onSuccess: async (campaign, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);

      toast({
        title: variables.launch ? "Campaign launched" : "Draft saved",
        description: variables.launch
          ? `${campaign.name} is now available in the live workspace.`
          : `${campaign.name} was saved to the campaign workspace.`,
      });

      navigate(`/campaigns/${campaign.id}`);
    },
    onError: (error) => {
      toast({
        title: "Unable to save campaign",
        description: error instanceof Error ? error.message : "Please review the setup and try again.",
        variant: "destructive",
      });
    },
  });

  const sensitiveFieldCount = useMemo(() => fields.filter((field) => field.sensitive).length, [fields]);

  const addField = () => {
    setFields((currentFields) => [...currentFields, { ...defaultField }]);
  };

  const removeField = (index: number) => {
    setFields((currentFields) => currentFields.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateField = (index: number, updates: Partial<CampaignField>) => {
    setFields((currentFields) =>
      currentFields.map((field, currentIndex) => (currentIndex === index ? { ...field, ...updates } : field)),
    );
  };

  const sequencePreview = [
    "Voice first",
    journey.unansweredAction === "sms"
      ? "SMS if unanswered"
      : journey.unansweredAction === "whatsapp"
        ? "WhatsApp if unanswered"
        : journey.unansweredAction === "retry"
          ? "Retry voice if unanswered"
          : "No unanswered follow-up",
    journey.partialAction === "whatsapp"
      ? "WhatsApp if partial"
      : journey.partialAction === "sms"
        ? "SMS if partial"
        : journey.partialAction === "retry"
          ? "Retry voice if partial"
          : "No partial follow-up",
  ];

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-eyebrow">Campaign builder</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              Progressive disclosure keeps complex setup calm, reviewable, and launch-safe.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              This builder now follows the v1 product workflow: define campaign identity and policy, model linear field
              collection, then configure the journey branches and upload source before launch review.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/campaigns">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to campaigns
              </Button>
            </Link>
            <Button variant="secondary" className="gap-2" onClick={() => createCampaignMutation.mutate({ launch: false })} disabled={createCampaignMutation.isPending}>
              <Save className="h-4 w-4" />
              Save draft
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 lg:grid-cols-3">
          {stepMeta.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={`rounded-[26px] border p-5 text-left transition-all ${
                step === item.id ? "bg-foreground text-background shadow-[0_24px_60px_-34px_rgba(15,23,42,0.72)]" : "bg-white/55 text-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`section-eyebrow ${step === item.id ? "text-background/70" : ""}`}>Step {item.id}</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    step === item.id ? "bg-background/[0.12] text-background" : "bg-foreground text-background"
                  }`}
                >
                  {item.id}
                </span>
              </div>
              <p className="mt-4 text-xl font-semibold">{item.label}</p>
              <p className={`mt-2 text-sm leading-6 ${step === item.id ? "text-background/78" : "text-muted-foreground"}`}>
                {item.description}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {step === 1 ? (
            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Step 1</p>
                <CardTitle className="mt-3 text-2xl">Campaign setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Campaign name</Label>
                    <Input
                      value={config.campaignName}
                      onChange={(event) => setConfig((current) => ({ ...current, campaignName: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vertical</Label>
                    <Select
                      value={config.vertical}
                      onValueChange={(value) =>
                        setConfig((current) => ({ ...current, vertical: value as CreateCampaignRequest["setup"]["vertical"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="banking">Banking</SelectItem>
                        <SelectItem value="insurance">Insurance</SelectItem>
                        <SelectItem value="lending">Lending</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="telecom">Telecom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={config.language}
                      onValueChange={(value) =>
                        setConfig((current) => ({ ...current, language: value as CreateCampaignRequest["setup"]["language"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hindi">Hindi</SelectItem>
                        <SelectItem value="english">English</SelectItem>
                        <SelectItem value="tamil">Tamil</SelectItem>
                        <SelectItem value="telugu">Telugu</SelectItem>
                        <SelectItem value="kannada">Kannada</SelectItem>
                        <SelectItem value="bengali">Bengali</SelectItem>
                        <SelectItem value="marathi">Marathi</SelectItem>
                        <SelectItem value="gujarati">Gujarati</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Caller identity</Label>
                    <Input
                      value={config.callerIdentity}
                      onChange={(event) => setConfig((current) => ({ ...current, callerIdentity: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Intro script</Label>
                  <Textarea
                    value={config.introScript}
                    onChange={(event) => setConfig((current) => ({ ...current, introScript: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Purpose statement</Label>
                  <Textarea
                    value={config.purposeStatement}
                    onChange={(event) => setConfig((current) => ({ ...current, purposeStatement: event.target.value }))}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Calling window start</Label>
                    <Input
                      type="time"
                      value={config.callingWindowStart}
                      onChange={(event) => setConfig((current) => ({ ...current, callingWindowStart: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calling window end</Label>
                    <Input
                      type="time"
                      value={config.callingWindowEnd}
                      onChange={(event) => setConfig((current) => ({ ...current, callingWindowEnd: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transfer queue</Label>
                    <Input
                      value={config.transferQueue}
                      onChange={(event) => setConfig((current) => ({ ...current, transferQueue: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-[26px] bg-white/60 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">Human transfer enabled</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        The v1 flow supports transfer to one shared queue when the recipient asks for a human.
                      </p>
                    </div>
                    <Switch
                      checked={config.transferEnabled}
                      onCheckedChange={(value) => setConfig((current) => ({ ...current, transferEnabled: value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="gap-2" onClick={() => setStep(2)}>
                    Continue to field schema
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card className="rounded-[32px]">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-eyebrow">Step 2</p>
                  <CardTitle className="mt-3 text-2xl">Field schema and verification</CardTitle>
                </div>
                <Button variant="outline" className="gap-2" onClick={addField}>
                  <Plus className="h-4 w-4" />
                  Add field
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field, index) => (
                  <div key={`${field.field_key}-${index}`} className="inset-surface rounded-[28px] p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-foreground text-background">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-foreground">Field {index + 1}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {field.sensitive ? (
                              <Badge variant="destructive" className="gap-1.5">
                                <Shield className="h-3.5 w-3.5" />
                                Sensitive
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Standard</Badge>
                            )}
                            {field.required ? <Badge variant="secondary">Required</Badge> : <Badge variant="outline">Optional</Badge>}
                          </div>
                        </div>
                      </div>

                      {fields.length > 1 ? (
                        <Button variant="ghost" size="icon" onClick={() => removeField(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Field key</Label>
                        <Input
                          value={field.field_key}
                          onChange={(event) => updateField(index, { field_key: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Label</Label>
                        <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label>Voice prompt</Label>
                      <Textarea value={field.prompt} onChange={(event) => updateField(index, { prompt: event.target.value })} />
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Verification label</Label>
                        <Input
                          value={field.verification_label}
                          onChange={(event) => updateField(index, { verification_label: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Validation rule</Label>
                        <Input
                          value={field.validation_rule}
                          onChange={(event) => updateField(index, { validation_rule: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => updateField(index, { type: value as FieldType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="boolean">Yes or no</SelectItem>
                            <SelectItem value="select">Select</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Retry limit</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={field.retry_limit}
                          onChange={(event) =>
                            updateField(index, { retry_limit: Number.parseInt(event.target.value, 10) || 1 })
                          }
                        />
                      </div>
                      <div className="flex items-end justify-between rounded-[22px] bg-white/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Required</p>
                          <p className="text-xs text-muted-foreground">Must be captured before close.</p>
                        </div>
                        <Switch checked={field.required} onCheckedChange={(value) => updateField(index, { required: value })} />
                      </div>
                      <div className="flex items-end justify-between rounded-[22px] bg-white/70 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Sensitive</p>
                          <p className="text-xs text-muted-foreground">Mask in export and transcript view.</p>
                        </div>
                        <Switch checked={field.sensitive} onCheckedChange={(value) => updateField(index, { sensitive: value })} />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back to setup
                  </Button>
                  <Button className="gap-2" onClick={() => setStep(3)}>
                    Continue to journey rules
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Step 3</p>
                <CardTitle className="mt-3 text-2xl">Journey rules and upload source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>If unanswered</Label>
                    <Select
                      value={journey.unansweredAction}
                      onValueChange={(value) =>
                        setJourney((current) => ({
                          ...current,
                          unansweredAction: value as CreateCampaignRequest["journey"]["unansweredAction"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">Send SMS</SelectItem>
                        <SelectItem value="whatsapp">Send WhatsApp</SelectItem>
                        <SelectItem value="retry">Retry voice</SelectItem>
                        <SelectItem value="none">No follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>If partial</Label>
                    <Select
                      value={journey.partialAction}
                      onValueChange={(value) =>
                        setJourney((current) => ({
                          ...current,
                          partialAction: value as CreateCampaignRequest["journey"]["partialAction"],
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">Send WhatsApp summary</SelectItem>
                        <SelectItem value="sms">Send SMS reminder</SelectItem>
                        <SelectItem value="retry">Retry voice</SelectItem>
                        <SelectItem value="none">No follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Retry window (hours)</Label>
                    <Input
                      type="number"
                      value={journey.retryWindowHours}
                      onChange={(event) => setJourney((current) => ({ ...current, retryWindowHours: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max retries</Label>
                    <Input
                      type="number"
                      value={journey.maxRetries}
                      onChange={(event) => setJourney((current) => ({ ...current, maxRetries: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Concurrency limit</Label>
                    <Input
                      type="number"
                      value={journey.concurrencyLimit}
                      onChange={(event) => setJourney((current) => ({ ...current, concurrencyLimit: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pacing (calls per minute)</Label>
                    <Input
                      type="number"
                      value={journey.pacingPerMinute}
                      onChange={(event) => setJourney((current) => ({ ...current, pacingPerMinute: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-dashed border-white/70 bg-white/50 p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">Contact CSV upload source</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Schema validation, dedupe checks, consent state, suppression state, and quiet-hour policy all apply before dialing.
                  </p>
                  <div className="mx-auto mt-4 max-w-sm">
                    <Input
                      value={journey.csvSource}
                      onChange={(event) => setJourney((current) => ({ ...current, csvSource: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[24px] bg-white/60 p-5">
                    <p className="text-base font-semibold text-foreground">Call policy safeguards</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <li>Quiet hours auto-pause</li>
                      <li>DND and suppression gating</li>
                      <li>Transfer queue fallback</li>
                    </ul>
                  </div>
                  <div className="rounded-[24px] bg-white/60 p-5">
                    <p className="text-base font-semibold text-foreground">Launch checklist</p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                      <li>Read-back confirmation enabled</li>
                      <li>Sensitive fields marked</li>
                      <li>Follow-up branches defined</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back to fields
                  </Button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="secondary"
                      className="gap-2"
                      onClick={() => createCampaignMutation.mutate({ launch: false })}
                      disabled={createCampaignMutation.isPending}
                    >
                      <Save className="h-4 w-4" />
                      Save as draft
                    </Button>
                    <Button className="gap-2" onClick={() => createCampaignMutation.mutate({ launch: true })} disabled={createCampaignMutation.isPending}>
                      Launch campaign
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="rounded-[32px] xl:sticky xl:top-28">
            <CardHeader>
              <p className="section-eyebrow">Launch review</p>
              <CardTitle className="mt-3 text-2xl">Live campaign blueprint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[26px] bg-white/65 p-5">
                <p className="text-xl font-semibold text-foreground">{config.campaignName || "Untitled campaign"}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {config.callerIdentity} in {config.language} for {config.vertical} outreach.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="secondary">{config.callerIdentity}</Badge>
                  <Badge variant="secondary">{config.transferEnabled ? "Human transfer on" : "No transfer"}</Badge>
                  <Badge variant="secondary">
                    {config.callingWindowStart} to {config.callingWindowEnd}
                  </Badge>
                </div>
              </div>

              <div className="rounded-[26px] bg-white/65 p-5">
                <p className="section-eyebrow">Field summary</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] bg-white/75 px-4 py-3">
                    <p className="text-sm text-muted-foreground">Total fields</p>
                    <p className="metric-value mt-2 text-3xl text-foreground">{fields.length}</p>
                  </div>
                  <div className="rounded-[20px] bg-white/75 px-4 py-3">
                    <p className="text-sm text-muted-foreground">Sensitive fields</p>
                    <p className="metric-value mt-2 text-3xl text-foreground">{sensitiveFieldCount}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {fields.map((field, index) => (
                    <div key={`${field.field_key || field.label || "field"}-${index}`} className="flex items-center justify-between rounded-[18px] bg-white/75 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{field.label || "Untitled field"}</p>
                        <p className="text-xs text-muted-foreground">
                          {field.verification_label || "No verification label"} | {field.type}
                        </p>
                      </div>
                      {field.sensitive ? <Badge variant="destructive">Sensitive</Badge> : <Badge variant="outline">Standard</Badge>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] bg-white/65 p-5">
                <p className="section-eyebrow">Sequence preview</p>
                <div className="mt-4 space-y-2">
                  {sequencePreview.map((stepLabel, index) => (
                    <div key={`${stepLabel}-${index}`} className="rounded-[18px] bg-white/75 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{stepLabel}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] bg-primary/8 p-5">
                <p className="text-base font-semibold text-foreground">Design guardrails in this UI</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Linear collection keeps v1 scope aligned with the PRD.</li>
                  <li>Verification labels make read-back explicit for every required field.</li>
                  <li>Sensitive markers remain visible throughout the builder, not only at export time.</li>
                  <li>Upload and journey rules stay separate so launch review is easier to reason about.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
