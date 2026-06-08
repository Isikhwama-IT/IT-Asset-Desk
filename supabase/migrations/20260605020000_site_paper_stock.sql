-- Replace per-printer / per-tray paper stock with per-site paper stock.
--
-- Paper is purchased for the company and allocated per site, not per printer.
-- Each site tracks a pool of A4 (boxes + reams) and A3 (reams only).

-- ── Drop old printer-level paper stock table ──────────────────────────────────
drop table if exists public.printer_paper_stock cascade;

-- ── Create site-level paper stock ─────────────────────────────────────────────
create table if not exists public.location_paper_stock (
  id                          uuid        primary key default gen_random_uuid(),
  location_id                 uuid        not null references public.locations(id) on delete cascade,
  paper_size                  text        not null check (paper_size in ('A4', 'A3')),
  boxes_on_hand               integer     not null default 0 check (boxes_on_hand >= 0),
  reams_on_hand               integer     not null default 0 check (reams_on_hand >= 0),
  last_restocked_at           timestamptz,
  last_updated_by_contact_id  uuid        references public.contacts(id) on delete set null,
  updated_at                  timestamptz not null default now(),
  constraint location_paper_stock_location_size_unique unique (location_id, paper_size)
);

create index if not exists location_paper_stock_location_id_idx
  on public.location_paper_stock (location_id);

drop trigger if exists location_paper_stock_set_updated_at on public.location_paper_stock;
create trigger location_paper_stock_set_updated_at
  before update on public.location_paper_stock
  for each row execute function public.set_updated_at();

alter table public.location_paper_stock enable row level security;

drop policy if exists "Authenticated users can read location paper stock" on public.location_paper_stock;
create policy "Authenticated users can read location paper stock"
  on public.location_paper_stock for select
  using (auth.uid() is not null);

drop policy if exists "Admins can manage location paper stock" on public.location_paper_stock;
create policy "Admins can manage location paper stock"
  on public.location_paper_stock for all
  using  ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- A4 boxes constraint: A3 has no boxes so enforce boxes_on_hand = 0 for A3
alter table public.location_paper_stock
  add constraint location_paper_stock_a3_no_boxes
  check (paper_size = 'A4' or boxes_on_hand = 0);
