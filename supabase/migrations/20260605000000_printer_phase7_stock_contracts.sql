-- Phase 7: capability-driven printer stock UI support.

alter table public.printers
  add column if not exists is_colour boolean not null default false,
  add column if not exists supports_a3 boolean not null default false,
  add column if not exists toner_config text not null default 'separate',
  add column if not exists has_developer_units boolean not null default false,
  add column if not exists has_waste_box boolean not null default false,
  add column if not exists has_fuser_tracking boolean not null default false,
  add column if not exists has_drum_tracking boolean not null default false,
  add column if not exists is_duplex boolean not null default false,
  add column if not exists is_scan_capable boolean not null default false,
  add column if not exists is_fax_capable boolean not null default false,
  add column if not exists cyan_toner_stock integer not null default 0,
  add column if not exists magenta_toner_stock integer not null default 0,
  add column if not exists yellow_toner_stock integer not null default 0,
  add column if not exists paper_boxes_on_hand integer not null default 0,
  add column if not exists developer_unit_stock integer not null default 0,
  add column if not exists fuser_unit_stock integer not null default 0,
  add column if not exists waste_box_stock integer not null default 0,
  add column if not exists drum_unit_stock integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'printers_toner_config_check'
      and conrelid = 'public.printers'::regclass
  ) then
    alter table public.printers
      add constraint printers_toner_config_check
      check (toner_config in ('separate', 'all-in-one'));
  end if;
end;
$$;

create table if not exists public.printer_trays (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers(id) on delete cascade,
  tray_name text not null,
  paper_size text not null,
  capacity_reams integer,
  is_active boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint printer_trays_paper_size_check check (paper_size in ('A4', 'A3')),
  constraint printer_trays_capacity_reams_check check (capacity_reams is null or capacity_reams >= 0),
  constraint printer_trays_sort_order_check check (sort_order > 0),
  constraint printer_trays_printer_name_unique unique (printer_id, tray_name)
);

alter table public.printer_trays
  add column if not exists capacity_reams integer,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 1,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'printer_trays_printer_name_unique'
      and conrelid = 'public.printer_trays'::regclass
  ) then
    alter table public.printer_trays
      add constraint printer_trays_printer_name_unique
      unique (printer_id, tray_name);
  end if;
end;
$$;

drop trigger if exists printer_trays_set_updated_at on public.printer_trays;
create trigger printer_trays_set_updated_at
before update on public.printer_trays
for each row execute function public.set_updated_at();

alter table public.printer_trays enable row level security;

drop policy if exists "Authenticated users can read printer trays" on public.printer_trays;
create policy "Authenticated users can read printer trays"
on public.printer_trays for select
using (auth.uid() is not null);

drop policy if exists "Admins can manage printer trays" on public.printer_trays;
create policy "Admins can manage printer trays"
on public.printer_trays for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

alter table public.printer_paper_stock
  add column if not exists tray_id uuid references public.printer_trays(id) on delete cascade,
  add column if not exists boxes_on_hand integer not null default 0;

alter table public.printer_paper_stock
  alter column tray_name drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'printer_paper_stock_boxes_on_hand_check'
      and conrelid = 'public.printer_paper_stock'::regclass
  ) then
    alter table public.printer_paper_stock
      add constraint printer_paper_stock_boxes_on_hand_check
      check (boxes_on_hand >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'printer_paper_stock_printer_tray_id_unique'
      and conrelid = 'public.printer_paper_stock'::regclass
  ) then
    alter table public.printer_paper_stock
      add constraint printer_paper_stock_printer_tray_id_unique
      unique (printer_id, tray_id);
  end if;
end;
$$;

create index if not exists printer_trays_printer_id_idx
  on public.printer_trays (printer_id);

create index if not exists printer_paper_stock_tray_id_idx
  on public.printer_paper_stock (tray_id);

alter table public.consumable_types
  drop constraint if exists consumable_types_colour_check;

alter table public.consumable_types
  add constraint consumable_types_colour_check
  check (colour in ('Black', 'Cyan', 'Magenta', 'Yellow', 'N/A', 'Combined'));

update public.printers
set
  is_colour = true,
  supports_a3 = true,
  toner_config = 'separate',
  has_developer_units = true,
  has_waste_box = true,
  has_fuser_tracking = true
where model ilike '%MF459%';

update public.printers
set
  is_colour = true,
  supports_a3 = false,
  toner_config = 'separate'
where model ilike '%MF257%';

update public.printers
set
  is_colour = false,
  supports_a3 = false,
  toner_config = 'separate',
  has_developer_units = false,
  has_waste_box = false,
  has_fuser_tracking = false,
  has_drum_tracking = false
where model ilike '%4024%';

insert into public.printer_trays (printer_id, tray_name, paper_size, sort_order)
select p.id, 'Tray 1', 'A4', 1
from public.printers p
where p.archived_at is null
on conflict (printer_id, tray_name)
do update set paper_size = excluded.paper_size, is_active = true, sort_order = excluded.sort_order;

insert into public.printer_trays (printer_id, tray_name, paper_size, sort_order)
select p.id, 'Tray 2', 'A3', 2
from public.printers p
where p.archived_at is null
  and p.supports_a3 = true
on conflict (printer_id, tray_name)
do update set paper_size = excluded.paper_size, is_active = true, sort_order = excluded.sort_order;

update public.printer_paper_stock s
set tray_id = t.id
from public.printer_trays t
where s.tray_id is null
  and s.printer_id = t.printer_id
  and s.tray_name = t.tray_name;
