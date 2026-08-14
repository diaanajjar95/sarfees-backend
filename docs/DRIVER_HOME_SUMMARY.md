# Driver Home Summary — technical reference

`GET /drivers/home-summary` · Bearer driver JWT (24 h) · i18n via `Accept-Language: en|ar`

One call paints the driver app's entire Home tab. The response always has the
same top-level shape; the `status` field decides which **one** of the
status-conditional blocks is populated. Poll it every ~30 s while the app is
foregrounded — offers only live for 30 seconds, so slower polling misses them.

Every example below is a **real response captured from the production API**
(driver Omar Haddad, Amman → Irbid corridor). Envelope: every Sarfees response
wraps payloads as `{ "code", "message", "data" }`.

---

## 1. The status machine

```
                 activate                    offer accepted + started
   ┌─────────┐ ───────────► ┌────────┐ ────────────────────────► ┌─────────┐
   │inactive │              │ active │                           │ on_trip │
   └─────────┘ ◄─────────── └────────┘ ◄──────────────────────── └─────────┘
        ▲        deactivate      │        complete / cancel
        │        (or going-home  │
        │         auto-offline)  │  admin suspend (any state)
        │                        ▼
        │                  ┌───────────┐
        └───────────────── │ suspended │   admin reinstate → inactive
                           └───────────┘
```

| `status` | Meaning | Non-null conditional block |
|---|---|---|
| `inactive` | Off shift. Not considered by the matcher. | `lastSession` (if they had one) |
| `active` | On shift, matchable. May carry a live offer. | `pendingOffer` (only while an offer is live) |
| `on_trip` | Executing an accepted trip. | `currentTrip` |
| `suspended` | Blocked by ops. Cannot activate. | `suspensionInfo` |

At most one of `currentTrip` / `pendingOffer` / `lastSession` /
`suspensionInfo` is non-null at a time. Everything else
(`todayEarnings`, `tripsCompletedToday`, `commissionPercentageToday`,
`lastTrip`, `outstandingBalance`, `announcements`) is always present.

Going-home note: when a driver activated with `goingHome: true` completes a
trip into their home city, the backend deactivates them automatically until
local midnight — the next poll simply returns `inactive`, and re-activating
before midnight returns 403.

---

## 2. `inactive`

Off shift. `activePreferences` and `sessionStartedAt` are `null`.
`lastSession` summarizes the most recent shift so the Home tab can show
"your last session" stats next to the Go Online button.

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "status": "inactive",
    "activePreferences": null,
    "sessionStartedAt": null,
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": {
      "origin": "Irbid",
      "destination": "Amman",
      "completedAt": "2026-07-25T16:30:33.000Z",
      "earnings": 4.25
    },
    "outstandingBalance": 1.5,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": null,
    "lastSession": {
      "startedAt": "2026-08-12T19:36:56.376Z",
      "endedAt": "2026-08-12T19:54:30.853Z",
      "durationMinutes": 18,
      "tripsCompleted": 0,
      "earnings": 0
    },
    "suspensionInfo": null
  }
}
```

`lastSession` is `null` for a brand-new driver who has never activated.

---

## 3. `active` (no offer)

On shift and matchable. `activePreferences` echoes exactly what the driver
locked in at `POST /drivers/activate`; `sessionStartedAt` marks the start of
this shift. `lastSession` is `null` while a session is running.

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "status": "active",
    "activePreferences": {
      "destinationCity": "Irbid",
      "tripTypes": ["mixed"],
      "goingHome": false,
      "minPassengers": 1,
      "activatedAt": "2026-08-14T10:07:49.709Z",
      "locationLat": 31.9539,
      "locationLng": 35.9106
    },
    "sessionStartedAt": "2026-08-14T10:07:49.709Z",
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": {
      "origin": "Irbid",
      "destination": "Amman",
      "completedAt": "2026-07-25T16:30:33.000Z",
      "earnings": 4.25
    },
    "outstandingBalance": 1.5,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": null,
    "lastSession": null,
    "suspensionInfo": null
  }
}
```

⚠️ `locationLat/Lng` is overwritten by every GPS ping the app sends
(`POST /drivers/me/location`, ~10 s cadence). The matcher uses this position
for the origin-city filter — an emulator left on default GPS (Mountain View)
makes the driver silently unmatchable.

---

## 4. `active` + `pendingOffer`

Same `active` status, but the matcher has offered this driver a trip.
**The offer expires in `secondsRemaining` seconds** (default countdown 30 s;
no response counts as a decline). The app must surface it immediately and call
`POST /drivers/trips/{tripId}/accept` or `/decline`.

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "status": "active",
    "activePreferences": {
      "destinationCity": "Irbid",
      "tripTypes": ["mixed"],
      "goingHome": false,
      "minPassengers": 1,
      "activatedAt": "2026-08-14T10:07:49.709Z",
      "locationLat": 31.9539,
      "locationLng": 35.9106
    },
    "sessionStartedAt": "2026-08-14T10:07:49.709Z",
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": {
      "origin": "Irbid",
      "destination": "Amman",
      "completedAt": "2026-07-25T16:30:33.000Z",
      "earnings": 4.25
    },
    "outstandingBalance": 1.5,
    "announcements": [],
    "currentTrip": null,
    "pendingOffer": {
      "tripId": 85,
      "originCity": "Amman",
      "destinationCity": "Irbid",
      "type": "shared",
      "offerExpiresAt": "2026-08-14T10:09:00.334Z",
      "secondsRemaining": 24
    },
    "lastSession": null,
    "suspensionInfo": null
  }
}
```

`pendingOffer.type` is `shared` | `women_only` | `packages_only` | `mixed`.
For the full manifest (stops, passengers, parcels, cash), fetch
`GET /drivers/trips/{tripId}/offer` — accepting also returns it.

Repeated declines and timeouts carry a ranking penalty (30-day decaying
window), so "ignore the offer" is not free.

---

## 5. `on_trip`

An accepted trip is underway. `currentTrip` carries everything the "Resume
Trip" card renders — no follow-up call needed to paint the Home tab.

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "status": "on_trip",
    "activePreferences": {
      "destinationCity": "Irbid",
      "tripTypes": ["mixed"],
      "goingHome": false,
      "minPassengers": 1,
      "activatedAt": "2026-08-14T10:07:49.709Z",
      "locationLat": 31.9539,
      "locationLng": 35.9106
    },
    "sessionStartedAt": "2026-08-14T10:07:49.709Z",
    "todayEarnings": 0,
    "tripsCompletedToday": 0,
    "commissionPercentageToday": 15,
    "lastTrip": {
      "origin": "Irbid",
      "destination": "Amman",
      "completedAt": "2026-07-25T16:30:33.000Z",
      "earnings": 4.25
    },
    "outstandingBalance": 1.5,
    "announcements": [],
    "currentTrip": {
      "id": 85,
      "type": "shared",
      "status": "in_progress",
      "originCity": "Amman",
      "destinationCity": "Irbid",
      "currentStopIndex": 0,
      "totalStops": 2,
      "currentStop": {
        "id": 181,
        "order": 0,
        "type": "pickup",
        "city": "Amman",
        "address": null,
        "lat": 31.9539,
        "lng": 35.9106,
        "status": "pending",
        "cashAtStop": 0,
        "etaMinutes": 0,
        "passengers": [
          {
            "id": 69,
            "name": "Lina Abbadi",
            "phone": "+962790000002",
            "role": "boarding",
            "fare": 5
          }
        ],
        "packages": []
      },
      "stopsProgress": [
        { "order": 0, "type": "pickup", "status": "pending" },
        { "order": 1, "type": "dropoff", "status": "pending" }
      ],
      "onBoard": { "passengerCount": 0, "passengers": [] },
      "earnedSoFar": {
        "totalCashCollected": 0,
        "commissionRate": 0.15,
        "netEarningsSoFar": 0
      },
      "upNext": {
        "order": 1,
        "type": "dropoff",
        "city": "Irbid",
        "address": null,
        "cashAtStop": 5,
        "etaMinutes": 70
      }
    },
    "pendingOffer": null,
    "lastSession": null,
    "suspensionInfo": null
  }
}
```

Reading `currentTrip`:

- `currentStop` — the stop the driver is working now, with the people/parcels
  to handle there. `passengers[].role` is `boarding` (pickup) or `alighting`
  (dropoff); packages carry `collecting` / `delivering` and their reference
  `PKG-<id>`. Cash rules: passenger fares are collected at *their own
  dropoff*; package cash is collected at the *collection* stop (§6.1).
- `stopsProgress` — mini progress bar (`pending` / `current` / `completed`).
- `onBoard` — who is currently in the car (fills after pickups confirm).
- `earnedSoFar` — running cash + net after commission.
- `upNext` — one-line preview of the next stop; `null` at the last stop.
- Multi-passenger trips have one pickup **and** one dropoff stop per
  passenger; mixed trips put package collection first and package delivery
  last.

Stop execution happens via `POST /drivers/trips/{id}/stops/{stopId}/arrive`,
`/confirm-pickup`, `/confirm-dropoff`, then `POST /drivers/trips/{id}/complete`.

---

## 6. `suspended`

Ops blocked the driver (`POST /admin/drivers/:id/suspend`). Activation is
refused; `suspensionInfo` tells the app which card to render. `category`
decides which **one** of the four detail blocks is non-null. Legacy
suspensions from before categories shipped have `category: null` — render a
generic suspended card with the support contacts.

### 6.1 `documents` — paperwork lapse

```json
"suspensionInfo": {
  "suspendedAt": "2026-08-14T10:08:48.597Z",
  "category": "documents",
  "reason": "Docs capture — documents example",
  "supportEmail": "support@sarfees.com",
  "supportPhone": "",
  "documentsInfo": {
    "expiredDocuments": []
  },
  "ratingInfo": null,
  "paymentInfo": null,
  "reviewInfo": null
}
```

`expiredDocuments` lists each lapsed document as
`{ "type", "expiredAt" }` (empty here because the test driver's papers were
valid — a real documents suspension lists the offending ones). App CTA:
re-upload via `POST /drivers/me/documents`.

### 6.2 `rating` — below platform minimum

```json
"suspensionInfo": {
  "suspendedAt": "2026-08-14T10:08:49.595Z",
  "category": "rating",
  "reason": "Docs capture — rating example",
  "supportEmail": "support@sarfees.com",
  "supportPhone": "",
  "documentsInfo": null,
  "ratingInfo": {
    "current": 4.7,
    "minimum": 4
  },
  "paymentInfo": null,
  "reviewInfo": null
}
```

App shows current vs required rating and the support contact.

### 6.3 `payment` — commission overdue

```json
"suspensionInfo": {
  "suspendedAt": "2026-08-14T10:08:50.513Z",
  "category": "payment",
  "reason": "Docs capture — payment example",
  "supportEmail": "support@sarfees.com",
  "supportPhone": "",
  "documentsInfo": null,
  "ratingInfo": null,
  "paymentInfo": {
    "outstandingBalance": 1.5
  },
  "reviewInfo": null
}
```

`outstandingBalance` (JD) mirrors the top-level field. App CTA: settle with
ops via the support contact.

### 6.4 `violation` — conduct report under review

```json
"suspensionInfo": {
  "suspendedAt": "2026-08-14T10:08:51.462Z",
  "category": "violation",
  "reason": "Docs capture — violation example",
  "supportEmail": "support@sarfees.com",
  "supportPhone": "",
  "documentsInfo": null,
  "ratingInfo": null,
  "paymentInfo": null,
  "reviewInfo": {
    "estimatedMinDays": 1,
    "estimatedMaxDays": 3,
    "appealAvailable": true
  }
}
```

App shows the expected review window (1–3 days by default) and an appeal
entry point (support contact).

The rest of the suspended response looks like `inactive`
(`activePreferences: null`, all conditional blocks except `suspensionInfo`
null) — top-level fields like `lastTrip` and `outstandingBalance` remain
available, so the Home tab keeps its history strip.

---

## 7. Always-present fields (all statuses)

| Field | Type | Notes |
|---|---|---|
| `status` | enum | `inactive` \| `active` \| `on_trip` \| `suspended` |
| `activePreferences` | object \| null | Locked at activation; null unless active/on_trip |
| `sessionStartedAt` | ISO date \| null | Start of the current shift |
| `todayEarnings` | number | Sum of net earnings for trips completed today (local calendar day) |
| `tripsCompletedToday` | number | Count for today |
| `commissionPercentageToday` | number | Effective % today; platform default (15) when no trips yet |
| `lastTrip` | object \| null | `{ origin, destination, completedAt, earnings }` — most recent completed trip ever |
| `outstandingBalance` | number | JD the driver owes the platform |
| `announcements` | array | Active ops announcements, highest priority first |

All timestamps are ISO-8601 UTC (`Z`). The server runs Asia/Amman (GMT+3);
convert for display on the device.
