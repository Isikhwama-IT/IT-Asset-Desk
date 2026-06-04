drop policy if exists "Admins can manage printers" on public.printers;
create policy "Admins can manage printers"
on public.printers for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage toner orders" on public.printer_toner_orders;
create policy "Admins can manage toner orders"
on public.printer_toner_orders for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage paper orders" on public.printer_paper_orders;
create policy "Admins can manage paper orders"
on public.printer_paper_orders for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage printer tickets" on public.printer_tickets;
create policy "Admins can manage printer tickets"
on public.printer_tickets for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage meter readings" on public.printer_meter_readings;
create policy "Admins can manage meter readings"
on public.printer_meter_readings for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage consumable types" on public.consumable_types;
create policy "Admins can manage consumable types"
on public.consumable_types for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage snmp readings" on public.printer_snmp_readings;
create policy "Admins can manage snmp readings"
on public.printer_snmp_readings for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage paper stock" on public.printer_paper_stock;
create policy "Admins can manage paper stock"
on public.printer_paper_stock for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage printer contracts" on public.printer_contracts;
create policy "Admins can manage printer contracts"
on public.printer_contracts for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can manage contract assignments" on public.printer_contract_assignments;
create policy "Admins can manage contract assignments"
on public.printer_contract_assignments for all
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
