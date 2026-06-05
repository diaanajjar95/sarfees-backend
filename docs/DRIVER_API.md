# Driver App — Backend Integration Guide

End-to-end reference for what the driver mobile app needs to call, in
roughly the order a user encounters it. The interactive Swagger UI at
`/api/driver` is the authoritative reference; this doc explains the
flow, the screens each endpoint backs, and the gotchas you'd otherwise
hit at runtime.

**Base URL (production):** `https://sarfees-api.onrender.com`
**Auth:** all endpoints (except `/auth/driver/request-otp` and
`/auth/driver/verify-otp`) require `Authorization: Bearer <accessToken>`.
**Locale:** every endpoint reads `Accept-Language: en|ar` and returns
localised messages and (where applicable) localised content.
**Response envelope:** every successful response is
`{ code, message, data }`; errors return `{ code, message, data: null }`.

---

## 1. Authentication (S-01 → S-03)

### `POST /auth/driver/request-otp`

Ops pre-registers drivers in the backend; unknown phones get a 403.

```json
{ "phoneNumber": "7799999001", "countryCode": "+962" }
```

- 201 → OTP sent (mock value: `1234` in dev/staging until SMS is wired).
- 403 → not registered, suspended, locked out, or rate-limited.
- Rate limit: 3 requests / 10 min per driver.
- OTP TTL: 120 s.

### `POST /auth/driver/verify-otp`

```json
{ "phoneNumber": "7799999001", "countryCode": "+962", "otp": "1234" }
```

Returns `accessToken` (15 min), `refreshToken` (7 days), and a compact
driver profile. **Persist both tokens.** 3 wrong attempts lock the
account for 10 min (403).

### `GET /auth/driver/verify-session`

Splash-screen probe (S-01). If the stored access token still works,
returns the driver profile; if it's expired, hit `refresh`. Returns
403 if the driver was suspended in the meantime.

### `POST /auth/driver/refresh`

Pass the **refresh** token as the Bearer header. Returns new
access + refresh tokens. After this, discard the old refresh — it's
been rotated server-side.

### `POST /auth/driver/logout`

Authenticated. Invalidates the refresh token server-side. The current
access token stays valid until its TTL expires (15 min cap), so wipe
local storage too.

---

## 2. Profile & Home (S-04)

### `GET /drivers/profile`

Full profile: identity + vehicle + reputation + active-session prefs.
Backs the Profile screen and the Home header.

### `GET /drivers/home-summary`

Returns:

```ts
{
  todayEarnings: number,                   // sum of netEarnings for today
  lastTrip: { origin, destination, completedAt, earnings } | null,
  outstandingBalance: number,              // platform commission owed
  announcements: AnnouncementCarouselItem[]
}
```

One-shot call to build the entire Home tab in S-04.

---

## 3. Going active / inactive (S-05, S-06)

### `POST /drivers/activate`

Body sets the session preferences (mandatory before matcher can offer
trips to this driver):

```json
{
  "destinationCity": "Amman",          // omit if goingHome=true
  "goingHome": false,
  "tripTypes": ["shared", "women_only"],
  "minPassengers": 2,                  // optional
  "currentLocationLat": 31.95,         // optional — see below
  "currentLocationLng": 35.91          // optional — see below
}
```

Returns the updated profile. Validates:

- `goingHome: true` → server picks the driver's `homeCity` as destination.
- `tripTypes` must include at least one. `women_only` is rejected for
  male drivers (gender-aware safety gate).
- 400 if the driver is currently `ON_TRIP` (finish the trip first).

**Location handling on activate:** `currentLocationLat/Lng` are
**optional**. If you provide them, they seed the matcher snapshot in
the same call. If you omit them, you should call
`POST /drivers/me/location` (see § 3a) before or after activate —
otherwise the matcher has no idea where the driver is.

### `POST /drivers/deactivate`

Wipes session prefs and sets status back to `INACTIVE`.

### `PATCH /drivers/preferences`

Mid-session edit (e.g. change destination while still active). Partial
body; only set the fields you're changing.

**Note:** This endpoint does **not** accept location updates — the
location ping is a separate high-frequency endpoint (§ 3a) so the
matcher snapshot can be refreshed every few seconds without paying
the preference-validation cost on every GPS tick.

### 3a. `POST /drivers/me/location` — high-frequency GPS ping

Records the driver's current position. Recommended cadence:
**every 5–10 seconds while the driver is active**, paused when inactive.

```json
{
  "lat": 31.9539,
  "lng": 35.9106,
  "heading": 124.5,       // optional, 0–360 degrees
  "speed": 18.4,          // optional, m/s
  "accuracy": 8.5         // optional, meters
}
```

Returns:

```json
{ "id": 12345, "recordedAt": "2026-06-06T14:32:11.214Z" }
```

Side effects:

- Appends a row to `driver_locations` (history — used by passenger
  "where is my driver?" view + analytics).
- Updates `Driver.prefLocationLat/Lng` (the matcher snapshot — always
  the latest position, no join needed).

Intentionally fire-and-forget — the response body is minimal so the
client can keep pinging without blocking on the previous reply. The
endpoint accepts pings even when the driver isn't `ACTIVE` (so clients
can preload the initial position before calling `activate`), but a
`SUSPENDED` driver gets 403.

### `PATCH /drivers/settings`

For the Settings screen — `fcmToken`, `language`, and the four
`notify*` toggles. **Send the FCM token here right after login** so
push delivery (when wired) targets the right device.

---

## 4. Trip lifecycle (S-07 → S-14)

The state machine, in order. All routes guarded by `jwt-driver`.

```
OFFERED ──accept──> ACCEPTED ──start──> IN_PROGRESS ──complete──> COMPLETED
   │                   │                     │
   │                   │                     ├──arriveAtStop──> (per stop)
   │                   │                     │   confirmPickup
   │                   │                     │   confirmDropoff
   │                   ▼                     ▼
   │                cancel(zone 1)        cancel(zone 2)
   │                                     (zone 3 forbidden if any
   │                                      passenger picked up)
   ▼
DECLINED / EXPIRED (offer countdown 45s default)
```

### `GET /drivers/trips/active`

S-10 resume on app reopen. 404 if no active trip — that's the signal
to take the user back to the Home tab.

### `GET /drivers/trips/:id/offer`

S-07 incoming-offer screen. Auto-expires if `offerExpiresAt` passed.

### `POST /drivers/trips/:id/accept`

S-08 → returns the full manifest. Side effects:

- All linked passenger requests transition to `MATCHED`.
- Linked packages transition to `MATCHED`.
- **Passengers and package senders get a `REQUEST_MATCHED` push** in
  their app's notification inbox.

400 if the offer expired between display and tap. 403 if the driver
already has another `ACCEPTED` / `IN_PROGRESS` trip.

### `POST /drivers/trips/:id/decline`

```json
{ "reason": "too_far", "notes": "Pickup is 15km outside my route" }
```

200. Logged for analytics.

### `GET /drivers/trips/:id/manifest`

Returns the stop-by-stop manifest: passengers (boarding/alighting),
packages (collecting/delivering), cash expected per stop, estimated
duration. The screen S-09 renders entirely off this.

### `POST /drivers/trips/:id/start`

S-09 → S-10. Driver status flips to `ON_TRIP`. Passengers get
`DRIVER_EN_ROUTE` push.

### `GET /drivers/trips/:id/active-state`

Live "what next" view — the current stop + actions enabled. Poll this
on the in-progress screen, or use it to refresh after each lifecycle
action.

### `POST /drivers/trips/:id/stops/:stopId/arrive`

S-11. Marks the stop ARRIVED. Boarding passengers get a
`DRIVER_ARRIVED` push.

### `POST /drivers/trips/:id/stops/:stopId/confirm-pickup`

```json
{
  "passengersPickedUp": [101, 102],
  "noShows": [103],
  "packagesCollected": [21],
  "packagesNotFound": [22]
}
```

Every boarding passenger and every collecting package must appear in
exactly one of the two arrays. Passengers picked up get `TRIP_STARTED`,
no-shows get `TRIP_CANCELLED`, collected packages get
`PACKAGE_PICKED_UP`, not-found packages get `PACKAGE_CANCELLED`.

### `POST /drivers/trips/:id/stops/:stopId/confirm-dropoff`

```json
{
  "passengersDroppedOff": [
    { "id": 201, "cashCollected": true },
    { "id": 202, "cashCollected": false }
  ],
  "packagesDelivered": [31],
  "deliveryFailures": [
    { "id": 32, "reason": "recipient_unreachable", "notes": "..." }
  ]
}
```

Bumps `totalCashCollected` by the sum of collected fares + fees.
Passengers dropped off get `TRIP_COMPLETED`; delivered packages get
`PACKAGE_DELIVERED`.

### `POST /drivers/trips/:id/complete`

S-13. Computes commission (`totalCashCollected × commissionRate`),
writes `netEarnings`, increments the driver's `totalTrips`, bumps
`outstandingBalance` by the commission owed, emits an
`EARNINGS_RECORDED` driver notification, and returns the post-trip
summary.

### `POST /drivers/trips/:id/cancel`

```json
{ "reason": "personal_emergency", "notes": "..." }
```

Three-zone system the backend computes for you:

- **Zone 1** — status `ACCEPTED`, no penalty, driver returns to `ACTIVE`.
- **Zone 2** — status `IN_PROGRESS` but no passenger picked up yet,
  soft penalty, driver flipped to `INACTIVE`.
- **Zone 3** — at least one passenger already picked up. 403 — use
  support flow, not cancel.

Passengers + package senders get `TRIP_CANCELLED` / `PACKAGE_CANCELLED`.

---

## 5. My Trips (history)

### `GET /drivers/trips/history`

Query params (all optional):

| Param | Description |
| --- | --- |
| `status` | Repeating: `?status=completed&status=cancelled`. Default is all terminal statuses (completed/cancelled/expired/declined). Ongoing work (offered/accepted/in_progress) is never returned here. |
| `from` | ISO 8601 lower bound on `departureTime` |
| `to`   | ISO 8601 upper bound on `departureTime` |
| `page` | default `1` |
| `limit` | default `20` |

Response is the standard paginated envelope with `data`, `page`,
`limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`.
Sorted by `departureTime` DESC.

Each item carries the lifecycle timestamps the UI typically wants to
show ("accepted 14:25 · started 14:30 · completed 15:55"), plus
`netEarnings` (null on non-completed) and `cancellationZone` (null
unless cancelled).

---

## 6. Earnings (S-15)

### `GET /drivers/earnings`

Query: `period=today|week|month` (default `week`), plus `page`/`limit`
for the trip list. Returns:

```ts
{
  summary: { period, totalCashCollected, totalCommission, netEarnings, tripCount },
  trips: EarningsTripDto[],   // paginated list of completed trips in the period
  outstandingBalance: number, // current commission owed to platform
  page, limit, totalItems, totalPages, hasNextPage, hasPreviousPage
}
```

Drives the Earnings tab summary header + recent-trips list.

### `GET /drivers/earnings/:tripId/breakdown`

Per-stop breakdown for one completed trip: passengers (with collected
flag), packages, cash collected at each stop, subtotal, commission,
net. Used by the trip-detail screen.

---

## 7. Notifications (S-18)

### `GET /drivers/notifications`

Query:

- `filter=trips|earnings|system` (default `all`)
- `page` (default `1`)
- `limit` (default `20`)

Returns paginated notification rows with `unreadCount` at the top
level — use that for the inbox badge.

Types:

- `trips`: `trip_assigned`, `trip_reminder`, `trip_updated`, `passenger_cancelled`
- `earnings`: `earnings_recorded`, `outstanding_balance`
- `system`: `system_announcement`

Title and body are stored in whatever language the writer emitted —
not localised at read time (unlike passenger notifications). If you
need bilingual driver notifications, raise it and we'll bump them to
the bilingual schema.

### `POST /drivers/notifications/mark-read`

XOR body:

```json
{ "notificationIds": [12, 13] }
// — or —
{ "all": true }
```

Returns `{ updated: <count> }`. Recompute the badge by re-reading
`unreadCount` from the list endpoint.

---

## 8. Shared / read-only

### `GET /faq`

Public FAQ. Returns active entries only, localised by `Accept-Language`.
Each entry has `id` (the slug — stable identifier for analytics /
deep-links), `category`, `question`, `answer`.

### `GET /app/init`

Single-shot config call the app should make on launch (after the
splash):

- Current minimum + latest version per platform (drives force-update
  prompt — compare against your bundle version).
- Store URLs.
- Maintenance mode flag + message.
- Support email.
- Localised legal docs (terms + privacy) rendered as **HTML** (not
  markdown) with a `format: 'html'` field — web-view ready.

### `GET /app/force-update`

Lightweight probe used by the force-update gate. Returns the same
version block as `/app/init` so the app can decide whether to block
the user.

### `GET /announcements/active`

Already inlined inside `/drivers/home-summary` — but exposed
separately if you want to refresh the carousel without re-fetching the
whole summary.

---

## 9. Testing tips

**Mock drivers** (already in the cloud DB):

| id | name | phone | country | status |
| --- | --- | --- | --- | --- |
| 2 | Notif Test Driver | `7799999001` | `+962` | active |
| 3 | Test Driver 2     | `7712345678` | `+962` | active |

Both are seeded with:

- **7 notifications** mixing all categories (5 unread, 2 read)
- **5 completed trips** with realistic earnings (net total 89.25 JD)
- **1 cancelled**, **1 declined**, **1 expired** trip
- `totalTrips: 5`, `rating: 4.80`, `outstandingBalance: 12.30`

So `/drivers/home-summary`, `/drivers/earnings?period=week`,
`/drivers/trips/history`, and `/drivers/notifications` all return
realistic data immediately after login.

**OTP** in dev/staging is always `1234`. SMS dispatch isn't wired yet.

**JWT secrets** on the production Render service are set manually
(not via `generateValue: true` in `render.yaml` — that only fires on
initial deploy). If you see 500 from any auth flow, that's the first
thing to check.
