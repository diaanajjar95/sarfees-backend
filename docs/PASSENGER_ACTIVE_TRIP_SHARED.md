# Passenger Active Trip (shared) — screen states & responses

Base URL: `http://169.58.67.105` · Customer JWT · Envelope `{ "code", "message", "data" }` — examples show `data` only.

The passenger's live screen is driven by **one polling endpoint**:

- `GET /trips/{tripRequestId}/status` → `ActiveTripStatusResponseDto` (poll ~10 s while active)
- `GET /trips/{tripRequestId}/driver-location` → latest GPS only (poll ~5 s when drawing the car)
- `GET /trips/active` → resume after app relaunch: `{ type: "trip", tripType: "shared", trip: {…} }`

Response shape (all statuses share it — fields fill in as the trip advances):

| Field | Filled from |
|---|---|
| `tripId`, `status`, `createdAt`, `statusUpdatedAt` | always |
| `departureLocation` / `arrivalLocation` `{lat,lng}` | always |
| `driver` (name, photo, vehicle, plate, rating, totalTrips) | `MATCHED` onward |
| `driverLocation` (lat, lng, heading, speed, recordedAt) | `DRIVER_EN_ROUTE` onward, while the driver streams GPS |
| `etaToPickup` / `etaToDestination` | set by the driver app during the corresponding phases |

## Status walkthrough

`PENDING → MATCHED → DRIVER_EN_ROUTE → ARRIVED_AT_PICKUP → TRIP_IN_PROGRESS → ARRIVING_AT_DROPOFF → COMPLETED`, with `CANCELLED` possible until completion.

### 1. `PENDING` — searching for a driver

```json
{
  "tripId": 80, "status": "PENDING",
  "etaToPickup": null, "etaToDestination": null,
  "departureLocation": { "lat": 32.5556, "lng": 35.8500 },
  "arrivalLocation": { "lat": 31.9539, "lng": 35.9106 },
  "driver": null, "driverLocation": null,
  "statusUpdatedAt": null, "createdAt": "2026-08-19T09:00:00.000Z"
}
```

Render: "Finding your driver…" with the route on the map; Cancel button
(`POST /trips/{id}/cancel` style — free at this stage). Pushes that may
arrive: `trip_frozen` (search started at T-30) and
`trip_delay_escalation` (nobody accepted by departure — show "Sarfees is
working on it", keep the screen).

### 2. `MATCHED` — driver assigned

Push `request_matched` / `trip_assigned`.

```json
{
  "tripId": 80, "status": "MATCHED",
  "etaToPickup": null, "etaToDestination": null,
  "departureLocation": { "lat": 32.5556, "lng": 35.8500 },
  "arrivalLocation": { "lat": 31.9539, "lng": 35.9106 },
  "driver": {
    "id": 1, "firstName": "Ahmad", "lastName": "Khalil",
    "profilePhotoUrl": "/uploads/profiles/driver.jpg",
    "vehicleMake": "Toyota", "vehicleModel": "Camry",
    "vehicleColor": "White", "vehicleYear": 2021, "plateNumber": "22-11223",
    "rating": 4.85, "totalTrips": 227
  },
  "driverLocation": null,
  "statusUpdatedAt": "2026-08-19T09:04:31.000Z", "createdAt": "2026-08-19T09:00:00.000Z"
}
```

Render: driver card (photo, name, ★, vehicle + plate — the plate is the
main trust element), call button, departure time. The driver hasn't
started yet.

### 3. `DRIVER_EN_ROUTE` — driver heading to pickup

Push `driver_en_route` (driver pressed Start).

```json
{
  "tripId": 80, "status": "DRIVER_EN_ROUTE",
  "etaToPickup": "8 min", "etaToDestination": null,
  "driver": { "…": "as above" },
  "driverLocation": { "lat": 32.5480, "lng": 35.8511,
    "heading": 12.5, "speed": 43.0, "recordedAt": "2026-08-19T09:20:01.000Z" },
  "…": "…"
}
```

Render: live map with the car marker (heading rotates the icon), ETA to
pickup, driver card collapsed. Start polling `driver-location`.

### 4. `ARRIVED_AT_PICKUP` — car is outside

Push `driver_arrived`. Same shape; `status` flips, `etaToPickup` goes stale.
Render: "Your driver has arrived" banner + vehicle/plate reminder.

### 5. `TRIP_IN_PROGRESS` — on board

Push `trip_started` (fires when THIS passenger is confirmed picked up).
`etaToDestination` becomes the headline ("1h 25m"). Render: progress map,
destination ETA, share-trip, SOS if designed. Note: on a shared trip other
passengers may still be picked up after you — the map may detour; that's
normal.

### 6. `ARRIVING_AT_DROPOFF` — almost there

Same shape; render an "arriving soon" state and surface the fare to have
cash ready — **passenger cash is collected at their own dropoff**.

### 7. `COMPLETED` — done

Push `trip_completed`, then the optional `rate_your_trip` nudge
(`payload.tripRequestId`). `driverLocation` stops updating. Render: trip
summary (route, fare paid) and the 5-level rating sheet →
`POST /trips/request/{id}/rate` `{ "level": "excellent", "message": "…" }`
(read back: `GET /trips/request/{id}/rating`). Rating is optional; `bad`
requires a message; 409 = already rated.

### 8. `CANCELLED` — any time before completion

Push `trip_cancelled` (payload may carry the reason — driver cancel,
admin cancel with the reason text shown, or the passenger's own action).

```json
{ "tripId": 80, "status": "CANCELLED", "driver": null, "driverLocation": null, "…": "…" }
```

Render: cancellation state with rebook CTA. If a driver had cancelled,
copy says a new driver is being searched **only** when the backend
restarted matching (a fresh `PENDING` request appears via `GET /trips/active`).

## Resume rule

On app start call `GET /trips/active`. `type: "trip"` + `tripType:
"shared"` → open this screen with the embedded `trip` object; `null` →
home. `statusUpdatedAt` is the staleness anchor for "last updated x ago".
