# Passenger Active Trip (send package) — screen states & responses

Base URL: `http://169.58.67.105` · Customer JWT (the **sender**) · Envelope `{ "code", "message", "data" }` — examples show `data` only.

A package is its own resource — never call `/trips/...` with a package id
(404). The sender's live screen is driven by:

- `GET /packages/{id}/status` — light poll (~15 s), shape below
- `GET /packages/{id}` — full details (photo, sizes, receiver, fees) for the header
- `GET /trips/active` — resume: `{ "type": "package", "tripType": "sendPackage", "package": {…} }`

`GET /packages/{id}/status` shape:

| Field | Notes |
|---|---|
| `id`, `status`, `updatedAt` | always |
| `driver` `{ name, phoneNumber, rating }` | `null` until `MATCHED` |
| `deliveryCode` | 4 digits, minted at booking — the receiver must quote it to the driver |

Full detail (`GET /packages/{id}` / the `package` object in `/trips/active`)
adds: `departureCity`/`arrivalCity`, `pickupLocation`/`dropOffLocation`
`{lat,lng}`, `packageSize` (`SMALL|MEDIUM|LARGE`), `packageDescription`,
`packagePhotoUrl`, `receiverName`, `receiverPhone`, `deliveryFee`,
`isImmediate`, `pickupDate`, `createdAt`.

**No live map for packages** — there is no driver-location endpoint on this
path (by design; the receiver's tracking link is timeline-only too).

## Status walkthrough

`PENDING → MATCHED → PICKED_UP → IN_TRANSIT → DELIVERED`, or `CANCELLED`
any time before delivery.

### 1. `PENDING` — searching for a driver

```json
{ "id": 15, "status": "PENDING", "updatedAt": "2026-08-19T09:00:12.000Z",
  "driver": null, "deliveryCode": "6532" }
```

Render: "Finding a driver…", the package card (photo, size, fee,
receiver), cancel button (`POST /packages/{id}/cancel` — allowed
pre-pickup). Show the delivery code already with copy "share this with
your receiver — the driver needs it at handoff".

### 2. `MATCHED` — driver assigned

```json
{ "id": 15, "status": "MATCHED", "updatedAt": "2026-08-19T09:04:31.000Z",
  "driver": { "name": "Ahmad Khalil", "phoneNumber": "+962770000001", "rating": 4.85 },
  "deliveryCode": "6532" }
```

Render: driver card (name, ★, call button) + "Driver is on the way to
collect". **Cash reminder: the sender pays the `deliveryFee` in cash at
pickup.** The receiver gets their WhatsApp message with the anonymous
tracking link (`/track/{token}`) as the flow advances — nothing for the
sender to do.

### 3. `PICKED_UP` — parcel collected (cash paid)

Push `package_picked_up` (`payload.packageId`).

```json
{ "id": 15, "status": "PICKED_UP", "updatedAt": "2026-08-19T09:20:05.000Z",
  "driver": { "…": "…" }, "deliveryCode": "6532" }
```

Render: timeline step 2 done; delivery code becomes the hero element
("your receiver needs this code").

### 4. `IN_TRANSIT` — on the road

Same shape, `status: "IN_TRANSIT"`. Render: timeline step 3 active,
destination city, receiver row with call button.

### 5. `DELIVERED` — handed off against the code

Pushes `package_delivered` + the optional rating nudge `rate_your_trip`
with `payload.packageId` (no `tripRequestId` → route to the **package**
rate sheet).

```json
{ "id": 15, "status": "DELIVERED", "updatedAt": "2026-08-19T10:02:18.000Z",
  "driver": { "…": "…" }, "deliveryCode": "6532" }
```

Render: success state, then the 5-level rating sheet →
`POST /packages/{id}/rate` `{ "level": "excellent", "message": "…" }`
(read back `GET /packages/{id}/rating`; optional; `bad` requires message;
409 = already rated).

### 6. `CANCELLED` — terminal

Push `package_cancelled` with `payload.reason`:

| `reason` | Copy | CTA |
|---|---|---|
| `not_collected` | driver couldn't collect at pickup | rebook |
| `delivery_failed` | receiver unreachable / refused | contact support |
| `driver_cancelled` | carrying trip cancelled — reassigning | none (stay on screen) |
| `admin_cancelled` | Sarfees cancelled the trip | rebook / support |

```json
{ "id": 15, "status": "CANCELLED", "updatedAt": "2026-08-19T09:10:00.000Z",
  "driver": null, "deliveryCode": "6532" }
```

`driver` is `null` when cancelled while `PENDING`, else the last assigned
driver.

## Resume rule

`GET /trips/active` returning `tripType: "sendPackage"` → open this
screen with the embedded `package` object, then start polling
`GET /packages/{id}/status`.
