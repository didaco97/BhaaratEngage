import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building, Key, Shield, Trash2, Users } from "lucide-react";

import PageStateCard from "@/components/PageStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/lib/api-client";
import type {
  CreatedApiKey,
  InviteTeamMemberRequest,
  NotificationPreferenceUpdate,
  WebhookConfig,
  WorkspaceSettings,
} from "@/lib/api-contracts";
import { formatDateTime, formatLabel, formatRole } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";

const supportedLanguages = [
  "hindi",
  "english",
  "tamil",
  "telugu",
  "kannada",
  "bengali",
  "marathi",
  "gujarati",
  "urdu",
] as const;

const roleOptions = ["workspace_admin", "campaign_manager", "reviewer", "operator", "viewer"] as const;

const emptyInviteDraft: InviteTeamMemberRequest = {
  name: "",
  email: "",
  role: "viewer",
};

function parseWebhookEvents(value: string) {
  return value
    .split(/[\n,]/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: api.getSettingsSnapshot,
  });
  const apiKeysQuery = useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: api.listApiKeys,
    enabled: settingsQuery.isSuccess,
  });
  const settings = settingsQuery.data;

  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSettings | null>(null);
  const [notificationDraft, setNotificationDraft] = useState<NotificationPreferenceUpdate[]>([]);
  const [webhookDraft, setWebhookDraft] = useState<{ url: string; eventsText: string }>({
    url: "",
    eventsText: "",
  });
  const [inviteDraft, setInviteDraft] = useState<InviteTeamMemberRequest>(emptyInviteDraft);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [apiKeyNameDraft, setApiKeyNameDraft] = useState("Primary integration key");
  const [createdApiKey, setCreatedApiKey] = useState<CreatedApiKey | null>(null);

  useEffect(() => {
    if (!settings) {
      return;
    }

    setWorkspaceDraft(settings.workspaceSettings);
    setNotificationDraft(settings.notificationPreferences.map((preference) => ({ key: preference.key, enabled: preference.enabled })));
    setWebhookDraft({
      url: settings.apiAccess.webhook.url,
      eventsText: settings.apiAccess.webhook.events.join(", "),
    });
  }, [settings]);

  const applySettingsSnapshot = (snapshot: NonNullable<typeof settings>) => {
    queryClient.setQueryData(queryKeys.settings, snapshot);
    queryClient.setQueryData(queryKeys.apiKeys, snapshot.apiKeys);
  };

  const refreshApiKeys = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys }),
    ]);
  };

  const workspaceMutation = useMutation({
    mutationFn: api.updateWorkspaceSettings,
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      toast({
        title: "Workspace defaults saved",
        description: "Calling policy, language, and transcript defaults were updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Workspace defaults failed",
        description: error instanceof Error ? error.message : "Workspace settings could not be saved.",
        variant: "destructive",
      });
    },
  });

  const notificationMutation = useMutation({
    mutationFn: api.updateNotificationPreferences,
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      toast({
        title: "Notifications saved",
        description: "Workspace notification preferences were updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Notifications failed",
        description: error instanceof Error ? error.message : "Notification preferences could not be saved.",
        variant: "destructive",
      });
    },
  });

  const webhookMutation = useMutation({
    mutationFn: api.updateWebhookConfig,
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      toast({
        title: "Webhook settings saved",
        description: "The active outbound webhook configuration was updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Webhook update failed",
        description: error instanceof Error ? error.message : "Webhook settings could not be saved.",
        variant: "destructive",
      });
    },
  });

  const inviteTeamMemberMutation = useMutation({
    mutationFn: api.inviteTeamMember,
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      setInviteDialogOpen(false);
      setInviteDraft(emptyInviteDraft);
      toast({
        title: "Team member invited",
        description: "The invite was created and the workspace roster has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Invite failed",
        description: error instanceof Error ? error.message : "The team member could not be invited.",
        variant: "destructive",
      });
    },
  });

  const teamRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { readonly userId: string; readonly role: InviteTeamMemberRequest["role"] }) =>
      api.updateTeamMemberRole(userId, role),
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      toast({
        title: "Team role updated",
        description: "Workspace access changes were saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Role update failed",
        description: error instanceof Error ? error.message : "The team role could not be updated.",
        variant: "destructive",
      });
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ userId }: { readonly userId: string }) => api.removeTeamMember(userId),
    onSuccess: (snapshot) => {
      applySettingsSnapshot(snapshot);
      toast({
        title: "Team member removed",
        description: "The workspace roster was updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Removal failed",
        description: error instanceof Error ? error.message : "The team member could not be removed.",
        variant: "destructive",
      });
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: () => api.createApiKey({ name: apiKeyNameDraft.trim() }),
    onSuccess: async (result) => {
      setCreatedApiKey(result);
      setApiKeyNameDraft("Primary integration key");
      await refreshApiKeys();
      toast({
        title: "API key created",
        description: "Copy the generated secret now. It will not be shown again.",
      });
    },
    onError: (error) => {
      toast({
        title: "API key creation failed",
        description: error instanceof Error ? error.message : "The API key could not be created.",
        variant: "destructive",
      });
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: ({ id }: { readonly id: string }) => api.deleteApiKey(id),
    onSuccess: async (_result, variables) => {
      setCreatedApiKey((current) => (current?.id === variables.id ? null : current));
      await refreshApiKeys();
      toast({
        title: "API key deleted",
        description: "The selected integration key was removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "API key deletion failed",
        description: error instanceof Error ? error.message : "The API key could not be deleted.",
        variant: "destructive",
      });
    },
  });

  const workspaces = settings?.workspaces ?? [];
  const teamMembers = settings?.teamMembers ?? [];
  const securityControls = settings?.securityControls ?? [];
  const notificationCatalog = settings?.notificationPreferences ?? [];
  const apiAccess = settings?.apiAccess;
  const apiKeys = apiKeysQuery.data ?? settings?.apiKeys ?? [];
  const workspaceSettings = workspaceDraft ?? settings?.workspaceSettings ?? null;

  const notificationPreferences = notificationCatalog.map((preference) => ({
    ...preference,
    enabled: notificationDraft.find((draft) => draft.key === preference.key)?.enabled ?? preference.enabled,
  }));
  const webhookEvents = parseWebhookEvents(webhookDraft.eventsText);

  if (settingsQuery.isPending && !settings) {
    return (
      <PageStateCard
        title="Loading settings"
        description="Fetching workspace defaults, team access, security controls, and integration settings."
      />
    );
  }

  if (settingsQuery.error) {
    return (
      <PageStateCard
        title="Settings unavailable"
        description={settingsQuery.error instanceof Error ? settingsQuery.error.message : "Settings data could not be loaded."}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="max-w-3xl">
          <p className="section-eyebrow">Workspace controls</p>
          <h2 className="page-hero-title mt-4 font-semibold text-foreground">
            Governance, defaults, and integrations now live in a cleaner admin surface.
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            The settings area is organized by administration jobs: workspace defaults, team access, security posture,
            notifications, and outbound integration settings for exports and webhooks.
          </p>
        </div>
      </section>

      <Tabs defaultValue="workspace" className="space-y-5">
        <TabsList className="w-full justify-start overflow-x-auto rounded-[28px] p-1.5">
          <TabsTrigger value="workspace" className="gap-2">
            <Building className="h-4 w-4" />
            Workspace
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-2">
            <Key className="h-4 w-4" />
            API and webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Workspace defaults</p>
                <CardTitle className="mt-3 text-2xl">Calling policy and language baseline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Workspace name</Label>
                    <Input
                      value={workspaceSettings?.workspaceName ?? ""}
                      onChange={(event) =>
                        setWorkspaceDraft((current) => (current ? { ...current, workspaceName: event.target.value } : current))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Default language</Label>
                    <Select
                      value={workspaceSettings?.defaultLanguage ?? "english"}
                      onValueChange={(value) =>
                        setWorkspaceDraft((current) =>
                          current
                            ? {
                                ...current,
                                defaultLanguage: value as WorkspaceSettings["defaultLanguage"],
                              }
                            : current,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedLanguages.map((language) => (
                          <SelectItem key={language} value={language}>
                            {formatLabel(language)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Calling window start</Label>
                    <Input
                      type="time"
                      value={workspaceSettings?.callingWindowStart ?? ""}
                      onChange={(event) =>
                        setWorkspaceDraft((current) =>
                          current ? { ...current, callingWindowStart: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calling window end</Label>
                    <Input
                      type="time"
                      value={workspaceSettings?.callingWindowEnd ?? ""}
                      onChange={(event) =>
                        setWorkspaceDraft((current) =>
                          current ? { ...current, callingWindowEnd: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-[26px] bg-white/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">DND compliance checks</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Contacts that fail policy gates stay blocked before bulk dialing begins.
                      </p>
                    </div>
                    <Switch
                      checked={workspaceSettings?.dndChecksEnabled ?? false}
                      onCheckedChange={(checked) =>
                        setWorkspaceDraft((current) => (current ? { ...current, dndChecksEnabled: checked } : current))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">Quiet hours auto-pause</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Active journeys pause automatically when the configured window closes.
                      </p>
                    </div>
                    <Switch
                      checked={workspaceSettings?.quietHoursAutoPause ?? false}
                      onCheckedChange={(checked) =>
                        setWorkspaceDraft((current) =>
                          current ? { ...current, quietHoursAutoPause: checked } : current,
                        )
                      }
                    />
                  </div>
                </div>

                <Button
                  disabled={!workspaceSettings || workspaceMutation.isPending}
                  onClick={() => workspaceSettings && workspaceMutation.mutate(workspaceSettings)}
                >
                  {workspaceMutation.isPending ? "Saving..." : "Save workspace defaults"}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Workspace inventory</p>
                <CardTitle className="mt-3 text-2xl">Other client workspaces</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workspaces.map((workspace) => (
                  <div key={workspace.id} className="inset-surface rounded-[24px] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-foreground">{workspace.name}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {workspace.members} members and {workspace.campaigns} campaigns
                        </p>
                      </div>
                      <Badge variant="secondary">{workspace.plan}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <Card className="rounded-[32px]">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-eyebrow">Role-based access</p>
                <CardTitle className="mt-3 text-2xl">Team members and workspace roles</CardTitle>
              </div>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button>Invite member</Button>
                </DialogTrigger>
                <DialogContent className="panel-strong max-w-lg rounded-[30px] border-white/70">
                  <DialogHeader>
                    <DialogTitle className="text-2xl">Invite a team member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={inviteDraft.name}
                        onChange={(event) => setInviteDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Aparna Rao"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={inviteDraft.email}
                        onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))}
                        placeholder="aparna@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={inviteDraft.role}
                        onValueChange={(value) =>
                          setInviteDraft((current) => ({
                            ...current,
                            role: value as InviteTeamMemberRequest["role"],
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {formatRole(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="w-full"
                      disabled={
                        inviteTeamMemberMutation.isPending ||
                        inviteDraft.name.trim().length === 0 ||
                        inviteDraft.email.trim().length === 0
                      }
                      onClick={() =>
                        inviteTeamMemberMutation.mutate({
                          ...inviteDraft,
                          name: inviteDraft.name.trim(),
                          email: inviteDraft.email.trim(),
                        })
                      }
                    >
                      {inviteTeamMemberMutation.isPending ? "Sending invite..." : "Send invite"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="inset-surface rounded-[24px] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{member.name}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{member.email}</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          teamRoleMutation.mutate({
                            userId: member.id,
                            role: value as InviteTeamMemberRequest["role"],
                          })
                        }
                      >
                        <SelectTrigger className="min-w-[220px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {formatRole(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={removeTeamMemberMutation.isPending}
                        onClick={() => removeTeamMemberMutation.mutate({ userId: member.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Security posture</p>
                <CardTitle className="mt-3 text-2xl">Sensitive data controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {securityControls.map((item) => (
                  <div key={item.title} className="inset-surface rounded-[24px] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-foreground">{item.title}</p>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
                      </div>
                      <Badge>{item.badge}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <p className="section-eyebrow">Transcript access</p>
                <CardTitle className="mt-3 text-2xl">Restricted artifact handling</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-[26px] bg-white/60 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-foreground">Restrict full transcripts</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Full transcripts stay limited to admin and reviewer roles. Operational views use redacted variants.
                      </p>
                    </div>
                    <Switch
                      checked={workspaceSettings?.restrictFullTranscripts ?? false}
                      onCheckedChange={(checked) =>
                        setWorkspaceDraft((current) =>
                          current ? { ...current, restrictFullTranscripts: checked } : current,
                        )
                      }
                    />
                  </div>
                </div>

                <div className="rounded-[26px] bg-primary/8 p-5">
                  <p className="text-base font-semibold text-foreground">Review notes</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    <li>Standard logs never contain raw sensitive values.</li>
                    <li>Masked views remain the default for exports and operations.</li>
                    <li>Restricted artifacts should be visible in audit history when opened.</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  disabled={!workspaceSettings || workspaceMutation.isPending}
                  onClick={() => workspaceSettings && workspaceMutation.mutate(workspaceSettings)}
                >
                  {workspaceMutation.isPending ? "Saving..." : "Save security defaults"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">Alerts and updates</p>
              <CardTitle className="mt-3 text-2xl">Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {notificationPreferences.map((item) => (
                <div key={item.key} className="inset-surface flex items-center justify-between gap-4 rounded-[24px] p-5">
                  <div>
                    <p className="text-base font-semibold text-foreground">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.detail}</p>
                  </div>
                  <Switch
                    checked={item.enabled}
                    onCheckedChange={(checked) =>
                      setNotificationDraft((current) => {
                        const next = current.filter((preference) => preference.key !== item.key);
                        next.push({ key: item.key, enabled: checked });
                        return next;
                      })
                    }
                  />
                </div>
              ))}

              <Button
                disabled={notificationMutation.isPending || notificationPreferences.length === 0}
                onClick={() =>
                  notificationMutation.mutate(notificationPreferences.map(({ key, enabled }) => ({ key, enabled })))
                }
              >
                {notificationMutation.isPending ? "Saving..." : "Save notification preferences"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api">
          <Card className="rounded-[32px]">
            <CardHeader>
              <p className="section-eyebrow">External integrations</p>
              <CardTitle className="mt-3 text-2xl">API keys and webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Active masked key</Label>
                <Input value={apiAccess?.maskedKey ?? "Not configured"} readOnly className="font-mono" />
              </div>

              <div className="space-y-2">
                <Label>Create API key</Label>
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <Input
                    value={apiKeyNameDraft}
                    onChange={(event) => setApiKeyNameDraft(event.target.value)}
                    placeholder="Primary integration key"
                  />
                  <Button
                    variant="outline"
                    disabled={createApiKeyMutation.isPending || apiKeyNameDraft.trim().length === 0}
                    onClick={() => createApiKeyMutation.mutate()}
                  >
                    {createApiKeyMutation.isPending ? "Creating..." : "Create key"}
                  </Button>
                </div>
              </div>

              {createdApiKey ? (
                <div className="rounded-[24px] bg-primary/8 p-5">
                  <p className="text-base font-semibold text-foreground">Copy this key now</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    The raw secret is only shown once. Store it in your deployment environment before closing this page.
                  </p>
                  <Input value={createdApiKey.rawKey} readOnly className="mt-4 font-mono" />
                </div>
              ) : null}

              <div className="space-y-3">
                <Label>Issued API keys</Label>
                {apiKeysQuery.isPending && apiKeys.length === 0 ? (
                  <div className="rounded-[24px] bg-white/60 px-4 py-5 text-sm text-muted-foreground">Loading API keys.</div>
                ) : null}
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="inset-surface rounded-[24px] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">{apiKey.name}</p>
                        <p className="mt-2 font-mono text-sm text-muted-foreground">{apiKey.maskedKey}</p>
                        <p className="mt-2 text-xs leading-6 text-muted-foreground">
                          Created {formatDateTime(apiKey.createdAt)}
                          {apiKey.lastUsedAt ? ` | Last used ${formatDateTime(apiKey.lastUsedAt)}` : " | Never used"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="gap-2"
                        disabled={deleteApiKeyMutation.isPending}
                        onClick={() => deleteApiKeyMutation.mutate({ id: apiKey.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {apiKeys.length === 0 ? (
                  <div className="rounded-[24px] bg-white/60 px-4 py-5 text-sm text-muted-foreground">
                    No API keys have been created for this workspace yet.
                  </div>
                ) : null}
              </div>

              <Separator className="bg-white/60" />

              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={webhookDraft.url}
                  onChange={(event) => setWebhookDraft((current) => ({ ...current, url: event.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <Label>Events</Label>
                <Textarea
                  value={webhookDraft.eventsText}
                  onChange={(event) => setWebhookDraft((current) => ({ ...current, eventsText: event.target.value }))}
                  placeholder="call.completed, call.failed, campaign.completed"
                  className="min-h-[120px]"
                />
                <div className="flex flex-wrap gap-2">
                  {webhookEvents.map((eventName) => (
                    <Badge key={eventName} variant="secondary" className="font-mono">
                      {eventName}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                disabled={webhookMutation.isPending || webhookDraft.url.trim().length === 0 || webhookEvents.length === 0}
                onClick={() =>
                  webhookMutation.mutate({
                    url: webhookDraft.url,
                    events: webhookEvents,
                  } satisfies WebhookConfig)
                }
              >
                {webhookMutation.isPending ? "Saving..." : "Save webhook settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
