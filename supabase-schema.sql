-- Run this in your Supabase SQL Editor to set up the schema
-- (Only needed if your tables don't already exist with these columns)

-- customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text default '',
  phone text default '',
  notes text default '',
  created_at timestamptz default now()
);

-- jobs
create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  drop_off_date date,
  pickup_date date,
  notes text default '',
  created_at timestamptz default now()
);

-- units
create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  brand text default '',
  model text default '',
  serial_number text default '',
  status text default 'booked_in'
    check (status in ('booked_in','awaiting_parts','ready','in_progress','complete')),
  parts_notes text default '',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_jobs_customer on jobs(customer_id);
create index if not exists idx_units_job on units(job_id);
create index if not exists idx_jobs_dates on jobs(drop_off_date, pickup_date);

-- Enable Row Level Security (open for authenticated & anon since you use anon key)
alter table customers enable row level security;
alter table jobs enable row level security;
alter table units enable row level security;

-- Policies — allow all operations via anon key (suitable for single-user/team tool)
create policy "allow all customers" on customers for all using (true) with check (true);
create policy "allow all jobs" on jobs for all using (true) with check (true);
create policy "allow all units" on units for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table jobs;
alter publication supabase_realtime add table units;
alter publication supabase_realtime add table customers;
