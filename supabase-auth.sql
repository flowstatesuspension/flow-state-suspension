-- Run this in Supabase SQL Editor to lock down the database to authenticated users only.
-- Drop the open policies we created initially
drop policy if exists "allow all customers" on customers;
drop policy if exists "allow all jobs" on jobs;
drop policy if exists "allow all units" on units;

-- New policies: only authenticated users can access data
create policy "auth users only - customers" on customers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth users only - jobs" on jobs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "auth users only - units" on units
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
