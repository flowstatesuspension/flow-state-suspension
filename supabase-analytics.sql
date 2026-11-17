-- ═══════════════════════════════════════════════════════════════════════════
-- Visit counting for the two public pages, /book and /intervals.
--
-- Deliberately thin. One row per thing that happens, and nothing in it
-- identifies a person: no IP address, no user agent, no cookie, no
-- fingerprint, nothing a visitor typed. session_id is a random string held in
-- memory for one page load and never written to the visitor's device — its
-- only job is to let several events from one visit count as one visit. It
-- cannot be joined to anything else or followed to a later visit.
--
-- Run this whole file once in the Supabase SQL editor. It is safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.page_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  -- Which public page. Constrained so a typo in the app fails the insert
  -- rather than quietly creating a third bucket nothing ever reads.
  app         text not null check (app in ('intervals', 'book')),
  event       text not null check (char_length(event) between 1 and 32),
  -- A short fixed label such as 'fork'. Never free text from a visitor.
  detail      text check (char_length(detail) <= 32),
  session_id  text not null check (char_length(session_id) between 1 and 64)
);

create index if not exists page_events_created_at_idx
  on public.page_events (created_at desc);
create index if not exists page_events_app_idx
  on public.page_events (app, created_at desc);

alter table public.page_events enable row level security;

-- Visitors may add a row and do nothing else — no select, no update, no
-- delete. The page cannot read back what anyone else has done.
drop policy if exists "anon can insert page events" on public.page_events;
create policy "anon can insert page events"
  on public.page_events for insert to anon with check (true);

-- Reading is for the signed-in workshop app only.
drop policy if exists "authenticated can read page events" on public.page_events;
create policy "authenticated can read page events"
  on public.page_events for select to authenticated using (true);

-- And clearing it, which is what Settings - Data & Backup - Reset Web Traffic
-- does. Only the signed-in app: a visitor still cannot remove anything,
-- including their own events.
drop policy if exists "authenticated can clear page events" on public.page_events;
create policy "authenticated can clear page events"
  on public.page_events for delete to authenticated using (true);

-- Housekeeping. Nothing here is worth keeping for years, and the analytics
-- screen never looks back further than 90 days. Run this occasionally, or put
-- it on a schedule if pg_cron is ever enabled.
--   delete from public.page_events where created_at < now() - interval '1 year';
