-- IT Onboarding Module

create table if not exists public.onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','complete','cancelled')),
  current_section int not null default 1,
  hr_email_sent_at timestamptz,
  first_name text, last_name text, job_title text, department text,
  manager_name text, manager_email text, phone text,
  location text check (location in ('Baker Street','Rainbow Park')),
  start_date date, email_address text, printer_code text,
  laptop_tier text check (laptop_tier in ('Standard','Mid','High')),
  monitor_required boolean not null default false,
  monitor_qty int not null default 0,
  colour_print_access boolean not null default false,
  sharepoint_sites text[], teams_channels text[],
  distribution_lists text[], role_specific_software text[],
  ashton_email_sent_at timestamptz,
  ashton_contact_id uuid references public.contacts(id) on delete set null,
  ashton_png_received boolean not null default false,
  upstream_license_sent_at timestamptz,
  upstream_license_contact_id uuid references public.contacts(id) on delete set null,
  license_decision text check (license_decision in ('available','purchase','repurpose')),
  license_cost numeric(10,2),
  acct_email_verified boolean not null default false,
  acct_license_verified boolean not null default false,
  acct_distro_verified boolean not null default false,
  acct_teams_verified boolean not null default false,
  acct_sharepoint_verified boolean not null default false,
  procurement_pdf_sent_at timestamptz,
  rudi_approved boolean not null default false, rudi_approved_at timestamptz,
  uzair_approved boolean not null default false, uzair_approved_at timestamptz,
  finance_approved boolean not null default false, finance_approved_at timestamptz,
  upstream_goahead_sent_at timestamptz,
  upstream_goahead_contact_id uuid references public.contacts(id) on delete set null,
  collection_arranged_at timestamptz,
  upstream_collected_at timestamptz,
  upstream_collection_contact_id uuid references public.contacts(id) on delete set null,
  upstream_confirmed_at timestamptz,
  upstream_confirmed_contact_id uuid references public.contacts(id) on delete set null,
  dropoff_arranged_at timestamptz,
  email_signature_added boolean not null default false,
  wifi_connected boolean not null default false,
  arr_policies boolean not null default false,
  arr_assets_shown boolean not null default false,
  arr_liability_signed boolean not null default false,
  arr_wifi_phone boolean not null default false,
  arr_authenticator boolean not null default false,
  arr_bitlocker boolean not null default false,
  arr_pin boolean not null default false,
  arr_outlook boolean not null default false,
  arr_teams boolean not null default false,
  arr_onedrive boolean not null default false,
  arr_ticket_process boolean not null default false,
  arr_printer_tutorial boolean not null default false,
  outstanding_items text,
  completion_report_sent_at timestamptz,
  paperwork_filed boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_spend_items (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id) on delete cascade,
  category text not null check (category in ('laptop','monitor','peripheral','license','other')),
  description text not null,
  brand text, model text,
  qty int not null default 1,
  unit_cost numeric(10,2),
  ordered boolean not null default false,
  order_date date, supplier text,
  received boolean not null default false,
  received_date date,
  condition text check (condition in ('good','damaged')),
  condition_notes text,
  serial_number text, asset_tag text,
  asset_id uuid references public.assets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_printer_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id) on delete cascade,
  printer_id uuid not null,
  printer_code text,
  account_track_profile text,
  user_box_name text,
  scan_email text,
  profile_created boolean not null default false,
  code_assigned boolean not null default false,
  user_box_created boolean not null default false,
  scanning_added boolean not null default false,
  installed boolean not null default false,
  test_print_done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.onboarding_cases(id) on delete cascade,
  section int,
  action text not null,
  detail text,
  contact_id uuid references public.contacts(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists onboarding_cases_status_idx on public.onboarding_cases(status);
create index if not exists onboarding_cases_created_at_idx on public.onboarding_cases(created_at desc);
create index if not exists onboarding_spend_items_case_id_idx on public.onboarding_spend_items(case_id);
create index if not exists onboarding_printer_assignments_case_id_idx on public.onboarding_printer_assignments(case_id);
create index if not exists onboarding_activity_log_case_id_idx on public.onboarding_activity_log(case_id);

-- updated_at trigger on cases
drop trigger if exists onboarding_cases_set_updated_at on public.onboarding_cases;
create trigger onboarding_cases_set_updated_at
  before update on public.onboarding_cases
  for each row execute function public.set_updated_at();

-- RLS
alter table public.onboarding_cases enable row level security;
alter table public.onboarding_spend_items enable row level security;
alter table public.onboarding_printer_assignments enable row level security;
alter table public.onboarding_activity_log enable row level security;

create policy "Authenticated users can read onboarding cases"
  on public.onboarding_cases for select
  using (auth.uid() is not null);

create policy "Authenticated users can read spend items"
  on public.onboarding_spend_items for select
  using (auth.uid() is not null);

create policy "Authenticated users can read printer assignments"
  on public.onboarding_printer_assignments for select
  using (auth.uid() is not null);

create policy "Authenticated users can read onboarding activity"
  on public.onboarding_activity_log for select
  using (auth.uid() is not null);

create policy "Admins can manage onboarding cases"
  on public.onboarding_cases for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage spend items"
  on public.onboarding_spend_items for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage printer assignments"
  on public.onboarding_printer_assignments for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage onboarding activity"
  on public.onboarding_activity_log for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
