# Packages — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: every response is `{ "code", "message", "data" }` · i18n errors via `Accept-Language: en|ar`

A package delivery is a **separate resource from a passenger trip**. It is
created by `POST /packages/request`, lives in its own table, and has its own
endpoints. Calling any `/trips/...` endpoint with a package id returns
**404** — that family only serves passenger trip requests.

| I have a… | Poll with |
|---|---|
| Passenger trip (`POST /trips/request`) | `GET /trips/{id}/status` |
| Package (`POST /packages/request`) | `GET /packages/{id}/status` |

All sender endpoints use the customer JWT (`Authorization: Bearer <accessToken>`).

## 1. Endpoint map (sender)

| Method + path | Purpose |
|---|---|
| `GET /packages/prohibited-items` | Bilingual list to show before booking |
| `POST /packages/estimate` | Fee quote from size + route |
| `POST /packages/request` | Book (multipart — supports `packagePhoto`) |
| `GET /packages/my-packages` | Full history |
| `GET /packages/active` | Only in-flight packages |
| `GET /packages/{id}` | Full details of one package |
| `GET /packages/{id}/status` | **Lightweight status poll (below)** |
| `POST /packages/{id}/cancel` | Sender cancel (pre-pickup) |

The **receiver** needs no account and none of these: they get a WhatsApp
message with an anonymous tracking link `GET /track/{token}` (status
timeline only, no map, no login).

## 2. `GET /packages/{id}/status`

Sender-scoped. `404` when the id doesn't exist **or** belongs to another
sender (no distinction, deliberately). `401` without a valid token.

Response `data` shape:

| Field | Type | Meaning |
|---|---|---|
| `id` | number | Package id |
| `status` | enum | See lifecycle below |
| `updatedAt` | ISO 8601 | Last change to the package record |
| `driver` | object \| null | `null` until matched; then `{ name, phoneNumber (E.164), rating }` |
| `deliveryCode` | string | 4-digit handoff code, minted at booking. The receiver quotes it to the driver at delivery — show it to the sender so they can pass it on |

### Lifecycle

`PENDING → MATCHED → PICKED_UP → IN_TRANSIT → DELIVERED`, or `CANCELLED`
from any pre-delivery state.

### Example per status

`PENDING` — booked, matcher searching. No driver yet:

```json
{ "id": 15, "status": "PENDING", "updatedAt": "2026-08-19T09:00:12.000Z",
  "driver": null, "deliveryCode": "6532" }
```

`MATCHED` — a driver accepted the trip carrying this package:

```json
{ "id": 15, "status": "MATCHED", "updatedAt": "2026-08-19T09:04:31.000Z",
  "driver": { "name": "Ahmad Khalil", "phoneNumber": "+962770000001", "rating": 4.85 },
  "deliveryCode": "6532" }
```

`PICKED_UP` — driver collected the parcel from the sender:

```json
{ "id": 15, "status": "PICKED_UP", "updatedAt": "2026-08-19T09:20:05.000Z",
  "driver": { "name": "Ahmad Khalil", "phoneNumber": "+962770000001", "rating": 4.85 },
  "deliveryCode": "6532" }
```

`IN_TRANSIT` — on the road toward the destination city:

```json
{ "id": 15, "status": "IN_TRANSIT", "updatedAt": "2026-08-19T09:25:44.000Z",
  "driver": { "name": "Ahmad Khalil", "phoneNumber": "+962770000001", "rating": 4.85 },
  "deliveryCode": "6532" }
```

`DELIVERED` — receiver quoted the code, driver confirmed handoff. Terminal:

```json
{ "id": 15, "status": "DELIVERED", "updatedAt": "2026-08-19T10:02:18.000Z",
  "driver": { "name": "Ahmad Khalil", "phoneNumber": "+962770000001", "rating": 4.85 },
  "deliveryCode": "6532" }
```

`CANCELLED` — terminal. `driver` is `null` if cancelled while `PENDING`,
or the last assigned driver otherwise:

```json
{ "id": 15, "status": "CANCELLED", "updatedAt": "2026-08-19T09:10:00.000Z",
  "driver": null, "deliveryCode": "6532" }
```

### Suggested UI mapping

| Status | Screen state |
|---|---|
| `PENDING` | "Finding a driver…" |
| `MATCHED` | "Driver on the way to collect" — driver card + call button |
| `PICKED_UP` / `IN_TRANSIT` | "On its way" — show `deliveryCode` prominently so the sender forwards it to the receiver |
| `DELIVERED` | Done state |
| `CANCELLED` | Rebook prompt (see push `reason` below) |

## 3. Push notifications & deep links

Every `package_*` push carries **`packageId`** — that is the deep-link key.
`payload` is a JSON **string**: parse it, open the package screen, hydrate
from `GET /packages/{packageId}/status`. `tripId`/`stopId` are driver-side
references — keep for support tickets, never for navigation.

```json
{ "type": "package_picked_up",
  "payload": "{\"packageId\":14,\"tripId\":98,\"stopId\":301}" }
```

```json
{ "type": "package_delivered",
  "payload": "{\"packageId\":14,\"tripId\":98,\"stopId\":304}" }
```

`package_cancelled` adds a `reason`:

```json
{ "type": "package_cancelled",
  "payload": "{\"packageId\":14,\"tripId\":98,\"reason\":\"driver_cancelled\"}" }
```

| `reason` | Meaning | Suggested CTA |
|---|---|---|
| `not_collected` | driver couldn't collect at pickup | rebook |
| `delivery_failed` | receiver unreachable / refused | contact support |
| `driver_cancelled` | carrying trip cancelled — will be auto-reassigned | none |
| `admin_cancelled` | ops cancelled the carrying trip | rebook / support |

**Universal routing rule** (same as NOTIFICATIONS_API.md §4.1):
`payload.tripRequestId` present → trip screens; `payload.packageId`
present → package screen. Unknown `type` → open the notification list.

## 4. The delivery code

- Minted at booking (present from `PENDING` onward), 4 digits.
- The driver must enter the matching code at the delivery stop —
  a wrong code blocks the handoff confirmation.
- Sender flow: app shows the code → sender shares it with the receiver
  (the receiver's WhatsApp tracking message includes their link, and the
  handoff still requires the code).

## 5. Rating a delivery

Same 5-level system as trips (see RATINGS_API.md). Only after
`DELIVERED`; optional; one rating per package per side; `bad` requires
a `message`; 409 on repeat.

- Sender rates the driver: `POST /packages/{id}/rate`
  `{ "level": "excellent", "message": "..." }` — read back with
  `GET /packages/{id}/rating` (null until rated).
- On delivery the sender also receives a `rate_your_trip` push whose
  payload carries `packageId` (no `tripRequestId`) — route it to the
  package rate sheet.
- Driver side: the post-trip ratables list
  (`GET /drivers/trips/{tripId}/ratables`) now includes senders as
  `{ "kind": "sender", "packageDeliveryId": … }` entries — rate them
  with `POST /drivers/trips/{tripId}/rate-package`
  `{ "packageDeliveryId": 14, "level": "good" }`.
