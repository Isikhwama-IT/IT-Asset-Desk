-- Phase 7 schema fix: align consumable_types columns with application code.
--
-- The 20260604000000 monitoring migration created consumable_types with
-- old column names and types.  This migration renames them and migrates
-- the seeded data so the Phase 7 UI works without any data loss.
--
-- Idempotent: safe to re-run (all steps use IF EXISTS / IF NOT EXISTS).

-- ── 1. Rename name → description ─────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'consumable_types'
      and column_name  = 'name'
  ) then
    alter table public.consumable_types rename column name to description;
  end if;
end;
$$;

alter table public.consumable_types
  alter column description drop not null;

-- ── 2. Rename consumable_category → kind ─────────────────────────────────────
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'consumable_types'
      and column_name  = 'consumable_category'
  ) then
    alter table public.consumable_types rename column consumable_category to kind;
  end if;
end;
$$;

-- ── 3. Convert compatible_models text[] → text (comma-separated) ─────────────
do $$
begin
  -- Only migrate if the column is still an array type
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'consumable_types'
      and column_name  = 'compatible_models'
      and data_type    = 'ARRAY'
  ) then
    -- Add a temporary text column
    alter table public.consumable_types
      add column if not exists compatible_models_text text;

    -- Copy array contents as comma-separated string
    update public.consumable_types
      set compatible_models_text = array_to_string(compatible_models, ', ')
      where compatible_models is not null
        and array_length(compatible_models, 1) > 0;

    -- Drop the old array column and rename the new one
    alter table public.consumable_types drop column compatible_models;
    alter table public.consumable_types rename column compatible_models_text to compatible_models;
  end if;
end;
$$;

-- ── 4. Make part_number nullable ──────────────────────────────────────────────
alter table public.consumable_types
  alter column part_number drop not null;

-- ── 5. Add printer_id (null = global reference, non-null = printer-specific) ──
alter table public.consumable_types
  add column if not exists printer_id uuid references public.printers(id) on delete cascade;

create index if not exists consumable_types_printer_id_idx
  on public.consumable_types (printer_id);

-- ── 6. Drop old case-sensitive constraints ────────────────────────────────────
-- Code now stores lowercase values; constraints used Title Case.
alter table public.consumable_types
  drop constraint if exists consumable_types_consumable_category_check;

alter table public.consumable_types
  drop constraint if exists consumable_types_colour_check;

-- ── 7. Migrate existing seeded data to lowercase ──────────────────────────────

-- Colours: 'Black' → 'black', 'Cyan' → 'cyan', etc.
-- 'N/A' maps to 'other' (the DB value the app uses for non-colour consumables).
update public.consumable_types
  set colour = case
    when colour = 'N/A'      then 'other'
    when colour = 'Combined' then 'combined'
    else lower(colour)
  end
  where colour ~ '[A-Z]';

-- Kind: 'Toner' → 'toner', 'Developer' → 'developer', etc.
-- Spaces in 'Waste Box' / 'Maintenance Kit' → underscores.
update public.consumable_types
  set kind = lower(replace(kind, ' ', '_'))
  where kind ~ '[A-Z ]';

-- Remove the notes column from the existing seeded rows that stored 'Yield TBC' etc.
-- (notes is not a column in the current code schema — leave it for manual cleanup
-- if needed; just keeping the data intact here.)

-- ── 8. Drop unused notes column (not in app schema, was original seeded extra) ─
-- Commented out intentionally: safe to drop manually if confirmed not needed.
-- alter table public.consumable_types drop column if exists notes;
