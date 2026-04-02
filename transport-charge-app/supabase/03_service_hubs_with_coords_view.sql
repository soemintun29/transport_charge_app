-- Run once in SQL Editor (after 01_init_transport_schema.sql).
-- Exposes hub lat/lng for the app without parsing geography JSON in the client.

create or replace view public.service_hubs_with_coords as
select
  h.id,
  h.city_id,
  h.code,
  h.name,
  h.address_text,
  st_y(h.location::geometry) as lat,
  st_x(h.location::geometry) as lng,
  h.is_active
from public.service_hubs h;

comment on view public.service_hubs_with_coords is 'Hub locations as numeric lat/lng for API use.';
