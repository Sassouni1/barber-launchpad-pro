create table public.appointment_practice_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'difficult')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'interrupted')),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array')
);

create index appointment_practice_calls_user_started_idx
  on public.appointment_practice_calls (user_id, started_at desc);

alter table public.appointment_practice_calls enable row level security;

create policy "Members can read their practice calls"
  on public.appointment_practice_calls for select to authenticated
  using ((select auth.uid()) = user_id or public.has_role((select auth.uid()), 'admin'));

create policy "Members can start their practice calls"
  on public.appointment_practice_calls for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Members can save their practice calls"
  on public.appointment_practice_calls for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.appointment_practice_calls to authenticated;