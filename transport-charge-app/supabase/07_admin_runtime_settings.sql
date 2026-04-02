-- Admin runtime settings used by server-side decision logic.
-- Run after 01_init_transport_schema.sql.

create table if not exists public.admin_runtime_settings (
  key text primary key,
  bool_value boolean,
  text_value text,
  updated_at timestamptz not null default now()
);

alter table public.admin_runtime_settings enable row level security;

drop policy if exists "service_role_admin_runtime_settings"
on public.admin_runtime_settings;
create policy "service_role_admin_runtime_settings"
on public.admin_runtime_settings
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.admin_runtime_settings (key, bool_value)
values ('google_fallback_enabled', true)
on conflict (key) do nothing;
