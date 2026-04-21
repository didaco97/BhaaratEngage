create extension if not exists pgcrypto;

create type public.user_role as enum ('workspace_admin', 'campaign_manager', 'reviewer', 'operator', 'viewer');
create type public.campaign_status as enum ('draft', 'active', 'paused', 'completed');
create type public.field_type as enum ('text', 'number', 'date', 'boolean', 'select');
create type public.journey_action as enum ('sms', 'whatsapp', 'retry', 'none');
create type public.contact_status as enum ('eligible', 'opted_out', 'suppressed', 'dnd');
create type public.call_status as enum ('completed', 'no_answer', 'busy', 'failed', 'transferred');
create type public.transcript_mode as enum ('redacted', 'restricted', 'none');
create type public.journey_status as enum ('active', 'paused', 'completed');
create type public.alert_severity as enum ('warning', 'risk', 'info');
create type public.transcript_speaker as enum ('Bot', 'User', 'System');
create type public.integration_provider as enum ('plivo', 'sarvam', 'openai');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.requesting_organization_id()
returns uuid
language sql
stable
as $$
  select nullif((current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id'), '')::uuid
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'enterprise',
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.user_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transfer_queues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider_queue_id text,
  active_agents integer not null default 0,
  waiting_count integer not null default 0,
  current_sla_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  workspace_name text not null,
  default_language text not null,
  calling_window_start time not null,
  calling_window_end time not null,
  dnd_checks_enabled boolean not null default true,
  quiet_hours_auto_pause boolean not null default true,
  restrict_full_transcripts boolean not null default true,
  default_transfer_queue_id uuid references public.transfer_queues(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  status public.campaign_status not null default 'draft',
  language text not null,
  vertical text not null,
  template text not null,
  caller_identity text not null,
  summary text not null default '',
  purpose_statement text not null default '',
  intro_script text not null default '',
  launched_at timestamptz,
  calling_window_start time not null,
  calling_window_end time not null,
  transfer_enabled boolean not null default false,
  transfer_queue_id uuid references public.transfer_queues(id) on delete set null,
  retry_window_hours integer not null default 4,
  max_retries integer not null default 3,
  concurrency_limit integer not null default 50,
  pacing_per_minute integer not null default 20,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index campaigns_organization_status_idx on public.campaigns (organization_id, status);
create index campaigns_organization_language_idx on public.campaigns (organization_id, language);
create index campaigns_launched_at_idx on public.campaigns (launched_at desc nulls last);

create table public.campaign_fields (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  field_key text not null,
  label text not null,
  prompt text not null,
  type public.field_type not null,
  required boolean not null default true,
  sensitive boolean not null default false,
  verification_label text not null default '',
  retry_limit integer not null default 3,
  validation_rule text not null default '',
  ask_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, field_key),
  unique (campaign_id, ask_order)
);

create table public.campaign_journey_rules (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  unanswered_action public.journey_action not null default 'sms',
  partial_action public.journey_action not null default 'whatsapp',
  retry_window_hours integer not null default 4,
  max_retries integer not null default 3,
  concurrency_limit integer not null default 50,
  pacing_per_minute integer not null default 20,
  csv_source text not null default '',
  next_checkpoint_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  language text not null,
  status public.contact_status not null default 'eligible',
  consent boolean not null default false,
  source text not null,
  last_contacted_at timestamptz,
  do_not_call boolean not null default false,
  suppression_reason text,
  custom_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone)
);

create table public.contact_import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_filename text not null,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  skipped_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  invalid_rows integer not null default 0,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.contact_import_jobs(id) on delete cascade,
  row_number integer not null,
  payload jsonb not null,
  status text not null,
  error_message text,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  priority integer not null default 100,
  status text not null default 'pending',
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, contact_id)
);

create index campaign_contacts_campaign_status_idx on public.campaign_contacts (campaign_id, status);

create table public.call_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  transfer_queue_id uuid references public.transfer_queues(id) on delete set null,
  call_uuid text not null,
  provider text not null default 'plivo',
  status public.call_status not null,
  disposition text not null,
  confirmed boolean not null default false,
  duration_seconds integer not null default 0,
  started_at timestamptz not null,
  answered_at timestamptz,
  ended_at timestamptz,
  recording_url text,
  transcript_mode public.transcript_mode not null default 'none',
  error_code text,
  fields_collected integer not null default 0,
  fields_total integer not null default 0,
  retry_attempt integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_uuid)
);

create index call_records_campaign_status_started_idx on public.call_records (campaign_id, status, started_at desc);
create index call_records_provider_idx on public.call_records (provider);
create index call_records_contact_idx on public.call_records (contact_id);

create table public.call_transcript_turns (
  id uuid primary key default gen_random_uuid(),
  call_record_id uuid not null references public.call_records(id) on delete cascade,
  speaker public.transcript_speaker not null,
  text_raw text not null,
  text_redacted text not null,
  confidence numeric(5,4),
  turn_started_at timestamptz,
  turn_ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index call_transcript_turns_call_record_idx on public.call_transcript_turns (call_record_id, created_at);

create table public.collected_data (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  call_record_id uuid not null references public.call_records(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  field_key text not null,
  raw_value_encrypted text not null,
  masked_value text not null,
  extracted_value text not null,
  confidence_score numeric(5,4) not null default 0,
  is_confirmed boolean not null default false,
  collected_at timestamptz not null default now()
);

create index collected_data_campaign_idx on public.collected_data (campaign_id, collected_at desc);
create index collected_data_call_record_idx on public.collected_data (call_record_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  detail text not null,
  severity public.alert_severity not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  permissions jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.outbound_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null,
  events jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider public.integration_provider not null,
  encrypted_payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status public.journey_status not null default 'active',
  sequence jsonb not null default '[]'::jsonb,
  total_contacts integer not null default 0,
  processed integer not null default 0,
  success_rate numeric(5,2) not null default 0,
  retry_window_hours integer not null default 4,
  concurrency_limit integer not null default 50,
  pacing_per_minute integer not null default 20,
  next_checkpoint_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id)
);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_transfer_queues_updated_at
before update on public.transfer_queues
for each row execute function public.set_updated_at();

create trigger set_workspace_settings_updated_at
before update on public.workspace_settings
for each row execute function public.set_updated_at();

create trigger set_campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create trigger set_campaign_fields_updated_at
before update on public.campaign_fields
for each row execute function public.set_updated_at();

create trigger set_campaign_journey_rules_updated_at
before update on public.campaign_journey_rules
for each row execute function public.set_updated_at();

create trigger set_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create trigger set_contact_import_jobs_updated_at
before update on public.contact_import_jobs
for each row execute function public.set_updated_at();

create trigger set_campaign_contacts_updated_at
before update on public.campaign_contacts
for each row execute function public.set_updated_at();

create trigger set_call_records_updated_at
before update on public.call_records
for each row execute function public.set_updated_at();

create trigger set_compliance_alerts_updated_at
before update on public.compliance_alerts
for each row execute function public.set_updated_at();

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger set_outbound_webhooks_updated_at
before update on public.outbound_webhooks
for each row execute function public.set_updated_at();

create trigger set_integration_secrets_updated_at
before update on public.integration_secrets
for each row execute function public.set_updated_at();

create trigger set_journeys_updated_at
before update on public.journeys
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.transfer_queues enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_fields enable row level security;
alter table public.campaign_journey_rules enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_import_jobs enable row level security;
alter table public.contact_import_rows enable row level security;
alter table public.campaign_contacts enable row level security;
alter table public.call_records enable row level security;
alter table public.call_transcript_turns enable row level security;
alter table public.collected_data enable row level security;
alter table public.audit_logs enable row level security;
alter table public.compliance_alerts enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.api_keys enable row level security;
alter table public.outbound_webhooks enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.journeys enable row level security;

create policy "tenant read access on user_profiles"
on public.user_profiles for select
using (organization_id = public.requesting_organization_id());

create policy "tenant read access on transfer_queues"
on public.transfer_queues for select
using (organization_id = public.requesting_organization_id());

create policy "tenant manage access on transfer_queues"
on public.transfer_queues for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on workspace_settings"
on public.workspace_settings for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on campaigns"
on public.campaigns for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant read access on campaign_fields"
on public.campaign_fields for select
using (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_fields.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on campaign_fields"
on public.campaign_fields for all
using (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_fields.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_fields.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on campaign_journey_rules"
on public.campaign_journey_rules for all
using (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_journey_rules.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_journey_rules.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on contacts"
on public.contacts for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on contact_import_jobs"
on public.contact_import_jobs for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant read access on contact_import_rows"
on public.contact_import_rows for select
using (
  exists (
    select 1
    from public.contact_import_jobs
    where public.contact_import_jobs.id = contact_import_rows.import_job_id
      and public.contact_import_jobs.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant read access on campaign_contacts"
on public.campaign_contacts for select
using (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_contacts.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on campaign_contacts"
on public.campaign_contacts for all
using (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_contacts.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
)
with check (
  exists (
    select 1
    from public.campaigns
    where public.campaigns.id = campaign_contacts.campaign_id
      and public.campaigns.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on call_records"
on public.call_records for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant read access on call_transcript_turns"
on public.call_transcript_turns for select
using (
  exists (
    select 1
    from public.call_records
    where public.call_records.id = call_transcript_turns.call_record_id
      and public.call_records.organization_id = public.requesting_organization_id()
  )
);

create policy "tenant manage access on collected_data"
on public.collected_data for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on audit_logs"
on public.audit_logs for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on compliance_alerts"
on public.compliance_alerts for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on notification_preferences"
on public.notification_preferences for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on api_keys"
on public.api_keys for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on outbound_webhooks"
on public.outbound_webhooks for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on integration_secrets"
on public.integration_secrets for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create policy "tenant manage access on journeys"
on public.journeys for all
using (organization_id = public.requesting_organization_id())
with check (organization_id = public.requesting_organization_id());

create or replace view public.campaign_stats_view as
select
  c.id as campaign_id,
  c.organization_id,
  c.name,
  c.status,
  count(distinct cc.contact_id) as contact_count,
  count(distinct cr.id) as total_attempts,
  coalesce(round(avg(case when cr.status = 'completed' then 100 else 0 end)::numeric, 2), 0) as completion_rate,
  coalesce(round(avg(case when cr.status in ('completed', 'transferred') then 100 else 0 end)::numeric, 2), 0) as answer_rate,
  coalesce(round(avg(case when cr.confirmed then 100 else 0 end)::numeric, 2), 0) as confirmation_rate
from public.campaigns c
left join public.campaign_contacts cc on cc.campaign_id = c.id
left join public.call_records cr on cr.campaign_id = c.id
where c.deleted_at is null
group by c.id;

create or replace view public.dashboard_overview_view as
select
  organization_id,
  count(*) filter (where status = 'active') as active_campaigns,
  count(*) as total_campaigns,
  (select count(*) from public.contacts contacts where contacts.organization_id = campaigns.organization_id) as total_contacts,
  (select count(*) from public.call_records call_records where call_records.organization_id = campaigns.organization_id) as total_calls
from public.campaigns campaigns
where campaigns.deleted_at is null
group by organization_id;

create or replace view public.daily_call_volume_view as
select
  organization_id,
  date_trunc('day', started_at) as day,
  count(*) as calls,
  count(*) filter (where status in ('completed', 'transferred')) as answered,
  count(*) filter (where status = 'completed') as completed
from public.call_records
group by organization_id, date_trunc('day', started_at);

create or replace view public.disposition_breakdown_view as
select
  organization_id,
  disposition,
  count(*) as total
from public.call_records
group by organization_id, disposition;

create or replace view public.field_dropoff_view as
select
  cd.organization_id,
  cd.field_key,
  count(*) as captured_count,
  count(*) filter (where not cd.is_confirmed) as unconfirmed_count
from public.collected_data cd
group by cd.organization_id, cd.field_key;

create or replace view public.provider_performance_view as
select
  organization_id,
  provider,
  date_trunc('day', started_at) as day,
  round(avg(case when status in ('completed', 'transferred') then 100 else 0 end)::numeric, 2) as success_rate
from public.call_records
group by organization_id, provider, date_trunc('day', started_at);

create or replace view public.transfer_queue_status_view as
select
  organization_id,
  id as transfer_queue_id,
  name,
  waiting_count,
  current_sla_seconds
from public.transfer_queues;

create or replace view public.recent_audit_events_view as
select
  organization_id,
  id,
  action,
  entity_type,
  entity_id,
  created_at
from public.audit_logs
order by created_at desc;

create or replace view public.compliance_alerts_view as
select
  organization_id,
  id,
  title,
  detail,
  severity,
  created_at
from public.compliance_alerts
where is_active = true
order by created_at desc;
