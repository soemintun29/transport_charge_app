-- Google API monthly quota (DB-backed).
-- Required in production whenever GOOGLE_MONTHLY_LIMIT is set: run this in SQL Editor
-- after 01_init. The app calls consume_google_api_quota via the service_role key only.

create table if not exists public.google_api_monthly_usage (
  year_month text primary key,
  call_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.google_api_monthly_usage enable row level security;

drop policy if exists "service_role_google_usage" on public.google_api_monthly_usage;
create policy "service_role_google_usage" on public.google_api_monthly_usage
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Atomically increment only if under limit. Returns true if a slot was consumed.
create or replace function public.consume_google_api_quota(p_year_month text, p_max int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.google_api_monthly_usage (year_month, call_count)
  values (p_year_month, 0)
  on conflict (year_month) do nothing;

  update public.google_api_monthly_usage
  set
    call_count = call_count + 1,
    updated_at = now()
  where year_month = p_year_month
    and call_count < p_max;

  return found;
end;
$$;

revoke all on function public.consume_google_api_quota(text, int) from public;
grant execute on function public.consume_google_api_quota(text, int) to service_role;
