import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp, Filter, PencilLine, Search, Trash2, Upload, UserX } from "lucide-react";

import PageStateCard from "@/components/PageStateCard";
import StatusBadge from "@/components/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useCurrentViewer } from "@/hooks/useCurrentViewer";
import { hasRoleAtLeast } from "@/lib/access-control";
import { api } from "@/lib/api-client";
import type { Contact, UpdateContactRequest } from "@/lib/api-contracts";
import { formatDateTime, formatLabel } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";

const supportedLanguages = ["hindi", "english", "tamil", "telugu", "kannada", "bengali", "marathi", "gujarati", "urdu"] as const;

type ImportDraft = {
  filename: string;
  source: string;
  csvText: string;
  defaultLanguage: Contact["language"];
  defaultConsent: boolean;
};

function createImportDraft(): ImportDraft {
  return {
    filename: "contacts-import.csv",
    source: "",
    csvText: "",
    defaultLanguage: "english",
    defaultConsent: true,
  };
}

function hasImportDataRows(csvText: string) {
  return csvText
    .split(/\r?\n/u)
    .slice(1)
    .some((line) => line.trim().length > 0);
}

function createContactDraft(contact: Contact): UpdateContactRequest {
  return {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    language: contact.language,
    consent: contact.consent,
    source: contact.source,
  };
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { viewer } = useCurrentViewer();
  const queryClient = useQueryClient();
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importDraft, setImportDraft] = useState<ImportDraft>(createImportDraft());
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editDraft, setEditDraft] = useState<UpdateContactRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const activeStatusFilter = statusFilter as "all" | "eligible" | "opted_out" | "suppressed" | "dnd";
  const campaignsQuery = useQuery({
    queryKey: queryKeys.campaigns(),
    queryFn: () => api.listCampaigns(),
  });
  const contactInventoryQuery = useQuery({
    queryKey: queryKeys.contacts(),
    queryFn: () => api.listContacts(),
  });
  const filteredQuery = useQuery({
    queryKey: queryKeys.contacts({ search, status: statusFilter }),
    queryFn: () => api.listContacts({ search, status: activeStatusFilter }),
  });

  const refreshContacts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["contacts"] }),
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };

  const exportMutation = useMutation({
    mutationFn: () => api.exportContacts({ search, status: activeStatusFilter }),
    onSuccess: () => {
      toast({
        title: "Contact export ready",
        description: "The current contact ledger was downloaded as a CSV file.",
      });
    },
    onError: (error) => {
      toast({
        title: "Contact export failed",
        description: error instanceof Error ? error.message : "The contact export could not be created.",
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: (draft: ImportDraft) =>
      api.importContacts({
        filename: draft.filename,
        csvText: draft.csvText,
        defaultLanguage: draft.defaultLanguage,
        defaultConsent: draft.defaultConsent,
        ...(draft.source.trim() ? { source: draft.source.trim() } : {}),
      }),
    onSuccess: async (summary) => {
      await refreshContacts();
      setImportOpen(false);
      setImportDraft(createImportDraft());
      toast({
        title: "Contacts imported",
        description: `${summary.imported} imported, ${summary.duplicates} duplicates, and ${summary.invalid} invalid rows were processed.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "The CSV import could not be completed.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { readonly id: string; readonly input: UpdateContactRequest }) => api.updateContact(id, input),
    onSuccess: async (contact) => {
      await refreshContacts();
      setEditingContact(null);
      setEditDraft(null);
      toast({
        title: "Contact updated",
        description: `${contact.name} was saved successfully.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Contact update failed",
        description: error instanceof Error ? error.message : "The contact changes could not be saved.",
        variant: "destructive",
      });
    },
  });

  const doNotCallMutation = useMutation({
    mutationFn: (contact: Contact) => api.markContactDoNotCall(contact.id),
    onSuccess: async (contact) => {
      await refreshContacts();
      toast({
        title: "Marked do not call",
        description: `${contact.name} is now blocked from outbound calling.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Do-not-call update failed",
        description: error instanceof Error ? error.message : "The contact could not be updated.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (contact: Contact) => api.deleteContact(contact.id),
    onSuccess: async () => {
      await refreshContacts();
      setDeleteTarget(null);
      toast({
        title: "Contact deleted",
        description: "The contact was removed from the workspace.",
      });
    },
    onError: (error) => {
      toast({
        title: "Contact deletion failed",
        description: error instanceof Error ? error.message : "The contact could not be deleted.",
        variant: "destructive",
      });
    },
  });
  const campaignNameById = useMemo(
    () => Object.fromEntries((campaignsQuery.data ?? []).map((campaign) => [campaign.id, campaign.name])),
    [campaignsQuery.data],
  );
  const contactInventory = contactInventoryQuery.data ?? [];
  const filtered = filteredQuery.data ?? [];
  const pageError = campaignsQuery.error ?? contactInventoryQuery.error ?? filteredQuery.error;

  useEffect(() => {
    if (editingContact) {
      setEditDraft(createContactDraft(editingContact));
    }
  }, [editingContact]);

  const openImportDialog = () => {
    setImportDraft(createImportDraft());
    setImportOpen(true);
  };

  const closeImportDialog = () => {
    setImportOpen(false);
    setImportDraft(createImportDraft());
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  };

  const openEditDialog = (contact: Contact) => {
    setEditingContact(contact);
    setEditDraft(createContactDraft(contact));
  };

  const closeEditDialog = () => {
    setEditingContact(null);
    setEditDraft(null);
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const csvText = await file.text();
      setImportDraft((current) => ({ ...current, filename: file.name, csvText }));
    } catch (error) {
      toast({
        title: "File read failed",
        description: error instanceof Error ? error.message : "The selected file could not be read.",
        variant: "destructive",
      });
    }
  };

  if (contactInventoryQuery.isPending && !contactInventoryQuery.data) {
    return (
      <PageStateCard
        title="Loading contacts"
        description="Fetching contact intake, consent state, and policy-gated ledger data."
      />
    );
  }

  if (pageError) {
    return (
      <PageStateCard
        title="Contact ledger unavailable"
        description={pageError instanceof Error ? pageError.message : "Contact data could not be loaded."}
      />
    );
  }

  const eligibleCount = contactInventory.filter((contact) => contact.status === "eligible").length;
  const optedOutCount = contactInventory.filter((contact) => contact.status === "opted_out").length;
  const dndCount = contactInventory.filter((contact) => contact.status === "dnd").length;
  const canSaveEdit =
    Boolean(editDraft) &&
    Boolean(editDraft?.name.trim()) &&
    Boolean(editDraft?.phone.trim()) &&
    Boolean(editDraft?.source.trim()) &&
    Boolean(editDraft?.language);
  const canImport = importDraft.filename.trim().length > 0 && hasImportDataRows(importDraft.csvText);
  const canExportContacts = hasRoleAtLeast(viewer?.role, "reviewer");

  return (
    <div className="space-y-5">
      <section className="panel-strong rounded-[34px] p-6 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="section-eyebrow">Contact operations</p>
            <h2 className="page-hero-title mt-4 font-semibold text-foreground">
              CSV uploads, consent state, suppression, and quiet-hour eligibility now share one clean control surface.
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
              This page is reorganized around the real v1 ingestion flow from the PRD: validate schema, dedupe contacts,
              enforce policy, and only then move eligible contacts into journey execution.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {canExportContacts ? (
              <Button variant="outline" className="gap-2" disabled={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? "Exporting..." : "Export contacts"}
              </Button>
            ) : null}
            <Button className="gap-2" onClick={openImportDialog}>
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-4">
          {[
            { label: "Total contacts", value: contactInventory.length },
            { label: "Eligible", value: eligibleCount },
            { label: "Opted out", value: optedOutCount },
            { label: "DND blocked", value: dndCount },
          ].map((item) => (
            <div key={item.label} className="inset-surface rounded-[24px] p-5">
              <p className="section-eyebrow">{item.label}</p>
              <p className="metric-value mt-4 text-4xl text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-[32px]">
          <CardHeader>
            <p className="section-eyebrow">Ingestion methodology</p>
            <CardTitle className="mt-3 text-2xl">Policy-aware contact intake</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                title: "Validate and dedupe",
                body: "CSV schema is checked before import, malformed rows are rejected, and duplicates are removed before dialing.",
              },
              {
                title: "Store consent and suppression state",
                body: "Each record keeps consent, suppression, DND, language, and workspace ownership together for clear policy gating.",
              },
              {
                title: "Block ineligible contacts",
                body: "Quiet hours, suppression, and opt-out logic stop bulk dialing before journeys even start.",
              },
            ].map((item) => (
              <div key={item.title} className="inset-surface rounded-[24px] p-5">
                <p className="text-base font-semibold text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardHeader className="gap-4">
            <div>
              <p className="section-eyebrow">Search and filters</p>
              <CardTitle className="mt-3 text-2xl">Contact ledger</CardTitle>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, phone, workspace, or source"
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
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="opted_out">Opted out</SelectItem>
                  <SelectItem value="suppressed">Suppressed</SelectItem>
                  <SelectItem value="dnd">DND blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/60 hover:bg-transparent">
                  <TableHead className="px-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Workspace</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Source</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Consent</TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Actions</TableHead>
                  <TableHead className="pr-6 text-right text-xs uppercase tracking-[0.14em] text-muted-foreground">Last touch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contact) => (
                  <TableRow key={contact.id} className="border-white/50 hover:bg-white/35">
                    <TableCell className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{contact.phone}</p>
                        {contact.email ? <p className="mt-1 text-xs text-muted-foreground">{contact.email}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.workspace}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-foreground">{contact.source}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {contact.campaignId ? campaignNameById[contact.campaignId] : "Not assigned yet"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={contact.status} />
                    </TableCell>
                    <TableCell>
                      {contact.consent ? <Badge variant="secondary">Consent on file</Badge> : <Badge variant="outline">Pending review</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => openEditDialog(contact)}>
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          disabled={contact.status === "dnd" || doNotCallMutation.isPending}
                          onClick={() => doNotCallMutation.mutate(contact)}
                        >
                          <UserX className="h-4 w-4" />
                          Do not call
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(contact)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                      {contact.lastContactedAt ? formatDateTime(contact.lastContactedAt) : "No recent attempt"}
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 ? (
                  <TableRow className="border-white/50">
                    <TableCell colSpan={7} className="px-6 py-16 text-center text-sm text-muted-foreground">
                      No contacts match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={importOpen} onOpenChange={(open) => (open ? setImportOpen(true) : closeImportDialog())}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[32px]">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-primary/10 text-primary">
                <FileUp className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Import contacts</DialogTitle>
                <DialogDescription>
                  Upload a CSV file or paste its contents. Imported rows are deduped and validated before they hit the ledger.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-2">
                <Label htmlFor="import-filename">Filename</Label>
                <Input
                  id="import-filename"
                  value={importDraft.filename}
                  onChange={(event) => setImportDraft((current) => ({ ...current, filename: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Default language</Label>
                <Select
                  value={importDraft.defaultLanguage}
                  onValueChange={(value) => setImportDraft((current) => ({ ...current, defaultLanguage: value as Contact["language"] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
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

            <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
              <div className="space-y-2">
                <Label htmlFor="import-source">Source label</Label>
                <Input
                  id="import-source"
                  value={importDraft.source}
                  onChange={(event) => setImportDraft((current) => ({ ...current, source: event.target.value }))}
                  placeholder="April contact upload"
                />
              </div>
              <div className="rounded-[24px] bg-white/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Default consent</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">New rows inherit this value when the CSV omits consent.</p>
                  </div>
                  <Switch
                    checked={importDraft.defaultConsent}
                    onCheckedChange={(checked) => setImportDraft((current) => ({ ...current, defaultConsent: checked }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="import-csv">CSV text</Label>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => importFileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Choose file
                </Button>
              </div>
              <Textarea
                id="import-csv"
                className="min-h-[220px] font-mono text-xs"
                value={importDraft.csvText}
                onChange={(event) => setImportDraft((current) => ({ ...current, csvText: event.target.value }))}
                placeholder="name,phone,email,language,consent"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Accepted columns: `name`, `phone`, `email`, `language`, `consent`, `source`. Missing columns fall back to the dialog defaults.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" onClick={closeImportDialog}>
              Cancel
            </Button>
            <Button disabled={!canImport || importMutation.isPending} onClick={() => importMutation.mutate(importDraft)}>
              {importMutation.isPending ? "Importing..." : "Import contacts"}
            </Button>
          </DialogFooter>

          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFileChange}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingContact && editDraft)} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[32px]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl">Edit contact</DialogTitle>
            <DialogDescription>Keep the contact ledger aligned with the latest consent, language, and source details.</DialogDescription>
          </DialogHeader>

          {editDraft ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={editDraft.name} onChange={(event) => setEditDraft((current) => (current ? { ...current, name: event.target.value } : current))} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editDraft.phone} onChange={(event) => setEditDraft((current) => (current ? { ...current, phone: event.target.value } : current))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={editDraft.email ?? ""}
                    onChange={(event) => setEditDraft((current) => (current ? { ...current, email: event.target.value.trim() ? event.target.value : undefined } : current))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={editDraft.language}
                    onValueChange={(value) => setEditDraft((current) => (current ? { ...current, language: value as Contact["language"] } : current))}
                  >
                    <SelectTrigger>
                      <SelectValue />
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

              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={editDraft.source} onChange={(event) => setEditDraft((current) => (current ? { ...current, source: event.target.value } : current))} />
              </div>

              <div className="rounded-[24px] bg-white/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Consent on file</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Toggle this when the contact has explicitly opted in or withdrawn consent.</p>
                  </div>
                  <Switch checked={editDraft.consent} onCheckedChange={(checked) => setEditDraft((current) => (current ? { ...current, consent: checked } : current))} />
                </div>
              </div>

              <Separator className="bg-white/60" />

              <DialogFooter className="gap-2 sm:gap-3">
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button disabled={!canSaveEdit || updateMutation.isPending || !editingContact} onClick={() => editingContact && editDraft && updateMutation.mutate({ id: editingContact.id, input: editDraft })}>
                  {updateMutation.isPending ? "Saving..." : "Save contact"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name} will be removed from this workspace and the ledger will refetch after the deletion completes.`
                : "This contact will be removed from the workspace."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Delete contact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
