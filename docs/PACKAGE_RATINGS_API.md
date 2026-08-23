# Package Ratings — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: every response is `{ "code", "message", "data" }` — examples show real captured responses. · i18n errors via `Accept-Language: en|ar`

After a delivery both sides can rate each other — **sender rates the
driver, driver rates the sender** — with the same 5-level system used
for trips. **Rating is always optional** — never block a screen on it.

## The 5 levels (shared with trips)

| API value | Numeric | English | Arabic |
|---|---|---|---|
| `excellent` | 5 | Excellent | ممتاز |
| `very_good` | 4 | Very good | جيد جداً |
| `good` | 3 | Good | جيد |
| `not_bad` | 2 | Not bad | لا بأس |
| `bad` | 1 | Bad | سيئ |

Rules for **both** directions:

- Only after the package is `DELIVERED` (400 before that).
- One rating per package per side — repeat attempts return **409**;
  treat as "already rated" and show the stored rating.
- `message` optional (≤ 500 chars) — **REQUIRED when level is `bad`**
  (400 otherwise). Make the text field mandatory in the UI when the
  lowest level is picked.
- Ratings feed the same aggregates as trips: the driver's ★ average and
  the customer's rating both move.

## Sender app (customer JWT)

### When to prompt

On delivery the sender receives **two** pushes: `package_delivered` and
the rating nudge:

```json
{ "type": "rate_your_trip",
  "payload": "{\"packageId\":14,\"tripId\":98}" }
```

`payload.packageId` present (no `tripRequestId`) → route to the
**package** rate sheet, not the trip one.

### Submit — `POST /packages/{id}/rate`

```json
{ "level": "excellent", "message": "Fast delivery, thank you" }
```

Real response (201):

```json
{ "code": 201, "message": "Success",
  "data": { "id": 6, "level": "excellent", "value": 5 } }
```

Errors: 400 not delivered yet / `bad` without message · 404 not the
sender's package · **409 already rated**.

### Read back — `GET /packages/{id}/rating`

Real response — use it to decide whether to show the sheet or the
already-given rating (`data: null` = not rated yet, show the sheet):

```json
{ "code": 200, "message": "Success",
  "data": {
    "level": "excellent",
    "value": 5,
    "comment": "Fast delivery, thank you",
    "createdAt": "2026-08-21T14:37:12.055Z"
  } }
```

## Driver app (driver JWT)

### Who can be rated — `GET /drivers/trips/{tripId}/ratables`

After completing the trip, the ratables list mixes passengers and
package senders. Real response from a package-carrying trip:

```json
{ "code": 200, "message": "Success",
  "data": [
    { "kind": "sender",
      "passengerId": 12,
      "packageDeliveryId": 14,
      "name": "Dia'a Najjar",
      "alreadyRated": false }
  ] }
```

| Field | Notes |
|---|---|
| `kind` | `"passenger"` → rate via `POST /drivers/trips/{tripId}/rate` with `passengerId`. `"sender"` → use the endpoint below with `packageDeliveryId`. |
| `packageDeliveryId` | Non-null only for `kind: "sender"` rows |
| `alreadyRated` | Hide/disable the row when true |

Only **delivered** packages produce sender rows — not-found / refused /
failed packages don't appear.

### Submit — `POST /drivers/trips/{tripId}/rate-package`

```json
{ "packageDeliveryId": 14, "level": "very_good" }
```

Real response (201):

```json
{ "code": 201, "message": "Success",
  "data": { "id": 7, "level": "very_good", "value": 4 } }
```

Errors: 400 trip not completed / `bad` without message · 404 package
not on this trip or not delivered · **409 already rated**.

## Verified live example (end to end)

Captured on the test server: sender rated the driver `excellent` →
driver's aggregate went 4.85 (133) → 4.85 (134); driver rated the
sender `very_good` → sender's rating went 3.00 (1) → 3.50 (2). Both
sides then received 409 on repeat attempts.

## Quick reference

| Actor | Action | Endpoint |
|---|---|---|
| Sender | rate driver | `POST /packages/{id}/rate` |
| Sender | read own rating | `GET /packages/{id}/rating` |
| Driver | list ratables | `GET /drivers/trips/{tripId}/ratables` |
| Driver | rate sender | `POST /drivers/trips/{tripId}/rate-package` |
