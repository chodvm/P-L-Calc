-- =========================================================
-- URGENT CARE P&L – RESET (multi-org, revised fixed-cost divisor, slim seed)
-- Notes:
--   - Drops prior app objects; does NOT modify auth.*
--   - Seeds org/members/staff/fixed costs/insurers/rates/goals only.
--   - Skips demo daily logs & payer mix.
--   - Adds helper function to save daily log + staff assignments in one call.
-- =========================================================

-- ---------- DROP EVERYTHING ----------
drop view if exists v_daily_pnl_with_goals cascade;
drop view if exists v_daily_pnl cascade;
drop view if exists v_daily_materials_costs cascade;
drop view if exists v_daily_revenue cascade;
drop view if exists v_daily_mix_avg cascade;
drop view if exists v_org_avg_reimbursement cascade;
drop view if exists v_daily_fixed_costs cascade;
drop view if exists v_daily_labor_costs cascade;
drop view if exists v_fixed_costs_daily cascade;

drop table if exists daily_insurance_mix cascade;
drop table if exists daily_staff_assignments cascade;
drop table if exists daily_log cascade;
drop table if exists reimbursement_rates cascade;
drop table if exists insurances cascade;
drop table if exists fixed_costs cascade;
drop table if exists staff cascade;
drop table if exists goals cascade;
drop table if exists user_org_memberships cascade;
drop table if exists orgs cascade;

drop function if exists is_org_boss(uuid) cascade;
drop function if exists is_org_admin(uuid) cascade;
drop function if exists is_org_member(uuid) cascade;
drop function if exists patients_needed_for_margin(numeric, numeric, numeric) cascade;
drop function if exists patients_needed_for_profit_amount(numeric, numeric, numeric) cascade;
drop function if exists save_daily_log_and_assignments(uuid, date, integer, uuid[]) cascade;

drop type if exists staff_role cascade;
drop type if exists cost_frequency cascade;
drop type if exists user_role cascade;

-- ---------- EXTENSIONS ----------
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------- ENUMS ----------
create type staff_role as enum (
  'Physician', 'PA', 'RN', 'LVN', 'MA', 'Xray Tech', 'Front Desk', 'Admin'
);

create type cost_frequency as enum ('daily','weekly','monthly','quarterly','yearly');

create type user_role as enum ('boss','admin','staff');

-- ---------- TABLES ----------
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table user_org_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  role user_role not null default 'staff',
  primary key (user_id, org_id),
  created_at timestamptz not null default now()
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  full_name text not null,
  role staff_role not null,
  active boolean not null default true,
  base_hourly_rate numeric(10,2) not null,
  default_daily_hours numeric(5,2),
  created_at timestamptz not null default now()
);

create table fixed_costs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null,
  frequency cost_frequency not null default 'monthly',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table insurances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(org_id, name)
);

create table reimbursement_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  insurance_id uuid not null references insurances(id) on delete cascade,
  avg_amount_per_visit numeric(10,2) not null,
  effective_from date not null,
  effective_to date
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  target_profit_margin numeric(5,2),
  target_profit_amount numeric(12,2),
  scope text not null default 'daily',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table daily_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  work_date date not null,
  patients_seen integer,
  avg_reimbursement_override numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  unique(org_id, work_date)
);

create table daily_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  daily_log_id uuid not null references daily_log(id) on delete cascade,
  staff_id uuid not null references staff(id),
  hours_worked numeric(5,2) not null,
  hourly_rate_snapshot numeric(10,2) not null,
  role_snapshot staff_role not null,
  created_at timestamptz not null default now()
);

create table daily_insurance_mix (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  daily_log_id uuid not null references daily_log(id) on delete cascade,
  insurance_id uuid not null references insurances(id),
  patients_count integer not null,
  avg_reimbursement_snapshot numeric(10,2) not null,
  created_at timestamptz not null default now(),
  unique(org_id, daily_log_id, insurance_id)
);

-- ---------- P&L FUNCTIONS ----------
create function patients_needed_for_margin(
  total_cost numeric, avg_reimb numeric, target_margin_percent numeric
) returns numeric language sql immutable as $$
  select case
    when avg_reimb is null or avg_reimb = 0 then null
    when target_margin_percent is null then null
    when (1 - target_margin_percent/100.0) = 0 then null
    else total_cost / (avg_reimb * (1 - target_margin_percent/100.0))
  end;
$$;

create function patients_needed_for_profit_amount(
  total_cost numeric, avg_reimb numeric, target_profit_amount numeric
) returns numeric language sql immutable as $$
  select case
    when avg_reimb is null or avg_reimb = 0 then null
    when target_profit_amount is null then null
    else (total_cost + target_profit_amount) / avg_reimb
  end;
$$;

-- ---------- VIEWS ----------
create or replace view v_fixed_costs_daily as
select
  fc.org_id,
  fc.id as fixed_cost_id,
  fc.name,
  fc.amount,
  fc.frequency,
  case fc.frequency
    when 'daily' then fc.amount
    when 'weekly' then fc.amount / 7.0
    when 'monthly' then fc.amount / 30.0
    when 'quarterly' then fc.amount / 120.0
    when 'yearly' then fc.amount / 365.0
  end as daily_amount
from fixed_costs fc
where fc.active = true;

create or replace view v_daily_labor_costs as
select
  d.org_id,
  d.id as daily_log_id,
  d.work_date,
  coalesce(sum(a.hours_worked * a.hourly_rate_snapshot), 0) as total_labor_cost
from daily_log d
left join daily_staff_assignments a
  on a.daily_log_id = d.id and a.org_id = d.org_id
group by 1,2,3;

create or replace view v_daily_fixed_costs as
select
  d.org_id,
  d.id as daily_log_id,
  d.work_date,
  coalesce(sum(vf.daily_amount), 0) as total_fixed_cost
from daily_log d
left join v_fixed_costs_daily vf on vf.org_id = d.org_id
group by 1,2,3;

create or replace view v_org_avg_reimbursement as
with latest as (
  select rr.*,
         row_number() over(partition by rr.org_id, rr.insurance_id order by rr.effective_from desc nulls last) as rn
  from reimbursement_rates rr
)
select org_id,
       avg(avg_amount_per_visit) as org_avg_reimb
from latest
where rn = 1
group by org_id;

create or replace view v_daily_mix_avg as
select
  d.org_id,
  d.id as daily_log_id,
  case when sum(m.patients_count) is null or sum(m.patients_count)=0
       then null
       else sum(m.patients_count * m.avg_reimbursement_snapshot)::numeric / nullif(sum(m.patients_count),0)
  end as mix_avg_reimb
from daily_log d
left join daily_insurance_mix m on m.daily_log_id = d.id and m.org_id = d.org_id
group by 1,2;

create or replace view v_daily_revenue as
select
  d.org_id,
  d.id as daily_log_id,
  d.work_date,
  d.patients_seen,
  coalesce(dm.mix_avg_reimb, d.avg_reimbursement_override, orgavg.org_avg_reimb) as avg_reimb_used,
  case when d.patients_seen is null then null
       else d.patients_seen * coalesce(dm.mix_avg_reimb, d.avg_reimbursement_override, orgavg.org_avg_reimb)
  end as total_revenue
from daily_log d
left join v_daily_mix_avg dm on dm.daily_log_id = d.id and dm.org_id = d.org_id
left join v_org_avg_reimbursement orgavg on orgavg.org_id = d.org_id;

create or replace view v_daily_materials_costs as
select
  d.org_id,
  d.id as daily_log_id,
  d.work_date,
  0::numeric as total_materials_cost
from daily_log d;

create or replace view v_daily_pnl as
select
  d.org_id,
  d.id as daily_log_id,
  d.work_date,
  lc.total_labor_cost,
  fc.total_fixed_cost,
  mc.total_materials_cost,
  (coalesce(lc.total_labor_cost,0) + coalesce(fc.total_fixed_cost,0) + coalesce(mc.total_materials_cost,0)) as total_cost,
  rev.patients_seen,
  rev.avg_reimb_used,
  rev.total_revenue,
  (coalesce(rev.total_revenue,0) - (coalesce(lc.total_labor_cost,0) + coalesce(fc.total_fixed_cost,0) + coalesce(mc.total_materials_cost,0))) as profit,
  case when coalesce(rev.avg_reimb_used,0) = 0 then null
       else (coalesce(lc.total_labor_cost,0) + coalesce(fc.total_fixed_cost,0) + coalesce(mc.total_materials_cost,0)) / nullif(rev.avg_reimb_used,0)
  end as break_even_patients
from daily_log d
left join v_daily_labor_costs     lc on lc.org_id = d.org_id and lc.daily_log_id = d.id
left join v_daily_fixed_costs     fc on fc.org_id = d.org_id and fc.daily_log_id = d.id
left join v_daily_materials_costs mc on mc.org_id = d.org_id and mc.daily_log_id = d.id
left join v_daily_revenue         rev on rev.org_id = d.org_id and rev.daily_log_id = d.id;

create or replace view v_daily_pnl_with_goals as
with active_goal as (
  select distinct on (g.org_id)
    g.org_id, g.target_profit_margin, g.target_profit_amount
  from goals g
  where g.active = true
  order by g.org_id, g.created_at desc
)
select p.*,
  patients_needed_for_margin(p.total_cost, p.avg_reimb_used, ag.target_profit_margin)  as patients_for_target_margin,
  patients_needed_for_profit_amount(p.total_cost, p.avg_reimb_used, ag.target_profit_amount) as patients_for_target_amount
from v_daily_pnl p
left join active_goal ag on ag.org_id = p.org_id;

-- ---------- RLS HELPERS ----------
create function is_org_boss(p_org uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from user_org_memberships uom
    where uom.org_id = p_org and uom.user_id = auth.uid() and uom.role = 'boss'
  );
$$;

create function is_org_admin(p_org uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from user_org_memberships uom
    where uom.org_id = p_org and uom.user_id = auth.uid() and uom.role in ('boss','admin')
  );
$$;

create function is_org_member(p_org uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from user_org_memberships uom
    where uom.org_id = p_org and uom.user_id = auth.uid()
  );
$$;

-- ---------- SEED (org/members/staff/fixed/insurers/rates/goals) ----------
insert into orgs (name) values ('Have Elite urgent care') on conflict (name) do nothing;

DO $$
DECLARE v_org uuid;
BEGIN
  select id into v_org from orgs where name='Have Elite urgent care' limit 1;

  -- Memberships (replace UUIDs as needed)
  insert into user_org_memberships (user_id, org_id, role)
  values ('425345bf-2235-420f-8d3a-56a76216171a', v_org, 'boss')
  on conflict (user_id, org_id) do update set role='boss';

  insert into user_org_memberships (user_id, org_id, role)
  values ('b6bb9029-c7c4-4a60-8fb2-598a2b817873', v_org, 'admin')
  on conflict (user_id, org_id) do update set role='admin';

  insert into user_org_memberships (user_id, org_id, role)
  values ('6a4e36ea-3f8c-49f7-a300-6ff60a7b2884', v_org, 'staff')
  on conflict (user_id, org_id) do update set role='staff';

  -- Staff
  insert into staff (org_id, full_name, role, base_hourly_rate, default_daily_hours) values
    (v_org, 'Physician A', 'Physician', 160, 8),
    (v_org, 'Physician B', 'Physician', 155, 8),
    (v_org, 'Physician C', 'Physician', 150, 8),
    (v_org, 'PA 1', 'PA', 90, 8),
    (v_org, 'PA 2', 'PA', 95, 8),
    (v_org, 'RN 1', 'RN', 48, 8),
    (v_org, 'LVN 1', 'LVN', 40, 8),
    (v_org, 'MA 1', 'MA', 30, 8),
    (v_org, 'Xray Tech 1', 'Xray Tech', 42, 8),
    (v_org, 'Xray Tech 2', 'Xray Tech', 44, 8),
    (v_org, 'Front Desk 1', 'Front Desk', 28, 8),
    (v_org, 'Front Desk 2', 'Front Desk', 29, 8)
  on conflict do nothing;

  -- Fixed costs
  insert into fixed_costs (org_id, name, amount, frequency, active) values
    (v_org, 'Rent', 15000, 'monthly', true),
    (v_org, 'Malpractice', 24000, 'yearly', true),
    (v_org, 'Utilities & Internet', 1200, 'monthly', true),
    (v_org, 'Loan Payment', 5000, 'monthly', true)
  on conflict do nothing;

  -- Insurances & rates
  insert into insurances (org_id, name, active) values
    (v_org, 'Aetna', true),
    (v_org, 'Blue Cross', true),
    (v_org, 'United', true),
    (v_org, 'Cigna', true),
    (v_org, 'Medicare', true)
  on conflict do nothing;

  insert into reimbursement_rates (org_id, insurance_id, avg_amount_per_visit, effective_from)
  select v_org, i.id, x.amt, current_date
  from insurances i
  join (values
    ('Aetna',145::numeric),
    ('Blue Cross',160::numeric),
    ('United',150::numeric),
    ('Cigna',140::numeric),
    ('Medicare',120::numeric)
  ) as x(name, amt) on x.name = i.name and i.org_id = v_org
  on conflict do nothing;

  -- Goals
  insert into goals (org_id, target_profit_margin, scope, active)
  values (v_org, 20.0, 'daily', true)
  on conflict do nothing;
END $$;

-- ---------- ATOMIC SAVE FUNCTION ----------
-- Upsert a daily_log and replace its staff assignments with snapshots for the given staff_ids
create or replace function save_daily_log_and_assignments(
  p_org uuid,
  p_work_date date,
  p_patients_seen integer,
  p_staff_ids uuid[]
) returns uuid
language plpgsql
security definer
as $$
declare
  v_daily_log_id uuid;
begin
  -- basic guard: caller must be member of org
  if not is_org_member(p_org) then
    raise exception 'not authorized for org %', p_org using errcode = '42501';
  end if;

  -- upsert daily_log
  insert into daily_log (org_id, work_date, patients_seen)
  values (p_org, p_work_date, p_patients_seen)
  on conflict (org_id, work_date) do update set patients_seen = excluded.patients_seen
  returning id into v_daily_log_id;

  -- wipe previous assignments for that day/org
  delete from daily_staff_assignments
   where org_id = p_org and daily_log_id = v_daily_log_id;

  -- insert snapshots from current staff table defaults
  insert into daily_staff_assignments (org_id, daily_log_id, staff_id, hours_worked, hourly_rate_snapshot, role_snapshot)
  select s.org_id, v_daily_log_id, s.id,
         coalesce(s.default_daily_hours, 8),
         s.base_hourly_rate,
         s.role
  from staff s
  where s.org_id = p_org
    and s.id = any(p_staff_ids);

  return v_daily_log_id;
end;
$$;

-- ---------- ENABLE RLS ----------
alter table orgs enable row level security;
alter table user_org_memberships enable row level security;
alter table staff enable row level security;
alter table fixed_costs enable row level security;
alter table insurances enable row level security;
alter table reimbursement_rates enable row level security;
alter table goals enable row level security;
alter table daily_log enable row level security;
alter table daily_staff_assignments enable row level security;
alter table daily_insurance_mix enable row level security;

-- ---------- POLICIES ----------
create policy "orgs_select_member" on orgs
  for select using (is_org_member(id));
create policy "orgs_admin_write" on orgs
  for all using (is_org_admin(id)) with check (is_org_admin(id));

create policy "uom_select_self" on user_org_memberships
  for select using (auth.uid() = user_id);
create policy "uom_admin_write" on user_org_memberships
  for all using (is_org_admin(org_id)) with check (is_org_admin(org_id));

create policy "staff_admin_read"  on staff               for select using (is_org_admin(org_id));
create policy "staff_admin_write" on staff               for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));
create policy "fixed_admin_read"  on fixed_costs         for select using (is_org_admin(org_id));
create policy "fixed_admin_write" on fixed_costs         for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));
create policy "ins_admin_read"    on insurances          for select using (is_org_admin(org_id));
create policy "ins_admin_write"   on insurances          for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));
create policy "rates_admin_read"  on reimbursement_rates for select using (is_org_admin(org_id));
create policy "rates_admin_write" on reimbursement_rates for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));
create policy "goals_admin_read"  on goals               for select using (is_org_admin(org_id));
create policy "goals_admin_write" on goals               for all    using (is_org_admin(org_id)) with check (is_org_admin(org_id));

create policy "daily_member_read"   on daily_log              for select using (is_org_member(org_id));
create policy "daily_member_write"  on daily_log              for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy "assign_member_read"  on daily_staff_assignments for select using (is_org_member(org_id));
create policy "assign_member_write" on daily_staff_assignments for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
create policy "mix_member_read"     on daily_insurance_mix     for select using (is_org_member(org_id));
create policy "mix_member_write"    on daily_insurance_mix     for all    using (is_org_member(org_id)) with check (is_org_member(org_id));
