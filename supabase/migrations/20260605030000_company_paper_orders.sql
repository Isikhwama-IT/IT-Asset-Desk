-- Allow company-level paper orders not tied to a specific printer.
-- Paper is ordered for the company; site allocation is handled separately via location_paper_stock.

alter table public.printer_paper_orders
  alter column printer_id drop not null;

-- Drop the old cascade constraint so null printer_id rows are not deleted when a printer is removed.
alter table public.printer_paper_orders
  drop constraint if exists printer_paper_orders_printer_id_fkey;

alter table public.printer_paper_orders
  add constraint printer_paper_orders_printer_id_fkey
  foreign key (printer_id) references public.printers(id) on delete set null;
