-- Run in Supabase SQL Editor
alter table units add column if not exists price numeric(10,2) default 0;
