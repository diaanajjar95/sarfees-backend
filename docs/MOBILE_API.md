# Sarfees Mobile API — quick reference

One-line-per-endpoint handoff for the mobile apps. Interactive docs with
full request/response schemas: `http://<host>/api` (Swagger).

**Base URL (staging):** `http://169.58.67.105`

**Envelope:** every response is wrapped as
`{ "code": 200, "message": "Success", "data": { … } }` — read `data`.

**Auth:** JWT `Authorization: Bearer <accessToken>`. Passenger and driver
tokens are separate systems — never mix them. When the access token
expires (401), call the matching `refresh` endpoint with the refresh
token, then retry.

**OTP (staging):** SMS is mocked — the code is always `1234`.

**Localization:** send `Accept-Language: en` or `ar`; localized fields
(city names, FAQ, notifications) follow it.

---

## Shared / bootstrap

| Method | Path | Description |
|---|---|---|
| GET | `/app/init` | Call on every cold start. Returns min/latest app version per platform, store URLs, maintenance flag, support contacts, legal URLs. Gate the app on this. |
| GET | `/app/force-update` | Lightweight version gate only — returns whether the installed version must update before continuing. |
| GET | `/cities` | Supported cities (id + localized name). Use the ids in trip/package requests. Cache per session. |
| GET | `/faq` | Localized help-center entries grouped by category. |

## Passenger — auth & profile

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Body `{ phoneNumber, countryCode }`. Sends the OTP (mock `1234`). Also used to re-login existing users. |
| POST | `/auth/verify-otp` | Body `{ phoneNumber, countryCode, otp }`. Returns `accessToken`, `refreshToken`, user object + `isProfileCompleted` (route to profile setup when false). |
| POST | `/auth/refresh` | Body `{ refreshToken }`. New token pair when the access token expires. |
| POST | `/auth/logout` | Invalidates the refresh token server-side. Clear local tokens regardless of result. |
| GET | `/users/me` | Current passenger profile. |
| PATCH | `/users/profile` | Complete/update profile: first/last name, gender, email. Gender matters — women-only trips require `Female`. |

## Passenger — trips

| Method | Path | Description |
|---|---|---|
| POST | `/trips/estimate` | Fare preview before booking. Same body as `request`; returns per-seat fare, total, duration, cancellation policy. No side effects. |
| POST | `/trips/request` | Book a trip. Body: `departureCityId`, `arrivalCityId`, `departureLocation`/`arrivalLocation` `{lat,lng}`, `seatsCount`, and either `isImmediate: true` ("now" — departs in ~15–30 min) or `travelDate` (ISO, scheduled — **must land on a quarter-hour :00/:15/:30/:45 and be ≥ 30 min, ≤ 30 days from now**, else 400; the picker should only offer quarter-hour steps). Optional: `isFemaleOnly`, `bookWholeCar`. Fare is a flat **5 JD per seat**. The matcher groups compatible passengers automatically; a driver is assigned ~30 min before departure. Status flow: `PENDING → MATCHED → TRIP_IN_PROGRESS → COMPLETED`. |
| GET | `/trips/my-trips` | Paginated trip history for the My Trips screen. |
| GET | `/trips/active` | Home-screen card: the user's most recent active trip **or** package, wrapped as `{ type, trip, package }`. Poll while the app is foregrounded. |
| GET | `/trips/{id}/status` | Live status of one request: current state, assigned driver (name, vehicle, plate, rating) and driver's last known location. Poll on the tracking screen. |
| GET | `/trips/{id}/driver-location` | Latest driver GPS point only — cheaper than `/status` for map-pin animation. |
| PATCH | `/trips/{id}/status` | Passenger-side transitions — in practice: cancel, with body `{ "status": "CANCELLED" }`. Free before a driver is assigned; fees may apply after. |

## Passenger — packages

| Method | Path | Description |
|---|---|---|
| POST | `/packages/estimate` | Delivery fee preview (size, urgent flag, corridor). No side effects. |
| POST | `/packages/request` | Create a delivery: cities, pickup/dropoff points, size, receiver name + phone, optional `urgent` (premium, immediate driver search). Rides the same matching engine as trips. |
| GET | `/packages/my-packages` | Paginated delivery history. |
| GET | `/packages/active` | Current in-flight delivery, if any. |
| GET | `/packages/{id}` | Full detail of one delivery incl. status timeline. |

## Passenger — notifications

| Method | Path | Description |
|---|---|---|
| GET | `/users/notifications` | Paginated notification feed (trip assigned, trip cancelled, delays…). `unreadCount` included. |
| POST | `/users/notifications/mark-read` | Body `{ ids: [...] }` or empty for mark-all. |

---

## Driver — auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/driver/request-otp` | Body `{ phoneNumber, countryCode }`. Driver must already exist (created by ops) — unknown numbers are rejected. |
| POST | `/auth/driver/verify-otp` | Body + `otp`. Returns driver token pair + profile. |
| POST | `/auth/driver/refresh` | Body `{ refreshToken }` → new pair. |

## Driver — profile & session

| Method | Path | Description |
|---|---|---|
| GET | `/drivers/profile` | Driver + vehicle profile. |
| GET | `/drivers/home-summary` | **The home screen in one call.** Shape depends on `status` (inactive / active / on_trip / suspended): session prefs, current trip card, `pendingOffer` (with countdown — deep-link to the offer screen when non-null), last session recap, suspension details. Poll every ~15–30 s while active. |
| POST | `/drivers/activate` | Go online. Body: `tripTypes` (`shared`/`women_only`/`packages_only`/`mixed`), `goingHome`, optional `destinationCity`, `minPassengers`, `currentLocationLat/Lng`. Drives matching eligibility. |
| POST | `/drivers/deactivate` | Go offline; clears session prefs. No body. Blocked while on a trip. |
| PATCH | `/drivers/preferences` | Edit the active session's prefs without going offline. |
| PATCH | `/drivers/settings` | Notification toggles + app language. |
| PUT | `/drivers/me/fcm-token` | Register the device's FCM token right after login — offers arrive as push. |
| POST | `/drivers/me/location` | GPS ping `{ lat, lng, heading?, speed? }`. Send every ~10 s while online — **the matcher ranks drivers by this position**, and passengers see it during trips. |
| GET | `/drivers/earnings` | Earnings dashboard: today / week / month totals + per-trip list. |
| GET | `/drivers/earnings/{tripId}/breakdown` | Line-item math for one trip: cash collected, commission, net. |
| POST | `/drivers/me/documents` | Upload a document (license, registration…) as multipart. |
| GET | `/drivers/me/documents` | List uploaded documents + review status. |
| GET | `/drivers/me/documents/{id}` | One document's detail/status. |

## Driver — trips (offer → finish)

Screen refs (S-07…S-14) match the design file. Typical order: offer push →
`offer` → `accept` → `manifest` → `start` → per stop: `arrive` →
`confirm-pickup`/`confirm-dropoff` → `complete`.

| Method | Path | Description |
|---|---|---|
| GET | `/drivers/trips/active` | The trip in progress, if any — call on app reopen to resume into the right screen. |
| GET | `/drivers/trips/history` | Past trips list (My Trips). |
| GET | `/drivers/trips/{id}/offer` | Offer details for S-07: passenger/package counts, pickup area, destination, departure, **estimated earnings**, `secondsRemaining`. Offers auto-expire in ~30 s. |
| POST | `/drivers/trips/{id}/accept` | Accept the offer. Returns the full manifest so S-09 renders immediately. First accept wins; late accept → 400 "no longer available". |
| POST | `/drivers/trips/{id}/decline` | Decline with optional reason. Frequent declines lower future ranking. |
| GET | `/drivers/trips/{id}/manifest` | Full pre-trip manifest: ordered stops, passengers (masked phones), packages, cash expected per stop. |
| POST | `/drivers/trips/{id}/start` | Begin the trip (S-09 → S-10). Only from `accepted`. |
| GET | `/drivers/trips/{id}/active-state` | Current + next stop, progress counters — the in-trip screen's source of truth. Re-fetch after every stop action. |
| POST | `/drivers/trips/{id}/stops/{stopId}/arrive` | Mark arrival at the current stop; passengers at that stop get notified. |
| POST | `/drivers/trips/{id}/stops/{stopId}/confirm-pickup` | Body `{ passengersPickedUp: [stopPassengerRowIds], noShows: [], packagesCollected: [], packagesNotFound: [] }` — ids come from the manifest/active-state. |
| POST | `/drivers/trips/{id}/stops/{stopId}/confirm-dropoff` | Body `{ passengersDroppedOff: [{ id, cashCollected }], packagesDelivered: [], deliveryFailures: [] }`. Records the cash per passenger. |
| POST | `/drivers/trips/{id}/complete` | Finalize after the last stop. Returns the earnings breakdown (cash, commission, net) for the S-13 screen. Also releases the driver for new offers. |
| POST | `/drivers/trips/{id}/cancel` | Cancel an accepted/started trip with reason. Zone rules: before start = no penalty; after start (no pickups yet) = soft penalty + auto-offline; **blocked entirely once a passenger is picked up**. |

## Driver — notifications

| Method | Path | Description |
|---|---|---|
| GET | `/drivers/notifications` | Notification feed (offers, earnings, announcements) + `unreadCount`. |
| POST | `/drivers/notifications/mark-read` | Body `{ ids: [...] }` or empty for mark-all. |

---

## Gotchas worth telling the app team

- **Offer window is 30 seconds.** Push arrives → fetch `offer` → show
  countdown from `secondsRemaining` → accept/decline fast. Expired
  offers cascade to the next driver.
- **Location pings are not cosmetic.** A driver who stops pinging (or
  pings from another city) silently drops out of matching for trips
  from where they "were".
- **`stopPassengerRowIds` are per-stop.** The same passenger has a
  different row id at their pickup stop and their dropoff stop — always
  use the ids from the manifest/active-state of *that* stop.
- **After `complete` the driver goes `inactive`** and must activate
  again for the next session (spec behavior, not a bug).
- **Women-only trips**: `isFemaleOnly` requests are only accepted from
  `Female` profiles; male drivers may only receive them as a last-resort
  broadcast fallback, and passengers are notified + may cancel free.
