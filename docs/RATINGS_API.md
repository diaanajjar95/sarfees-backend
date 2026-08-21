# Ratings — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: every response is `{ "code", "message", "data" }` · i18n errors via `Accept-Language: en|ar`

Passengers and drivers rate each other after a completed trip. **Rating is
always optional** — never block a screen on it.

## The 5 levels

| API value | Numeric | English | Arabic |
|---|---|---|---|
| `excellent` | 5 | Excellent | ممتاز |
| `very_good` | 4 | Very good | جيد جداً |
| `good` | 3 | Good | جيد |
| `not_bad` | 2 | Not bad | لا بأس |
| `bad` | 1 | Bad | سيئ |

Rules that apply to **both** directions:
- `message` is optional (≤ 500 chars) — **REQUIRED when level is `bad`**
  (400 with a bilingual error otherwise). Enforce in the UI too: show the
  text field as mandatory when the user picks the lowest level.
- One rating per trip per side. A second attempt returns **409** — treat as
  "already rated" and show the stored rating instead.
- Only allowed after the trip is `COMPLETED` (400 before that).

## Passenger app

### When to prompt
On trip completion the passenger receives the `rate_your_trip`
notification (push + in-app), payload:

```json
{ "tripRequestId": 77, "tripId": 93 }
```

Deep-link it to the rating screen for that trip. Also offer rating from the
trip-history detail screen.

### Submit — `POST /trips/request/{tripRequestId}/rate`

```json
{ "level": "excellent", "message": "Great driver, smooth trip" }
```

201 response (real):
```json
{ "code": 201, "message": "Success", "data": { "id": 1, "level": "excellent", "value": 5 } }
```

### Read own rating — `GET /trips/request/{tripRequestId}/rating`

Returns `null` in `data` when not rated yet. Real response:
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "level": "bad",
    "value": 1,
    "comment": "Driver was speeding the whole way",
    "createdAt": "2026-08-15T20:47:54.705Z"
  }
}
```

⚠️ The written text comes back as **`comment`** (not `message`) — the
response envelope reserves the `message` key.

## Driver app

Prompt after the driver closes the trip (the completion screen is the
natural place — no notification is sent to the driver).

### Who can I rate — `GET /drivers/trips/{tripId}/ratables`

```json
{
  "code": 200,
  "message": "Success",
  "data": [ { "passengerId": 2, "name": "Lina Abbadi", "alreadyRated": false } ]
}
```

Render one row per passenger; hide or check-mark rows with
`alreadyRated: true`.

### Submit — `POST /drivers/trips/{tripId}/rate`

```json
{ "passengerId": 2, "level": "very_good", "message": "On time, friendly" }
```

201 → same shape as the passenger submit. 404 if that passenger wasn't
served on this trip.

## Averages (display)

- Driver aggregate: `rating` + `ratingCount` on the driver profile and
  home-summary — updates instantly when a passenger rates.
- Passenger aggregate: `rating` + `ratingCount` on the user — drivers can
  see who they're picking up.
- A person's **first** real rating replaces the 5.0 display default
  (it is not averaged against it). `ratingCount: 0` = "New" — consider
  showing "New" instead of ★5.0.

## Error map

| HTTP | Meaning | UI action |
|---|---|---|
| 400 | bad without message / trip not completed | Show field error / disable until completed |
| 403 | not your trip request | shouldn't happen with correct ids |
| 404 | unknown trip / passenger not on trip | refresh state |
| 409 | already rated | fetch + display the existing rating |
