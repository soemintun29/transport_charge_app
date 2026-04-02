-- Transport Charge App - Supabase initialization SQL
-- Run this whole file in Supabase SQL Editor.

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- Optional role enum for app-side profile tables (future-safe).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type app_role as enum ('agent', 'admin');
  end if;
end$$;

create table if not exists public.cities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_hubs (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  code text not null unique,
  name text not null,
  address_text text,
  location geography(point, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  code text not null,
  name text not null,
  min_distance_km numeric(10,2) not null check (min_distance_km >= 0),
  max_distance_km numeric(10,2) not null check (max_distance_km > min_distance_km),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, code)
);

create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  base_fare_mmk numeric(12,2) not null check (base_fare_mmk >= 0),
  per_km_rate_mmk numeric(12,2) not null check (per_km_rate_mmk >= 0),
  rounding_strategy text not null default 'nearest_1000',
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active pricing rule per city (partial unique index — not a named table constraint).
create unique index if not exists uq_pricing_rule_active_city
  on public.pricing_rules (city_id)
  where is_active = true;

create table if not exists public.zone_pricing_adjustments (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  adjustment_mmk numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, zone_id)
);

create table if not exists public.geocode_cache (
  id uuid primary key default gen_random_uuid(),
  query_text text not null,
  city_id uuid references public.cities(id) on delete set null,
  provider text not null,
  result_json jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.calculation_logs (
  id uuid primary key default gen_random_uuid(),
  request_time timestamptz not null default now(),
  city_id uuid not null references public.cities(id) on delete restrict,
  input_address text,
  input_location geography(point, 4326) not null,
  selected_geocode_candidate jsonb,
  selected_hub_id uuid not null references public.service_hubs(id) on delete restrict,
  hub_selection_mode text not null check (hub_selection_mode in ('auto', 'manual')),
  distance_km numeric(12,3) not null check (distance_km >= 0),
  zone_id uuid not null references public.zones(id) on delete restrict,
  base_fare_mmk numeric(12,2) not null,
  per_km_rate_mmk numeric(12,2) not null,
  zone_adjustment_mmk numeric(12,2) not null,
  raw_fee_mmk numeric(12,2) not null,
  final_fee_mmk numeric(12,2) not null,
  rounding_rule text not null default 'nearest_1000',
  geocode_provider_used text not null,
  route_provider_used text not null,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hubs_location_gist on public.service_hubs using gist (location);
create index if not exists idx_logs_location_gist on public.calculation_logs using gist (input_location);
create index if not exists idx_logs_request_time on public.calculation_logs (request_time desc);
create index if not exists idx_logs_city on public.calculation_logs (city_id);
create index if not exists idx_logs_hub on public.calculation_logs (selected_hub_id);
create index if not exists idx_geocode_cache_lookup on public.geocode_cache (query_text, provider, expires_at desc);

-- Useful utility: nearest 1000 rounding in DB if needed.
create or replace function public.round_nearest_1000(value_mmk numeric)
returns numeric
language sql
immutable
as $$
  select round(value_mmk / 1000.0) * 1000.0;
$$;

-- Trigger helper for updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cities_touch_updated_at on public.cities;
create trigger trg_cities_touch_updated_at
before update on public.cities
for each row execute function public.touch_updated_at();

drop trigger if exists trg_hubs_touch_updated_at on public.service_hubs;
create trigger trg_hubs_touch_updated_at
before update on public.service_hubs
for each row execute function public.touch_updated_at();

drop trigger if exists trg_zones_touch_updated_at on public.zones;
create trigger trg_zones_touch_updated_at
before update on public.zones
for each row execute function public.touch_updated_at();

drop trigger if exists trg_pricing_touch_updated_at on public.pricing_rules;
create trigger trg_pricing_touch_updated_at
before update on public.pricing_rules
for each row execute function public.touch_updated_at();

drop trigger if exists trg_zone_adj_touch_updated_at on public.zone_pricing_adjustments;
create trigger trg_zone_adj_touch_updated_at
before update on public.zone_pricing_adjustments
for each row execute function public.touch_updated_at();

-- Seed baseline city records.
insert into public.cities (code, name)
values
  ('yangon', 'Yangon'),
  ('mandalay', 'Mandalay')
on conflict (code) do update
set name = excluded.name, is_active = true;

-- Seed baseline hubs.
insert into public.service_hubs (city_id, code, name, address_text, location)
select c.id, v.code, v.name, v.address_text, ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography
from public.cities c
join (
  values
    ('yangon', 'yangon-hub-1', 'Yangon Hub - Hlaing', 'Hlaing Township, Yangon', 16.8416::double precision, 96.1234::double precision),
    ('yangon', 'yangon-hub-2', 'Yangon Hub - Tamwe', 'Tamwe Township, Yangon', 16.8044::double precision, 96.1675::double precision),
    ('mandalay', 'mandalay-hub-1', 'Mandalay Hub - Chanayethazan', 'Chanayethazan, Mandalay', 21.9747::double precision, 96.0836::double precision),
    ('mandalay', 'mandalay-hub-2', 'Mandalay Hub - Maha Aungmye', 'Maha Aungmye, Mandalay', 21.9603::double precision, 96.0958::double precision)
) as v(city_code, code, name, address_text, lat, lng)
  on v.city_code = c.code
on conflict (code) do update
set
  city_id = excluded.city_id,
  name = excluded.name,
  address_text = excluded.address_text,
  location = excluded.location,
  is_active = true;

-- Seed baseline zones (distance-band strategy for MVP).
insert into public.zones (city_id, code, name, min_distance_km, max_distance_km)
select c.id, z.code, z.name, z.min_km, z.max_km
from public.cities c
cross join (
  values
    ('zone_a', 'Zone A', 0.00::numeric, 5.00::numeric),
    ('zone_b', 'Zone B', 5.00::numeric, 10.00::numeric),
    ('zone_c', 'Zone C', 10.00::numeric, 20.00::numeric),
    ('zone_d', 'Zone D', 20.00::numeric, 9999.00::numeric)
) as z(code, name, min_km, max_km)
on conflict (city_id, code) do update
set
  name = excluded.name,
  min_distance_km = excluded.min_distance_km,
  max_distance_km = excluded.max_distance_km,
  is_active = true;

-- Seed one active pricing rule per city.
insert into public.pricing_rules (city_id, base_fare_mmk, per_km_rate_mmk, rounding_strategy, is_active)
select c.id,
  case when c.code = 'yangon' then 10000 else 10000 end,
  case when c.code = 'yangon' then 4000 else 3500 end,
  'nearest_1000',
  true
from public.cities c
-- Must match the partial unique index above (index name is not a CONSTRAINT).
on conflict (city_id) where (is_active = true) do nothing;

-- Zone adjustment seed.
insert into public.zone_pricing_adjustments (city_id, zone_id, adjustment_mmk)
select c.id, z.id,
  case z.code
    when 'zone_a' then 0
    when 'zone_b' then 2000
    when 'zone_c' then case when c.code = 'yangon' then 6000 else 5000 end
    else case when c.code = 'yangon' then 10000 else 9000 end
  end
from public.cities c
join public.zones z on z.city_id = c.id
on conflict (city_id, zone_id) do update
set adjustment_mmk = excluded.adjustment_mmk;

-- Enable RLS now (policies can be tightened later with auth role mapping).
alter table public.cities enable row level security;
alter table public.service_hubs enable row level security;
alter table public.zones enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.zone_pricing_adjustments enable row level security;
alter table public.geocode_cache enable row level security;
alter table public.calculation_logs enable row level security;

-- Minimal policies for server-side usage via service role.
drop policy if exists "service_role_all_cities" on public.cities;
create policy "service_role_all_cities" on public.cities
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_hubs" on public.service_hubs;
create policy "service_role_all_hubs" on public.service_hubs
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_zones" on public.zones;
create policy "service_role_all_zones" on public.zones
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_pricing_rules" on public.pricing_rules;
create policy "service_role_all_pricing_rules" on public.pricing_rules
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_zone_pricing_adjustments" on public.zone_pricing_adjustments;
create policy "service_role_all_zone_pricing_adjustments" on public.zone_pricing_adjustments
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_geocode_cache" on public.geocode_cache;
create policy "service_role_all_geocode_cache" on public.geocode_cache
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service_role_all_calculation_logs" on public.calculation_logs;
create policy "service_role_all_calculation_logs" on public.calculation_logs
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Public read for basic lookup tables (optional for client side selects).
drop policy if exists "public_read_active_cities" on public.cities;
create policy "public_read_active_cities" on public.cities
for select using (is_active = true);

drop policy if exists "public_read_active_hubs" on public.service_hubs;
create policy "public_read_active_hubs" on public.service_hubs
for select using (is_active = true);

drop policy if exists "public_read_active_zones" on public.zones;
create policy "public_read_active_zones" on public.zones
for select using (is_active = true);
