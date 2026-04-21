create or replace function public.assert_campaign_transfer_queue_consistency()
returns trigger
language plpgsql
as $$
declare
  queue_org_id uuid;
begin
  if new.transfer_queue_id is null then
    return new;
  end if;

  select organization_id
    into queue_org_id
  from public.transfer_queues
  where id = new.transfer_queue_id;

  if queue_org_id is null then
    raise exception 'Transfer queue % does not exist.', new.transfer_queue_id using errcode = '23503';
  end if;

  if queue_org_id <> new.organization_id then
    raise exception 'Campaign cannot reference a transfer queue from another organization.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists campaigns_transfer_queue_tenant_guard on public.campaigns;
create trigger campaigns_transfer_queue_tenant_guard
before insert or update of organization_id, transfer_queue_id
on public.campaigns
for each row
execute function public.assert_campaign_transfer_queue_consistency();

create or replace function public.assert_campaign_contact_consistency()
returns trigger
language plpgsql
as $$
declare
  campaign_org_id uuid;
  contact_org_id uuid;
begin
  select organization_id
    into campaign_org_id
  from public.campaigns
  where id = new.campaign_id;

  if campaign_org_id is null then
    raise exception 'Campaign % does not exist.', new.campaign_id using errcode = '23503';
  end if;

  select organization_id
    into contact_org_id
  from public.contacts
  where id = new.contact_id;

  if contact_org_id is null then
    raise exception 'Contact % does not exist.', new.contact_id using errcode = '23503';
  end if;

  if campaign_org_id <> contact_org_id then
    raise exception 'Campaign assignments must stay within a single organization.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_contacts_tenant_guard on public.campaign_contacts;
create trigger campaign_contacts_tenant_guard
before insert or update of campaign_id, contact_id
on public.campaign_contacts
for each row
execute function public.assert_campaign_contact_consistency();

create or replace function public.assert_call_record_consistency()
returns trigger
language plpgsql
as $$
declare
  campaign_org_id uuid;
  contact_org_id uuid;
  queue_org_id uuid;
begin
  select organization_id
    into campaign_org_id
  from public.campaigns
  where id = new.campaign_id;

  if campaign_org_id is null then
    raise exception 'Campaign % does not exist.', new.campaign_id using errcode = '23503';
  end if;

  if campaign_org_id <> new.organization_id then
    raise exception 'Call records must reference campaigns in the same organization.' using errcode = '23514';
  end if;

  if new.contact_id is not null then
    select organization_id
      into contact_org_id
    from public.contacts
    where id = new.contact_id;

    if contact_org_id is null then
      raise exception 'Contact % does not exist.', new.contact_id using errcode = '23503';
    end if;

    if contact_org_id <> new.organization_id then
      raise exception 'Call records must reference contacts in the same organization.' using errcode = '23514';
    end if;
  end if;

  if new.transfer_queue_id is not null then
    select organization_id
      into queue_org_id
    from public.transfer_queues
    where id = new.transfer_queue_id;

    if queue_org_id is null then
      raise exception 'Transfer queue % does not exist.', new.transfer_queue_id using errcode = '23503';
    end if;

    if queue_org_id <> new.organization_id then
      raise exception 'Call records must reference transfer queues in the same organization.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists call_records_tenant_guard on public.call_records;
create trigger call_records_tenant_guard
before insert or update of organization_id, campaign_id, contact_id, transfer_queue_id
on public.call_records
for each row
execute function public.assert_call_record_consistency();
