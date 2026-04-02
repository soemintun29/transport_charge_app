# Transport Charge App (MVP)

Simple and responsive web app for calculating home service transport fees using:

- Next.js (App Router)
- Supabase (configured, integration-ready)
- OSM Nominatim (geocoding)
- OSRM (routing)

Brand color: `#0098D1` (Midea)

## Implemented in this starter

- Agent calculator screen (mobile + desktop responsive)
- Address geocoding API (`/api/geocode`) with top-3 suggestions
- **Leaflet map** — tap to place pin, drag marker; optional “Move map pin here” from a selected suggestion
- Fee calculation API (`/api/calculate-fee`) with **OSRM route polyline** (Midea blue `#0098D1`) on the map after calculate
- Auto-nearest hub + manual override
- Zone resolution and nearest-1000 MMK rounding
- **Admin** (`/admin`): hubs, zones + surcharges, city pricing, calculation logs (password session)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Environment variables are in `.env.local`.

Important:

- `GOOGLE_FALLBACK_ENABLED=false` by default
- Google fallback can be enabled later by setting `true` and adding API key

## Admin panel

1. Set **`ADMIN_PASSWORD`** in `.env.local` (see `.env.example`).
2. Open **`/admin/login`**, sign in, then manage **Hubs**, **Zones**, **Pricing**, and **Logs**.
3. APIs under `/api/admin/*` require the signed **`tc_admin`** cookie (set on login).

Calculator home links to **Admin** (login).

## Next implementation steps

1. Replace password auth with **Supabase Auth** + `admin` role when you need multiple admins
2. Deploy (Vercel + env vars); use a strong `ADMIN_PASSWORD` in production
3. Geocode responses are cached in Supabase **`geocode_cache`** (30 days) when `SUPABASE_SERVICE_ROLE_KEY` is set
4. Admin **Logs** page: **Download CSV** (up to 5,000 rows, respects city filter)
5. Optional: polygon zones, Google geocode fallback
