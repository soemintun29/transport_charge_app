# Supabase Setup (Ready to Run)

## 1) Run schema SQL

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Open file `supabase/01_init_transport_schema.sql` from this project.
4. Copy all and run.

This creates:

- PostGIS extension
- Core tables
- Indexes and triggers
- Seed cities/hubs/zones/pricing
- Basic RLS policies

## 2) Verify created tables

In Table Editor, confirm:

- `cities`
- `service_hubs`
- `zones`
- `pricing_rules`
- `zone_pricing_adjustments`
- `geocode_cache`
- `calculation_logs`

## 3) Generate service role key (for backend use)

In Supabase:

- Project Settings -> API
- Copy `service_role` key

Add to your local env:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Important:

- Keep this key server-side only.
- Do not expose it in browser/client code.

## 4) Optional: enable PostGIS check

Run:

```sql
select postgis_version();
```

## 5) Next coding step

After SQL is run, we can switch APIs from in-memory pricing/hubs to live Supabase reads and write calculation logs to DB.

## After `01_init_transport_schema.sql` succeeds

1. Run **`03_service_hubs_with_coords_view.sql`** (one small file). The app uses view `service_hubs_with_coords` for hub lat/lng.
2. In **Project Settings → API**, copy the **service_role** secret.
3. Add to `transport-charge-app/.env.local`:

   ```env
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. Restart `npm run dev`.

Without the service role key, fee calculation returns **503**. The hub dropdown still works (anon + RLS).

5. **Verify in Table Editor:** open `calculation_logs` after a successful calculation — you should see new rows.

## Google API monthly cap (production)

If **`GOOGLE_FALLBACK_ENABLED`** is on and you set **`GOOGLE_MONTHLY_LIMIT`**, you **must** run **`06_google_api_monthly_usage.sql`** in the SQL Editor. The app uses RPC **`consume_google_api_quota`** with the **service_role** key so counts are shared across all server instances.

- **Production (`NODE_ENV=production`)**: if the limit is set but the RPC is missing or Supabase is misconfigured, **Google fallback is blocked** (no in-memory bypass).
- **Local dev**: without the migration, the app may use an in-memory counter (inaccurate; fine for quick tests).
- Optional: set **`GOOGLE_QUOTA_REQUIRE_DB=true`** in any environment to force the same strict behavior as production.

After running `06`, confirm table **`google_api_monthly_usage`** exists (Table Editor).

## Troubleshooting

If you see `constraint "uq_pricing_rule_active_city" does not exist`:

- The main file was updated: use the latest `01_init_transport_schema.sql` (pricing seed uses `ON CONFLICT (city_id) WHERE (is_active = true)`).
- If the migration failed partway, run `02_fix_pricing_seed_if_failed.sql`, then continue from the **Zone adjustment seed** section in the main file (or re-run the full file if tables are empty).
