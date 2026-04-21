create type public.campaign_pause_mode as enum ('manual', 'quiet_hours');

alter table public.campaigns
add column pause_mode public.campaign_pause_mode;

update public.campaigns
set pause_mode = 'manual'
where status = 'paused'
  and pause_mode is null;

create index campaigns_organization_pause_mode_idx
on public.campaigns (organization_id, pause_mode)
where deleted_at is null;
