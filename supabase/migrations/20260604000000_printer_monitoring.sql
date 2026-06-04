create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.printers
  add column if not exists black_toner_stock integer not null default 0 check (black_toner_stock >= 0);

alter table public.printers
  add column if not exists colour_toner_stock integer not null default 0 check (colour_toner_stock >= 0);

alter table public.printers
  add column if not exists last_snmp_polled_at timestamptz;

alter table public.printers
  add column if not exists snmp_enabled boolean not null default true;

create table if not exists public.consumable_types (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  manufacturer text,
  consumable_category text not null,
  colour text not null,
  compatible_models text[] not null default '{}'::text[],
  rated_yield_pages integer,
  coverage_pct integer not null default 5,
  unit_price numeric(12,2),
  reorder_threshold_pct integer not null default 25,
  reorder_stock_min integer not null default 1,
  supplier_lead_days integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consumable_types_consumable_category_check
    check (consumable_category in ('Toner', 'Developer', 'Drum', 'Fuser', 'Waste Box', 'Maintenance Kit')),
  constraint consumable_types_colour_check
    check (colour in ('Black', 'Cyan', 'Magenta', 'Yellow', 'N/A')),
  constraint consumable_types_rated_yield_pages_check
    check (rated_yield_pages is null or rated_yield_pages > 0),
  constraint consumable_types_coverage_pct_check
    check (coverage_pct > 0 and coverage_pct <= 100),
  constraint consumable_types_unit_price_check
    check (unit_price is null or unit_price >= 0),
  constraint consumable_types_reorder_threshold_pct_check
    check (reorder_threshold_pct >= 0 and reorder_threshold_pct <= 100),
  constraint consumable_types_reorder_stock_min_check
    check (reorder_stock_min >= 0),
  constraint consumable_types_supplier_lead_days_check
    check (supplier_lead_days >= 0)
);

create table if not exists public.printer_snmp_readings (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers(id) on delete cascade,
  polled_at timestamptz not null default now(),
  is_online boolean not null default false,
  printer_status text,
  error_description text,
  total_pages integer,
  colour_pages integer,
  mono_pages integer,
  black_toner_pct integer,
  cyan_toner_pct integer,
  magenta_toner_pct integer,
  yellow_toner_pct integer,
  black_developer_pct integer,
  cyan_developer_pct integer,
  magenta_developer_pct integer,
  yellow_developer_pct integer,
  fuser_pct integer,
  waste_box_pct integer,
  drum_pct integer,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  constraint printer_snmp_readings_total_pages_check
    check (total_pages is null or total_pages >= 0),
  constraint printer_snmp_readings_colour_pages_check
    check (colour_pages is null or colour_pages >= 0),
  constraint printer_snmp_readings_mono_pages_check
    check (mono_pages is null or mono_pages >= 0),
  constraint printer_snmp_readings_black_toner_pct_check
    check (black_toner_pct is null or black_toner_pct between 0 and 100),
  constraint printer_snmp_readings_cyan_toner_pct_check
    check (cyan_toner_pct is null or cyan_toner_pct between 0 and 100),
  constraint printer_snmp_readings_magenta_toner_pct_check
    check (magenta_toner_pct is null or magenta_toner_pct between 0 and 100),
  constraint printer_snmp_readings_yellow_toner_pct_check
    check (yellow_toner_pct is null or yellow_toner_pct between 0 and 100),
  constraint printer_snmp_readings_black_developer_pct_check
    check (black_developer_pct is null or black_developer_pct between 0 and 100),
  constraint printer_snmp_readings_cyan_developer_pct_check
    check (cyan_developer_pct is null or cyan_developer_pct between 0 and 100),
  constraint printer_snmp_readings_magenta_developer_pct_check
    check (magenta_developer_pct is null or magenta_developer_pct between 0 and 100),
  constraint printer_snmp_readings_yellow_developer_pct_check
    check (yellow_developer_pct is null or yellow_developer_pct between 0 and 100),
  constraint printer_snmp_readings_fuser_pct_check
    check (fuser_pct is null or fuser_pct between 0 and 100),
  constraint printer_snmp_readings_waste_box_pct_check
    check (waste_box_pct is null or waste_box_pct between 0 and 100),
  constraint printer_snmp_readings_drum_pct_check
    check (drum_pct is null or drum_pct between 0 and 100)
);

create table if not exists public.printer_paper_stock (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers(id) on delete cascade,
  tray_name text not null,
  paper_size text not null,
  reams_on_hand integer not null default 0,
  last_restocked_at timestamptz,
  last_updated_by_contact_id uuid references public.contacts(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint printer_paper_stock_paper_size_check
    check (paper_size in ('A4', 'A3', 'A5', 'Letter', 'Legal')),
  constraint printer_paper_stock_reams_on_hand_check
    check (reams_on_hand >= 0),
  constraint printer_paper_stock_printer_tray_unique
    unique (printer_id, tray_name)
);

create table if not exists public.printer_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_reference text,
  provider_name text not null,
  provider_contact_name text,
  provider_contact_email text,
  provider_contact_phone text,
  contract_type text not null,
  covers_consumables boolean not null default false,
  covers_parts boolean not null default true,
  covers_labour boolean not null default true,
  sla_response_hours integer,
  monthly_cost numeric(10,2),
  start_date date,
  end_date date,
  auto_renews boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint printer_contracts_contract_type_check
    check (contract_type in ('Full Maintenance', 'Parts Only', 'Labour Only', 'Consumables Included', 'Ad Hoc')),
  constraint printer_contracts_sla_response_hours_check
    check (sla_response_hours is null or sla_response_hours > 0),
  constraint printer_contracts_monthly_cost_check
    check (monthly_cost is null or monthly_cost >= 0),
  constraint printer_contracts_dates_check
    check (start_date is null or end_date is null or end_date >= start_date)
);

create table if not exists public.printer_contract_assignments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.printer_contracts(id) on delete cascade,
  printer_id uuid not null references public.printers(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  constraint printer_contract_assignments_contract_printer_unique
    unique (contract_id, printer_id)
);

create index if not exists printer_snmp_readings_printer_polled_idx
  on public.printer_snmp_readings (printer_id, polled_at desc);

create index if not exists printer_paper_stock_printer_id_idx
  on public.printer_paper_stock (printer_id);

create index if not exists printer_contract_assignments_printer_id_idx
  on public.printer_contract_assignments (printer_id);

create index if not exists printer_contract_assignments_contract_id_idx
  on public.printer_contract_assignments (contract_id);

drop trigger if exists consumable_types_set_updated_at on public.consumable_types;
create trigger consumable_types_set_updated_at
before update on public.consumable_types
for each row execute function public.set_updated_at();

drop trigger if exists printer_paper_stock_set_updated_at on public.printer_paper_stock;
create trigger printer_paper_stock_set_updated_at
before update on public.printer_paper_stock
for each row execute function public.set_updated_at();

drop trigger if exists printer_contracts_set_updated_at on public.printer_contracts;
create trigger printer_contracts_set_updated_at
before update on public.printer_contracts
for each row execute function public.set_updated_at();

alter table public.consumable_types enable row level security;
alter table public.printer_snmp_readings enable row level security;
alter table public.printer_paper_stock enable row level security;
alter table public.printer_contracts enable row level security;
alter table public.printer_contract_assignments enable row level security;

drop policy if exists "Authenticated users can read consumable types" on public.consumable_types;
create policy "Authenticated users can read consumable types"
on public.consumable_types for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage consumable types" on public.consumable_types;
create policy "Admins can manage consumable types"
on public.consumable_types for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can read snmp readings" on public.printer_snmp_readings;
create policy "Authenticated users can read snmp readings"
on public.printer_snmp_readings for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage snmp readings" on public.printer_snmp_readings;
create policy "Admins can manage snmp readings"
on public.printer_snmp_readings for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can read paper stock" on public.printer_paper_stock;
create policy "Authenticated users can read paper stock"
on public.printer_paper_stock for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage paper stock" on public.printer_paper_stock;
create policy "Admins can manage paper stock"
on public.printer_paper_stock for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can read printer contracts" on public.printer_contracts;
create policy "Authenticated users can read printer contracts"
on public.printer_contracts for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage printer contracts" on public.printer_contracts;
create policy "Admins can manage printer contracts"
on public.printer_contracts for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Authenticated users can read contract assignments" on public.printer_contract_assignments;
create policy "Authenticated users can read contract assignments"
on public.printer_contract_assignments for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage contract assignments" on public.printer_contract_assignments;
create policy "Admins can manage contract assignments"
on public.printer_contract_assignments for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.consumable_types (
  part_number,
  name,
  manufacturer,
  consumable_category,
  colour,
  compatible_models,
  rated_yield_pages,
  coverage_pct,
  unit_price,
  reorder_threshold_pct,
  reorder_stock_min,
  supplier_lead_days,
  notes
) values
  ('B1234', 'Black Toner - MF4024 Plus', null, 'Toner', 'Black', array['MF4024 Plus'], 7200, 5, null, 25, 1, 1, null),
  ('B1377', 'Black Toner - MF459/MF559/MF659', null, 'Toner', 'Black', array['MF459', 'MF559', 'MF659'], 28000, 5, null, 25, 1, 1, null),
  ('B1378', 'Cyan Toner - MF459/MF559/MF659', null, 'Toner', 'Cyan', array['MF459', 'MF559', 'MF659'], 28000, 5, null, 25, 1, 1, null),
  ('B1379', 'Magenta Toner - MF459/MF559/MF659', null, 'Toner', 'Magenta', array['MF459', 'MF559', 'MF659'], 28000, 5, null, 25, 1, 1, null),
  ('B1380', 'Yellow Toner - MF459/MF559/MF659', null, 'Toner', 'Yellow', array['MF459', 'MF559', 'MF659'], 28000, 5, null, 25, 1, 1, null),
  ('B1381', 'Black Developer - MF459/MF559/MF659', null, 'Developer', 'Black', array['MF459', 'MF559', 'MF659'], null, 5, null, 25, 1, 1, 'Yield TBC'),
  ('B1382', 'Cyan Developer - MF459/MF559/MF659', null, 'Developer', 'Cyan', array['MF459', 'MF559', 'MF659'], null, 5, null, 25, 1, 1, 'Yield TBC'),
  ('B1383', 'Magenta Developer - MF459/MF559/MF659', null, 'Developer', 'Magenta', array['MF459', 'MF559', 'MF659'], null, 5, null, 25, 1, 1, 'Yield TBC'),
  ('B1384', 'Yellow Developer - MF459/MF559/MF659', null, 'Developer', 'Yellow', array['MF459', 'MF559', 'MF659'], null, 5, null, 25, 1, 1, 'Yield TBC'),
  ('B1394', 'Black Toner - MF257', null, 'Toner', 'Black', array['MF257'], 24000, 5, null, 25, 1, 1, null),
  ('B1395', 'Cyan Toner - MF257', null, 'Toner', 'Cyan', array['MF257'], 24000, 5, null, 25, 1, 1, 'Yield unconfirmed'),
  ('B1396', 'Magenta Toner - MF257', null, 'Toner', 'Magenta', array['MF257'], 24000, 5, null, 25, 1, 1, 'Yield unconfirmed'),
  ('B1397', 'Yellow Toner - MF257', null, 'Toner', 'Yellow', array['MF257'], 24000, 5, null, 25, 1, 1, 'Yield unconfirmed')
on conflict (part_number) do update set
  name = excluded.name,
  manufacturer = excluded.manufacturer,
  consumable_category = excluded.consumable_category,
  colour = excluded.colour,
  compatible_models = excluded.compatible_models,
  rated_yield_pages = excluded.rated_yield_pages,
  coverage_pct = excluded.coverage_pct,
  unit_price = excluded.unit_price,
  reorder_threshold_pct = excluded.reorder_threshold_pct,
  reorder_stock_min = excluded.reorder_stock_min,
  supplier_lead_days = excluded.supplier_lead_days,
  notes = excluded.notes,
  updated_at = now();
