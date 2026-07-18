# `GET /drivers/home-summary` — Mobile integration reference

Single-roundtrip endpoint that paints the entire driver Home tab.
Everything the mobile UI needs — live session state, today's rollups,
persistent stats, active carousel, and one status-conditional block —
comes back in one call. Refresh on every Home tab open and after every
lifecycle transition (accept, start, complete, cancel, suspend, etc.).

**Base URL (production):** `https://sarfees-api.onrender.com`
**Base URL (local dev):** `http://localhost:3000`
**Swagger:** `<base>/api/driver`

---

## Auth

```
GET /drivers/home-summary
Authorization: Bearer <driver-access-token>
Accept-Language: en | ar   (optional; drives announcement localization)
```

- Token from `POST /auth/driver/verify-otp` — cache the whole `driver` block
  it returns after login; this endpoint doesn't repeat identity data
  (name, vehicle, rating…).
- **Suspended drivers can call this endpoint.** Every other driver
  endpoint 403s on suspended, but this one must reach through so the
  suspended-state card can render.
- **401** → token expired. Hit `POST /auth/driver/refresh`.
- **404** → driver row gone (shouldn't happen). Route to Login.

---

## Response envelope

Every response is wrapped in the project-wide envelope:

```json
{ "code": 200, "message": "Success", "data": { … } }
```

The `data` block is what the rest of this doc describes.

---

## Full shape

```ts
{
  // ─── Live session state ────────────────────────────────────
  status: 'inactive' | 'active' | 'on_trip' | 'suspended',

  activePreferences: {                     // null when status=inactive/suspended
    destinationCity: string | null,        // null = "Any destination"
    tripTypes: ('shared' | 'women_only' | 'packages_only' | 'mixed')[],
    goingHome: boolean,
    minPassengers: 1 | 2 | 3 | null,
    activatedAt: Date,
    locationLat: number | null,
    locationLng: number | null
  } | null,

  sessionStartedAt: Date | null,           // = activePreferences.activatedAt

  // ─── Today's rollups (Postgres-evaluated calendar day) ─────
  todayEarnings: number,                   // SUM(netEarnings) for trips completed today
  tripsCompletedToday: number,
  commissionPercentageToday: number,       // effective % today; falls back to 15 if no trips

  // ─── Persistent ────────────────────────────────────────────
  lastTrip: {                              // most-recent COMPLETED trip, all-time
    origin: string,
    destination: string,
    completedAt: Date,
    earnings: number
  } | null,

  outstandingBalance: number,              // platform commission owed, JOD

  announcements: [
    {
      id, title, body,
      ctaUrl: string | null,
      isActive: boolean,
      startsAt: Date | null,
      endsAt: Date | null,
      priority: number,                    // highest first
      createdAt, updatedAt
    }
  ],

  // ─── Status-conditional blocks (exactly one non-null at a time) ─
  currentTrip:      CurrentTripDto      | null,   // iff status='on_trip'
  pendingOffer:     PendingOfferDto     | null,   // iff status='active' AND offer waiting
  lastSession:      LastSessionDto      | null,   // iff status='inactive' AND a session has ended
  suspensionInfo:   SuspensionInfoDto   | null    // iff status='suspended'
}
```

---

## Status → block matrix

Use `status` as the discriminator. Exactly one status-conditional block
is non-null in any response:

| status | currentTrip | pendingOffer | lastSession | suspensionInfo | activePreferences |
| --- | --- | --- | --- | --- | --- |
| `inactive` | `null` | `null` | populated¹ | `null` | `null` |
| `active` (idle) | `null` | `null` | `null` | `null` | populated |
| `active` (offer waiting) | `null` | populated | `null` | `null` | populated |
| `on_trip` | populated | `null` | `null` | `null` | populated |
| `suspended` | `null` | `null` | `null` | populated | `null` |

¹ `lastSession` is null for drivers who have never activated.

---

## `currentTrip` (when `status === 'on_trip'`)

Everything the "Resume Trip" card needs to render — current stop,
who's on board, running earnings, next stop.

```ts
currentTrip: {
  id, type, status,                  // status ∈ 'accepted' | 'in_progress'
  originCity, destinationCity,
  currentStopIndex: number,          // 0-based
  totalStops: number,

  currentStop: {                     // null only when currentStopIndex past last stop
    id, order,                       // order is 0-based, matches currentStopIndex
    type,                            // 'pickup' | 'dropoff' | 'pickup_dropoff'
    city, address,                   // address is nullable
    lat, lng,                        // for the Navigate button deep link
    status,                          // 'pending' | 'arrived' | 'confirmed'
    cashAtStop: number,              // sum of fares/fees due here
    etaMinutes: number | null,       // Haversine ÷ 40 km/h; null = no GPS ping yet
    passengers: [
      {
        id: number,                  // tripRequestId (stable handle)
        name: string,                // full name
        phone: string,               // full phone, unmasked (driver-only endpoint)
        role: 'boarding' | 'alighting',
        fare: number
      }
    ],
    packages: [
      {
        id: number,
        reference: string,           // e.g. "PKG-42"
        contactName: string,         // sender when collecting, receiver when delivering
        contactPhone: string,
        role: 'collecting' | 'delivering',
        fee: number
      }
    ]
  } | null,

  stopsProgress: [                   // drives the progress-dots strip
    { order, type, status }
  ],

  onBoard: {                         // passengers picked up but not yet dropped
    passengerCount: number,
    passengers: [{ id: number, name: string }]   // mobile renders initials
  },

  earnedSoFar: {                     // running net for this trip
    totalCashCollected: number,
    commissionRate: number,          // e.g. 0.15
    netEarningsSoFar: number         // totalCash × (1 − rate), rounded to 2dp
  },

  upNext: {                          // stop after currentStop; null on the last stop
    order, type, city, address,
    cashAtStop, etaMinutes
  } | null
}
```

**Notes:**
- Phone numbers are unmasked here — driver needs them to identify riders.
- `etaMinutes: 0` = driver is within ~50m of the stop. Render "Now" / "At stop".
- `etaMinutes: null` = driver hasn't pinged `/drivers/me/location` yet. Render "—".

---

## `pendingOffer` (when `status === 'active'`)

Populated the moment the matcher dispatches a `DriverTrip` in `OFFERED`
state to this driver. Mobile should route straight to `OfferScreen`.
`null` when the driver is active-and-idle.

```ts
pendingOffer: {
  tripId: number,                    // deep-link into OfferScreen / accept
  originCity, destinationCity,
  type,                              // shared | women_only | mixed | packages_only
  offerExpiresAt: Date,
  secondsRemaining: number           // countdown seed, based on server clock
} | null
```

Stale offers whose `offerExpiresAt` has passed are treated as `null` —
mobile never sees an offer it can't accept.

---

## `lastSession` (when `status === 'inactive'`)

Compact summary of the driver's most recent activate → deactivate cycle.
Gives the Home tab something concrete to show alongside the "Go online"
CTA. `null` for drivers who have never activated.

```ts
lastSession: {
  startedAt: Date,
  endedAt: Date,
  durationMinutes: number,           // whole minutes
  tripsCompleted: number,            // trips whose completedAt fell in the window
  earnings: number                   // SUM(netEarnings) for those trips, 2dp
} | null
```

---

## `suspensionInfo` (when `status === 'suspended'`)

Ops picks one of four **categories** on suspend, and the response
carries a category-specific sub-block plus the shared contact info.

```ts
suspensionInfo: {
  suspendedAt: Date,
  category: 'documents' | 'rating' | 'payment' | 'violation' | null,
  reason: string | null,
  supportEmail: string,              // env: SUPPORT_EMAIL
  supportPhone: string | null,       // env: SUPPORT_PHONE

  // Exactly one non-null based on `category`; all null for legacy
  // suspensions (category=null → mobile falls back to a generic card).
  documentsInfo: {
    expiredDocuments: [
      { type: 'driving_license' | 'vehicle_registration' | 'insurance_certificate' | 'national_id',
        expiresAt: Date }
    ]
  } | null,

  ratingInfo: {
    current: number,                 // e.g. 3.9
    minimum: number                  // env DRIVER_MIN_RATING, default 4.0
  } | null,

  paymentInfo: {
    outstandingBalance: number       // JOD
  } | null,

  reviewInfo: {
    estimatedMinDays: number,        // env DRIVER_REVIEW_MIN_DAYS, default 1
    estimatedMaxDays: number,        // env DRIVER_REVIEW_MAX_DAYS, default 3
    appealAvailable: boolean         // currently always true — mobile can enable "Submit Appeal"
  } | null
}
```

### Category → mobile card mapping

| `category` | Mobile card title | Extra block | Primary CTA |
| --- | --- | --- | --- |
| `documents` | "DOCUMENTS NEED UPDATING" | `documentsInfo.expiredDocuments[]` | "Update Documents" (mobile navigates to Documents screen) |
| `rating` | "SERVICE QUALITY REVIEW" | `ratingInfo` | "Start Quality Course" (mobile action) |
| `payment` | "COMMISSION PAYMENT OVERDUE" | `paymentInfo` | "Settle Balance" (mobile action) |
| `violation` | "POLICY VIOLATION REPORTED" | `reviewInfo` | "Contact Support" + "Submit Appeal" (mobile action) |

---

## When to call it

- **On every Home tab open** — status, offers, and today rollups all change independently.
- **After every trip lifecycle transition** — accept / start / arrive / confirm / complete / cancel. Any of them can flip status or bump earnings.
- **After activate / deactivate** — status flips + preferences change.
- **On resume from background** — the app may have missed a push.
- **On foreground pull-to-refresh** — user's implicit "give me the latest" gesture.

**Don't poll aggressively.** Once every 15–30 s while the Home tab is
frontmost is plenty when no lifecycle event fires. For faster updates
during a trip, use `GET /drivers/trips/:id/active-state`.

---

## Worked examples

### 1. Inactive driver with a completed session earlier today

```json
{
  "code": 200, "message": "Success",
  "data": {
    "status": "inactive",
    "activePreferences": null,
    "sessionStartedAt": null,
    "todayEarnings": 42.5,
    "tripsCompletedToday": 2,
    "commissionPercentageToday": 15,
    "lastTrip": {
      "origin": "Amman", "destination": "Zarqa",
      "completedAt": "2026-07-12T15:16:12.482Z",
      "earnings": 25.5
    },
    "outstandingBalance": 8.5,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": null,
    "lastSession": {
      "startedAt": "2026-07-12T13:16:12.480Z",
      "endedAt":   "2026-07-12T15:46:12.481Z",
      "durationMinutes": 150,
      "tripsCompleted": 2,
      "earnings": 42.5
    },
    "suspensionInfo": null
  }
}
```

### 2. Active driver with a fresh offer waiting

```json
{
  "code": 200, "message": "Success",
  "data": {
    "status": "active",
    "activePreferences": {
      "destinationCity": "Amman",
      "tripTypes": ["shared"],
      "goingHome": false,
      "minPassengers": 2,
      "activatedAt": "2026-07-12T20:00:00.000Z",
      "locationLat": 31.95, "locationLng": 35.91
    },
    "sessionStartedAt": "2026-07-12T20:00:00.000Z",
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": null,
    "outstandingBalance": 0,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": {
      "tripId": 42,
      "originCity": "Irbid", "destinationCity": "Amman",
      "type": "shared",
      "offerExpiresAt": "2026-07-12T20:10:00.000Z",
      "secondsRemaining": 599
    },
    "lastSession": null,
    "suspensionInfo": null
  }
}
```

### 3. Driver mid-trip, heading to a dropoff

```json
{
  "code": 200, "message": "Success",
  "data": {
    "status": "on_trip",
    "activePreferences": { … },
    "sessionStartedAt": "2026-07-12T20:00:00.000Z",
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": null,
    "outstandingBalance": 0,
    "announcements": [],
    "currentTrip": {
      "id": 42, "type": "shared", "status": "in_progress",
      "originCity": "Irbid", "destinationCity": "Amman",
      "currentStopIndex": 1, "totalStops": 2,
      "currentStop": {
        "id": 88, "order": 1, "type": "dropoff",
        "city": "Amman", "address": "Abdali Boulevard",
        "lat": 31.9539, "lng": 35.9106,
        "status": "pending",
        "cashAtStop": 5.5,
        "etaMinutes": 12,
        "passengers": [
          {
            "id": 101, "name": "Ahmad Hamdan",
            "phone": "+962799123456",
            "role": "alighting", "fare": 5.5
          }
        ],
        "packages": []
      },
      "stopsProgress": [
        { "order": 0, "type": "pickup",  "status": "confirmed" },
        { "order": 1, "type": "dropoff", "status": "pending"   }
      ],
      "onBoard": {
        "passengerCount": 1,
        "passengers": [{ "id": 101, "name": "Ahmad Hamdan" }]
      },
      "earnedSoFar": {
        "totalCashCollected": 0,
        "commissionRate": 0.15,
        "netEarningsSoFar": 0
      },
      "upNext": null
    },
    "pendingOffer": null,
    "lastSession": null,
    "suspensionInfo": null
  }
}
```

### 4. Suspended — payment category

```json
{
  "code": 200, "message": "Success",
  "data": {
    "status": "suspended",
    "activePreferences": null,
    "sessionStartedAt": null,
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": null,
    "outstandingBalance": 18.5,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": null,
    "lastSession": null,
    "suspensionInfo": {
      "suspendedAt": "2026-07-12T20:30:00.000Z",
      "category": "payment",
      "reason": "Commission overdue",
      "supportEmail": "support@sarfees.com",
      "supportPhone": "+96265000000",
      "documentsInfo": null,
      "ratingInfo": null,
      "paymentInfo": { "outstandingBalance": 18.5 },
      "reviewInfo": null
    }
  }
}
```

### 5. Suspended — documents category (with an expired registration)

```json
{
  "suspensionInfo": {
    "suspendedAt": "…",
    "category": "documents",
    "reason": "Vehicle registration expired",
    "supportEmail": "support@sarfees.com",
    "supportPhone": "+96265000000",
    "documentsInfo": {
      "expiredDocuments": [
        { "type": "vehicle_registration", "expiresAt": "2026-06-12T17:24:29.916Z" }
      ]
    },
    "ratingInfo": null, "paymentInfo": null, "reviewInfo": null
  }
}
```

### 6. Suspended — rating / violation

```json
// rating
"suspensionInfo": {
  "category": "rating",
  "ratingInfo": { "current": 3.9, "minimum": 4.0 },
  "documentsInfo": null, "paymentInfo": null, "reviewInfo": null,
  …
}

// violation
"suspensionInfo": {
  "category": "violation",
  "reviewInfo": {
    "estimatedMinDays": 1,
    "estimatedMaxDays": 3,
    "appealAvailable": true
  },
  "documentsInfo": null, "ratingInfo": null, "paymentInfo": null,
  …
}
```

---

## Field reference — one line per field

| Field | Type | Notes |
| --- | --- | --- |
| `status` | enum | `inactive` \| `active` \| `on_trip` \| `suspended`. **Use as the discriminator.** |
| `activePreferences` | object \| null | Non-null iff driver has an active session (`active` or `on_trip`). |
| `activePreferences.destinationCity` | string \| null | `null` = "Any Destination" the matcher can offer any city. |
| `activePreferences.tripTypes` | string[] | Non-empty when set. `women_only` requires driver gender=female. |
| `activePreferences.goingHome` | boolean | When true, matcher biases offers toward the driver's `homeCity`. |
| `activePreferences.minPassengers` | 1 \| 2 \| 3 \| null | Matcher won't offer trips with fewer. `null` = any. |
| `activePreferences.activatedAt` | Date | When driver most recently hit `/drivers/activate`. |
| `activePreferences.locationLat/Lng` | number \| null | Matcher snapshot — same as last `/drivers/me/location` ping. |
| `sessionStartedAt` | Date \| null | Duplicate of `activePreferences.activatedAt` for convenience. |
| `todayEarnings` | number | SUM(netEarnings) for trips completed **today** (Postgres session TZ). |
| `tripsCompletedToday` | int | COUNT of trips completed today. |
| `commissionPercentageToday` | number | Effective % today, weighted by cash. `15` (platform default) if no trips. |
| `lastTrip` | object \| null | Most-recent COMPLETED trip, **all-time** — could be weeks ago. |
| `outstandingBalance` | number | Platform commission owed, JOD. Bumped on trip complete; cleared by ops via admin settle. |
| `announcements[]` | array | Active ops carousel items, highest `priority` first. Empty if none active. |
| `currentTrip` | object \| null | See §currentTrip. Populated iff `status='on_trip'`. |
| `pendingOffer` | object \| null | See §pendingOffer. Populated iff `status='active'` AND an offer is waiting. |
| `lastSession` | object \| null | See §lastSession. Populated iff `status='inactive'` AND a session has ended. |
| `suspensionInfo` | object \| null | See §suspensionInfo. Populated iff `status='suspended'`. |

---

## Edge cases & gotchas

- **`lastTrip` is all-time, not today.** If you want "last trip during this session", filter client-side using `sessionStartedAt`.
- **Empty `activePreferences.tripTypes`** can happen for drivers who were force-activated by ops without going through `/drivers/activate`. Treat as "any type" or route to the Preferences screen.
- **`etaMinutes: null` isn't an error.** It just means the driver hasn't sent a location ping yet. Render "—" and prompt the driver to enable GPS.
- **`onBoard.passengers[].name` may be empty string** if the passenger's User row has no `firstName/lastName` (phone-only signup). Render an initial from the phone or a generic "Passenger" placeholder.
- **Suspended drivers can call this endpoint.** Every other driver endpoint 403s them. Don't hide the Home tab based on `status === 'suspended'` — the suspended-state card *is* the Home tab in that case.
- **`suspensionInfo.category` can be `null`** for drivers suspended before this feature shipped. Fall back to a generic "Account Suspended · Contact Support" card.
- **`pendingOffer` doesn't guarantee the offer is still valid.** It filters out expired ones server-side, but there's always a race with the countdown. When the driver taps Accept, the accept endpoint may still return 400 "Offer expired" — handle it.

---

## Related endpoints

- `POST /auth/driver/verify-otp` — login. Returns the persistent driver + vehicle block to cache.
- `POST /auth/driver/refresh` — rotate tokens on 401.
- `POST /drivers/activate` / `POST /drivers/deactivate` / `PATCH /drivers/preferences` — session mutations. Refresh home-summary after each.
- `POST /drivers/me/location` — GPS ping. Feeds `activePreferences.locationLat/Lng` + the ETA computation for `currentTrip.currentStop.etaMinutes`.
- `POST /drivers/trips/:id/accept` — pop this when the mobile UI opens OfferScreen from `pendingOffer`.
- `GET /drivers/trips/:id/manifest` — full manifest with lat/lng/masked-phones for the current trip (deeper than `currentTrip`).
- `GET /drivers/trips/:id/active-state` — lightweight polling target during a trip.
- `POST /admin/drivers/:id/suspend` — admin op; body `{ category, reason }` populates the corresponding suspensionInfo sub-block.
