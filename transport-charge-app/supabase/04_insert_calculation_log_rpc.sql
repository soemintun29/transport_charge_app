-- Optional: reliable insert for geography column (run if direct insert still fails).
-- App will try direct EWKT insert first; this RPC is a fallback.

create or replace function public.insert_calculation_log(
  p_city_id uuid,
  p_input_address text,
  p_lng double precision,
  p_lat double precision,
  p_selected_hub_id uuid,
  p_hub_selection_mode text,
  p_distance_km numeric,
  p_zone_id uuid,
  p_base_fare_mmk numeric,
  p_per_km_rate_mmk numeric,
  p_zone_adjustment_mmk numeric,
  p_raw_fee_mmk numeric,
  p_final_fee_mmk numeric,
  p_rounding_rule text,
  p_geocode_provider text,
  p_route_provider text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.calculation_logs (
    city_id,
    input_address,
    input_location,
    selected_geocode_candidate,
    selected_hub_id,
    hub_selection_mode,
    distance_km,
    zone_id,
    base_fare_mmk,
    per_km_rate_mmk,
    zone_adjustment_mmk,
    raw_fee_mmk,
    final_fee_mmk,
    rounding_rule,
    geocode_provider_used,
    route_provider_used,
    status,
    error_message
  ) values (
    p_city_id,
    p_input_address,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    null,
    p_selected_hub_id,
    p_hub_selection_mode,
    p_distance_km,
    p_zone_id,
    p_base_fare_mmk,
    p_per_km_rate_mmk,
    p_zone_adjustment_mmk,
    p_raw_fee_mmk,
    p_final_fee_mmk,
    p_rounding_rule,
    p_geocode_provider,
    p_route_provider,
    'success',
    null
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.insert_calculation_log(
  uuid, text, double precision, double precision, uuid, text, numeric, uuid,
  numeric, numeric, numeric, numeric, numeric, text, text, text
) to service_role;
