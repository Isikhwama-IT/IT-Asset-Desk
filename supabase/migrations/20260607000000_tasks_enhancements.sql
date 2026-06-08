-- Tasks enhancements: checklist items, dependencies/blockers, and supporting indexes

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  body text not null,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_unique unique (task_id, depends_on_task_id)
);

create index if not exists task_checklist_items_task_id_idx
on public.task_checklist_items(task_id);

create index if not exists task_dependencies_task_id_idx
on public.task_dependencies(task_id);

create index if not exists task_dependencies_depends_on_task_id_idx
on public.task_dependencies(depends_on_task_id);

drop trigger if exists task_checklist_items_set_updated_at on public.task_checklist_items;
create trigger task_checklist_items_set_updated_at
before update on public.task_checklist_items
for each row execute function public.set_updated_at();

alter table public.task_checklist_items enable row level security;
alter table public.task_dependencies enable row level security;

create policy "Authenticated users can read task checklist items"
on public.task_checklist_items for select
using (auth.uid() is not null);

create policy "Admins can manage task checklist items"
on public.task_checklist_items for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Authenticated users can read task dependencies"
on public.task_dependencies for select
using (auth.uid() is not null);

create policy "Admins can manage task dependencies"
on public.task_dependencies for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
