-- Run this ONLY if the main migration stopped at pricing_rules seed with:
-- ERROR: constraint "uq_pricing_rule_active_city" ... does not exist
-- Safe to run multiple times.

insert into public.pricing_rules (city_id, base_fare_mmk, per_km_rate_mmk, rounding_strategy, is_active)
select c.id,
  10000,
  case when c.code = 'yangon' then 4000 else 3500 end,
  'nearest_1000',
  true
from public.cities c
on conflict (city_id) where (is_active = true) do nothing;
