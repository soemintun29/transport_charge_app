# Transport Charge Web Application - Detailed Specification

## 1. Document Control

- **Project Name:** Home Appliance After-Sales Transport Charge System
- **Primary Users:** Call center agents, service administrators
- **Target Cities (MVP):** Yangon, Mandalay
- **Version:** 1.0 (MVP-ready)
- **Date:** 2026-04-01

## 2. Purpose and Scope

This document defines the detailed product and technical specification for a web application that calculates transport charges for home appliance after-sales service requests (repair/warranty).

The goal is to ensure transport fees are:

- Calculated automatically and consistently
- Explainable to agents and customers
- Configurable by admins without code changes
- Scalable for future logistics and technician assignment workflows

## 3. Business Context

Customers request home service and provide an address. The system must:

1. Resolve address to a usable map location (latitude/longitude)
2. Determine route distance from service hub to customer
3. Identify zone based on configured rules
4. Compute transport fee using a transparent formula
5. Persist all calculations for operational and audit tracking

## 4. Functional Requirements

### 4.1 Address Input and Geocoding

#### 4.1.1 Input methods

- Agent can type address manually
- Agent can select a point on map

#### 4.1.2 Geocoding providers

- Primary: OpenStreetMap Nominatim
- Optional fallback: Google Geocoding API
- Fallback is disabled by default and controlled by feature flag

#### 4.1.3 Ambiguous address handling

- System must return top 3 geocoding suggestions when confidence is low or multiple matches are likely
- Agent must select one suggestion before final calculation
- Each suggestion should include:
  - Full display address
  - Latitude/longitude
  - Confidence or relevance score (if available from provider mapping)

#### 4.1.4 Geocoding acceptance policy

- If map pin selected by agent, treat location as trusted and skip suggestion selection
- If text address entered and only one high-confidence match exists, auto-select it
- Otherwise, require agent confirmation from top 3

### 4.2 Service Hub Selection

- System auto-selects nearest active hub by geographic distance
- Agent can manually override hub before final fee confirmation
- Selected hub (auto or manual) must be stored in logs

### 4.3 Distance Calculation

- Use route distance (not straight-line distance)
- Primary routing provider: OSRM
- Optional fallback: Google Directions API (disabled by default)
- Output distance in kilometers as decimal

### 4.4 Zone Determination

#### 4.4.1 MVP zone type

- Radius-based zones per city/hub policy
- Example:
  - Zone A: 0-5 km
  - Zone B: >5-10 km
  - Zone C: >10-20 km

#### 4.4.2 Rules

- Zone is determined from final route distance bands for MVP
- Admin can configure zone definitions and activation state
- Exactly one zone should match for a given distance; configuration validation required

#### 4.4.3 Phase 2 extension

- Polygon zone support using map drawing tools
- Zone priority to resolve overlaps

### 4.5 Pricing Logic

#### 4.5.1 Formula

Transport Fee:

`raw_fee = base_fare + (distance_km * per_km_rate) + zone_adjustment`

`final_fee = round(raw_fee / 1000) * 1000`

#### 4.5.2 MVP pricing policy

- One active pricing rule per city (not per appliance)
- Zone adjustment allowed in rule or zone-linked table
- Currency: MMK
- Rounding: nearest 1,000 MMK (mandatory)

#### 4.5.3 Phase 2 pricing policy

- Heavy-item/product surcharge
- Additional pricing dimensions (time window, urgency, special handling)

### 4.6 Calculation Output

For each successful calculation, UI must show:

- Selected address/location
- Selected hub (auto/manual)
- Route distance (km)
- Zone
- Price breakdown:
  - Base fare
  - Distance component
  - Zone adjustment
  - Raw fee
  - Rounded final fee
- Optional map route polyline

### 4.7 Admin Panel Requirements

Admin users can:

- Configure pricing values:
  - Base fare
  - Per-km rate
  - Zone adjustment
- Manage service hubs:
  - Name
  - City
  - Address
  - Location on map
  - Active status
- Manage zones:
  - Zone name
  - Distance range (MVP)
  - Active status
- View/search/export calculation logs

## 5. Non-Functional Requirements

### 5.1 Performance

- Expected volume: 50-100 requests/day
- Target end-to-end calculation response: <= 3 seconds under normal network conditions

### 5.2 Availability and reliability

- Graceful provider failure handling
- Retry policy for transient geocoding/routing failures
- Fallback to Google provider only when flag enabled

### 5.3 Auditability

- Store all input/output parameters used in fee calculation
- Store provider metadata and error states
- Never silently change formula without versioned rule changes

### 5.4 Security

- Role-based access:
  - Agent: calculate and view own operational screens
  - Admin: full config and logs access
- Secure API keys in environment variables
- Validate and sanitize all external input

## 6. Technical Architecture

### 6.1 Stack

- Frontend: Next.js (React), Leaflet map
- Backend: Next.js API routes + Supabase services
- Database: PostgreSQL + PostGIS on Supabase
- Providers:
  - OSM Nominatim (geocoding)
  - OSRM (routing)
  - Optional Google fallback (disabled by default)

### 6.2 High-level components

1. **Agent UI**
   - Address entry, map interaction, fee results
2. **Admin UI**
   - Hubs, zones, pricing, logs management
3. **Fee Engine API**
   - Geocode -> hub selection -> route distance -> zone -> price
4. **Persistence Layer**
   - Operational and audit data in Postgres/PostGIS
5. **Provider Adapters**
   - Abstract external APIs for easy swapping and fallback handling

## 7. Data Model Specification

### 7.1 Tables

#### cities

- `id` (uuid, pk)
- `name` (text, unique, not null)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

#### service_hubs

- `id` (uuid, pk)
- `city_id` (uuid, fk -> cities.id, not null)
- `name` (text, not null)
- `address_text` (text)
- `location` (geography(Point, 4326), not null)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

#### zones

- `id` (uuid, pk)
- `city_id` (uuid, fk -> cities.id, not null)
- `name` (text, not null)
- `min_distance_km` (numeric, not null)
- `max_distance_km` (numeric, not null)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Constraints:

- `min_distance_km >= 0`
- `max_distance_km > min_distance_km`
- Overlap prevention within active zones per city (enforced via validation logic)

#### pricing_rules

- `id` (uuid, pk)
- `city_id` (uuid, fk -> cities.id, not null)
- `base_fare_mmk` (numeric, not null)
- `per_km_rate_mmk` (numeric, not null)
- `zone_adjustment_strategy` (text, default `zone_value`)
- `rounding_strategy` (text, default `nearest_1000`)
- `effective_from` (timestamptz, not null)
- `effective_to` (timestamptz, nullable)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

Policy:

- Only one active rule per city at current time

#### zone_pricing_adjustments

- `id` (uuid, pk)
- `city_id` (uuid, fk -> cities.id, not null)
- `zone_id` (uuid, fk -> zones.id, not null)
- `adjustment_mmk` (numeric, not null default 0)
- `created_at`, `updated_at`

#### geocode_cache

- `id` (uuid, pk)
- `query_text` (text, not null)
- `city_id` (uuid, fk -> cities.id, nullable)
- `provider` (text, not null)
- `result_json` (jsonb, not null)
- `expires_at` (timestamptz, not null)
- `created_at`

#### calculation_logs

- `id` (uuid, pk)
- `request_time` (timestamptz, default now)
- `agent_user_id` (uuid, nullable)
- `city_id` (uuid, fk -> cities.id, not null)
- `input_address` (text)
- `input_location` (geography(Point, 4326), not null)
- `selected_geocode_candidate` (jsonb, nullable)
- `selected_hub_id` (uuid, fk -> service_hubs.id, not null)
- `hub_selection_mode` (text, not null: `auto` | `manual`)
- `distance_km` (numeric, not null)
- `zone_id` (uuid, fk -> zones.id, not null)
- `base_fare_mmk` (numeric, not null)
- `per_km_rate_mmk` (numeric, not null)
- `zone_adjustment_mmk` (numeric, not null)
- `raw_fee_mmk` (numeric, not null)
- `final_fee_mmk` (numeric, not null)
- `rounding_rule` (text, not null default `nearest_1000`)
- `geocode_provider_used` (text, not null)
- `route_provider_used` (text, not null)
- `status` (text, not null: `success` | `failed`)
- `error_message` (text, nullable)

### 7.2 Indexing

- GIST indexes on geographic columns:
  - `service_hubs.location`
  - `calculation_logs.input_location`
- B-tree indexes:
  - `calculation_logs.request_time desc`
  - `calculation_logs.city_id`
  - `calculation_logs.selected_hub_id`
  - `pricing_rules(city_id, is_active, effective_from)`

## 8. API Specification

### 8.1 Agent APIs

#### POST `/api/geocode`

Request:

```json
{
  "address": "No. 12, Hledan Road, Kamayut, Yangon",
  "cityId": "uuid"
}
```

Response:

```json
{
  "requiresSelection": true,
  "suggestions": [
    {
      "displayAddress": "....",
      "lat": 16.82,
      "lng": 96.13,
      "score": 0.88,
      "provider": "nominatim"
    }
  ]
}
```

Behavior:

- Return up to top 3 suggestions
- If one high-confidence candidate, return `requiresSelection: false` and selected candidate

#### POST `/api/calculate-fee`

Request:

```json
{
  "cityId": "uuid",
  "location": { "lat": 16.82, "lng": 96.13 },
  "hubSelectionMode": "auto",
  "manualHubId": null
}
```

Response:

```json
{
  "selectedHub": { "id": "uuid", "name": "Yangon Hub 1" },
  "distanceKm": 7.4,
  "zone": { "id": "uuid", "name": "Zone B" },
  "pricing": {
    "baseFareMmk": 10000,
    "perKmRateMmk": 4000,
    "zoneAdjustmentMmk": 2000,
    "rawFeeMmk": 41600,
    "roundingRule": "nearest_1000",
    "finalFeeMmk": 42000
  },
  "providers": {
    "geocode": "nominatim",
    "route": "osrm"
  }
}
```

#### GET `/api/hubs?cityId=<uuid>`

- Returns active hubs for city

#### GET `/api/zones?cityId=<uuid>`

- Returns active zones for city

### 8.2 Admin APIs

- `POST /api/admin/hubs`
- `PUT /api/admin/hubs/:id`
- `POST /api/admin/zones`
- `PUT /api/admin/zones/:id`
- `POST /api/admin/pricing-rules`
- `GET /api/admin/calculation-logs?...filters`

### 8.3 Validation rules

- City must be active
- Hub must belong to selected city
- Manual hub ID required when mode = manual
- Distance must be resolved from routing provider (or fail with explicit error)
- Zone must match distance; otherwise return validation/config error

## 9. Frontend Specification

### 9.1 Agent screen

Main user flow:

1. Select city
2. Enter address or pin location
3. If needed, select one of top 3 suggestions
4. Review auto-selected hub (optionally override manually)
5. Click calculate
6. View breakdown and final rounded fee

UI sections:

- City selector
- Address input + map picker
- Suggestion list (top 3)
- Hub selection mode and selector
- Fee result card
- Optional route map preview

### 9.2 Admin screens

- Hubs management
- Zones management (distance bands in MVP)
- Pricing rule management
- Calculation logs table with filters and export

## 10. Core Calculation Algorithm

1. Resolve final customer point (from map or selected geocode suggestion)
2. Determine hub:
   - Auto: nearest active hub in same city
   - Manual: validate admin-selected hub belongs to city
3. Request OSRM route distance hub -> customer
4. Convert meters to km
5. Determine matching zone by distance range
6. Load active city pricing rule and zone adjustment
7. Compute raw fee
8. Apply rounding to nearest 1,000 MMK
9. Persist full log
10. Return structured output

## 11. Error Handling Specification

### 11.1 User-facing

- Clear messages:
  - "Address not found, please select on map"
  - "Multiple matches found, please select one"
  - "Routing unavailable, please try again"
  - "Pricing configuration missing for selected city"

### 11.2 System behavior

- Provider timeout with retry (limited)
- If primary provider fails and fallback disabled -> return failure
- If fallback enabled -> attempt fallback and log provider used
- Record failed attempts in logs with error reason

## 12. Configuration and Feature Flags

Environment variables:

- `GEOCODE_PROVIDER_PRIMARY=nominatim`
- `ROUTE_PROVIDER_PRIMARY=osrm`
- `GOOGLE_FALLBACK_ENABLED=false`
- `GOOGLE_MAPS_API_KEY=...` (optional)
- `NOMINATIM_BASE_URL=...`
- `OSRM_BASE_URL=...`

## 13. Security and Access Control

- Supabase Auth for users
- Role claims:
  - `agent`
  - `admin`
- Row-level security policies:
  - Agents: create/read relevant calculations
  - Admins: full configuration and logs access

## 14. Testing Strategy

### 14.1 Unit tests

- Fee formula and rounding behavior
- Zone matching logic
- Provider adapter mapping/normalization

### 14.2 Integration tests

- Geocode -> calculate API flow
- Auto-nearest vs manual hub mode
- Ambiguous geocode selection workflow

### 14.3 UAT scenarios

- Yangon and Mandalay happy path
- Low-confidence address flow
- Provider failure scenarios
- Rounding validation edge cases (x499, x500)

## 15. Observability and Operations

- Structured logs for provider call duration, status, and failures
- Daily summary metrics:
  - Request count
  - Success/failure rate
  - Avg response time
  - Provider fallback usage

## 16. MVP Scope vs Phase 2

### 16.1 MVP

- City-level pricing rule (single active rule per city)
- Address + map pin input
- Top 3 geocode suggestions
- Auto-nearest hub + manual override
- OSRM route distance
- Distance-band zones (A/B/C style)
- Nearest 1,000 MMK rounding
- Admin CRUD for hubs/zones/pricing
- Calculation logs

### 16.2 Phase 2

- Product-level heavy-item surcharge
- Polygon zones and map drawing
- Saved customer addresses
- Technician assignment automation
- Multi-job route optimization
- External call center integration

## 17. Acceptance Criteria

1. Agent can calculate transport charge in <= 3 seconds for normal requests.
2. Fee output always includes full breakdown and rounded final amount.
3. Ambiguous addresses prompt top 3 candidate selection.
4. Auto-nearest hub is selected correctly; manual override works.
5. All calculations (success/failure) are logged with providers and formula inputs.
6. Admin can update city pricing, hubs, and zones without code deployment.

---

This specification is intentionally implementation-ready for MVP while preserving a clean migration path to Phase 2.
