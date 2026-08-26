# Driver Active Trip — screen states & responses

Base URL: `http://169.58.67.105` · Driver JWT (`Authorization: Bearer …`) · Envelope: `{ "code", "message", "data" }` — examples below show `data` only.

The active-trip experience is a **status machine on the DriverTrip** plus a
**stop loop** while driving. One screen state per status:

| DriverTrip `status` | Screen | Data source |
|---|---|---|
| `offered` | Offer sheet with countdown | `GET /drivers/trips/{id}/offer` |
| `accepted` | Upcoming trip (Start button) | home-summary `currentTrip` + `GET /drivers/trips/{id}/manifest` |
| `in_progress` | Live stop-by-stop screen | `GET /drivers/trips/{id}/active-state` (+ manifest for the full plan) |
| `completed` | Trip summary | response of `POST /drivers/trips/{id}/complete` |
| `cancelled` / `expired` / `declined` | Nothing to render (trip gone) | — |

Driver **status** meanwhile: `active` → (accept) → `on_trip` → (complete /
cancel) → `active`. The accepted trip is on the home summary from the moment
of acceptance (`currentTrip.status: "accepted"`).

## 1. `offered` — the offer sheet

Push `offer_received` arrives (cascade AND manual assign — same type, same payload contract); render from `GET /drivers/trips/{id}/offer`.
The offer expires after the countdown (default 45 s) — no response counts
as a decline with penalty.

```json
{
  "id": 97,
  "type": "shared",
  "originCity": "Irbid",
  "destinationCity": "Amman",
  "departureTime": "2026-08-19T00:58:22.055Z",
  "passengerCount": 2,
  "packageCount": 1,
  "stopCount": 5,
  "estimatedDurationMinutes": 75,
  "estimatedCashToCollect": 13.00,
  "offerExpiresAt": "2026-08-19T00:59:07.055Z",
  "requiredWalletCommission": 1.95
}
```

Render: route, departure, counts, cash to collect, countdown ring.
Actions: `POST /drivers/trips/{id}/accept` · `POST /drivers/trips/{id}/decline { "reason": … }`.
`type: "women_only"` → show the women-only badge.

## 2. `accepted` — upcoming trip

After accept the driver is `on_trip`; home summary carries:

```json
"status": "on_trip",
"currentTrip": { "id": 97, "status": "accepted", "originCity": "Irbid",
                 "destinationCity": "Amman", "currentStopIndex": 0, "totalStops": 5, … }
```

Render an "Upcoming trip" card: route, departure time, **Start trip** button
→ `POST /drivers/trips/{id}/start`. Preview the plan with
`GET /drivers/trips/{id}/manifest` (same shape as §3). Cancel here is
zone 1: `POST /drivers/trips/{id}/cancel` — driver returns to `active`.

## 3. `in_progress` — the stop loop

`start` returns the **manifest** (the whole plan). During driving poll
`GET /drivers/trips/{id}/active-state` (light) and re-fetch the manifest
after each confirmation.

Manifest (`GET /drivers/trips/{id}/manifest`):

```json
{
  "id": 97, "type": "shared", "status": "in_progress",
  "originCity": "Irbid", "destinationCity": "Amman",
  "departureTime": "2026-08-19T00:58:22.055Z",
  "currentStopIndex": 1,
  "totalCashExpected": 13.00, "totalCashCollected": 5.00,
  "commissionRate": 0.15,
  "summary": { "stopCount": 5, "passengerCount": 2, "packageCount": 1,
               "estimatedDurationMinutes": 75 },
  "stops": [
    { "id": 301, "order": 0, "type": "pickup", "city": "Irbid",
      "address": "University St.", "lat": 32.5401, "lng": 35.8520,
      "status": "confirmed", "cashExpected": 5.00,
      "passengers": [],
      "packages": [ { "id": 14, "reference": "PKG-14", "senderName": "Hala A.",
        "senderPhoneMasked": "+962 7X XXX XX22", "receiverName": "Yousef R.",
        "receiverPhoneMasked": "+962 7X XXX XX44", "size": "SMALL",
        "description": "Documents", "fee": 5.00,
        "role": "collecting", "status": "collected" } ] },
    { "id": 302, "order": 1, "type": "pickup", "city": "Irbid",
      "address": null, "lat": 32.5556, "lng": 35.8500,
      "status": "arrived", "cashExpected": 0,
      "passengers": [ { "id": 101, "name": "Lina A.", "gender": "Female",
        "phoneMasked": "+962 7X XXX XX02", "role": "boarding",
        "fare": 4.00, "status": "pending", "cashCollected": null } ],
      "packages": [] },
    { "id": 303, "order": 2, "type": "dropoff", "city": "Amman", "…": "…" }
  ]
}
```

Active state (`GET /drivers/trips/{id}/active-state`):

```json
{
  "tripId": 97, "status": "in_progress",
  "currentStopIndex": 1, "totalStops": 5, "remainingStops": 4,
  "currentStop": { "id": 302, "order": 1, "type": "pickup", "city": "Irbid",
    "address": null, "lat": 32.5556, "lng": 35.8500, "status": "arrived",
    "cashExpected": 0, "passengerCount": 1, "packageCount": 0 },
  "totalCashCollected": 5.00, "totalCashExpected": 13.00
}
```

### The per-stop action cycle

1. `POST …/stops/{stopId}/arrive` — stop `pending → arrived`.
2. Pickup stop → `POST …/stops/{stopId}/confirm-pickup`
   `{ "passengersPickedUp": [101], "passengersNoShow": [],
      "packagesCollected": [...], "packagesNotFound": [], "packagesRefused": [{id, reason}] }`
   — package cash is collected HERE; passenger fares are NOT.
3. Package delivery proof (optional): `POST …/{id}/handover-photo`
   (multipart, `photo` field) → `{ "photoUrl": "/uploads/handover-photos/…" }`
   — pass it in the next confirm's `packagesDelivered[].photoUrl`.
4. Dropoff stop → `POST …/stops/{stopId}/confirm-dropoff`
   `{ "passengersDroppedOff": [{ "id": 101, "cashCollected": true }],
      "packagesDelivered": [{ "id": 14, "deliveryCode": "6532", "photoUrl": … }],
      "packagesFailed": [] }`
   — passenger cash at their own dropoff; package delivery needs the
   receiver's 4-digit code (wrong code → 400).
5. Both confirms return the fresh **active-state** — advance the UI.

Row status chips: passengers `pending / picked_up / no_show / dropped_off /
cash_not_collected / cancelled`; packages `pending / collected / not_found /
refused / delivered / delivery_failed`. Stop types: `pickup / dropoff /
pickup_dropoff`.

Cancel mid-trip is zone 2 and only allowed while **no passenger is on
board** — after any pickup it returns 403.

## 4. `completed` — the summary

All stops `confirmed` → `POST /drivers/trips/{id}/complete`:

```json
{
  "tripId": 97,
  "route": "Irbid → Amman",
  "durationMinutes": 82,
  "passengersServed": 2,
  "packagesDelivered": 1,
  "totalCashCollected": 13.00,
  "commissionRate": 0.15,
  "commissionAmount": 1.95,
  "netEarnings": 11.05,
  "outstandingBalance": 23.25,
  "walletBalance": 24.05,
  "commissionDeducted": 1.95
}
```

Render: earnings breakdown (cash − commission = net), wallet balance after
deduction. Driver returns to `active` (session intact) — unless going-home
into the home city (offline until midnight). Then show the **rating sheet**:
`GET /drivers/trips/{id}/ratables` →

```json
[
  { "kind": "passenger", "passengerId": 2, "packageDeliveryId": null,
    "name": "Lina Abbadi", "alreadyRated": false },
  { "kind": "sender", "passengerId": 12, "packageDeliveryId": 14,
    "name": "Hala Aslan", "alreadyRated": false }
]
```

Rate passengers with `POST /drivers/trips/{id}/rate`
`{ "passengerId": 2, "level": "very_good" }`, senders with
`POST /drivers/trips/{id}/rate-package`
`{ "packageDeliveryId": 14, "level": "good" }`. Optional; `bad` needs a
message; 409 = already rated.

## 5. Terminal without a screen

- `cancelled` — by the driver, the admin, or all passengers cancelling.
  The app receives the relevant push and returns to the home tab
  (driver is `active` again for zone-1/admin/passenger cancels,
  `inactive` for zone-2 self-cancel).
- `expired` — the offer timed out; nothing to show.
- `declined` — the driver declined; nothing to show.
