# Sarfees — API test cases (backend side)

Base URL: `http://169.58.67.105` · Envelope: `{ "code", "message", "data" }` · Every case: fill **Result** with ✅ / ❌ + notes.

**Fixtures**: drivers `+962 770000001–5` (2 = Omar, 5 = Rania — female), passengers `+962 790000001–10` (even = female), OTP always `1234` (single-use — request a fresh one before every verify). Admin + seller portal credentials as distributed to the team. Wallet cards are generated in suite F.

**Reset between suites**: admin `POST /admin/trips/{id}/cancel` on any open trip, and cancel leftover requests — verify with `GET /admin/drivers/live/overview` → `kpis` all zero except online drivers.

**Execution order**: A → B → C (core happy path) first; the rest in any order. Suites C/D/E create real money movements — note wallet balances before starting.

---

## Suite A — Auth

| ID | Case | Steps | Expected |
|---|---|---|---|
| A1 | Passenger OTP login | `POST /auth/login` {countryCode,+9627900000 01} → `POST /auth/verify-otp` otp 1234 | 201 then 200 with accessToken |
| A2 | OTP single-use | Repeat verify with same OTP | 401 Invalid OTP |
| A3 | Driver OTP login | `POST /auth/driver/request-otp` → `verify-otp` | tokens returned |
| A4 | Admin login | `POST /admin/auth/login` | 200, role in response |
| A5 | Wrong admin password | same, bad password | 401 |
| A6 | Seller forced password change | Create seller via `POST /admin/admins` (tempPassword) → login as seller | login OK + `mustChangePassword: true`; change-password with same password → 400; with new → 200 |
| A7 | Role gate | Seller token → `GET /admin/wallet-config` | 403 |

## Suite B — Driver session & preferences

| ID | Case | Steps | Expected |
|---|---|---|---|
| B1 | Preferences (male) | driver 770000001 → `GET /drivers/preferences` | cities incl. "Any Destination" (ar+en); tripTypes WITHOUT `women_only`; minPassengers null/1/2/3; goingHome block |
| B2 | Preferences (female) | driver 770000005 → same | tripTypes INCLUDES `women_only` |
| B3 | Activate with GPS | `POST /drivers/activate` {tripTypes:["mixed"], goingHome:false, currentLocationLat/Lng inside Amman} | 201; home-summary status `active`, activePreferences filled |
| B4 | Activate w/o tripTypes | omit tripTypes | 400 |
| B5 | Location ping | `POST /drivers/me/location` {lat,lng,heading,speed} | 200; `GET /admin/drivers/live/overview` shows fresh `lastPingAt` |
| B6 | Deactivate | `POST /drivers/deactivate` | status `inactive`, prefs cleared, home-summary `lastSession` |
| B7 | No-location invisibility | Activate WITHOUT lat/lng, book a matching trip (C1) | driver receives NO offer; group escalates (`no_location_snapshot` in api logs) |

## Suite C — Shared trip end-to-end (the core chain)

Precondition: driver 770000001 active with GPS inside origin city; wallet balance ≥ expected commission (top up via suite F if needed).

| ID | Case | Steps | Expected |
|---|---|---|---|
| C1 | Book "now" trip | passenger 790000001 `POST /trips/estimate` then `/trips/request` (isImmediate) | 201; request PENDING; `pickupDate`≈now+20 min |
| C2 | Scheduled-time rules | request with departure 10 min ahead / off 15-min grid / 31 days out | 400 ×3 with clear messages |
| C3 | Offer emitted once | after C1 matching fires | driver notification list has exactly ONE `offer_received` (no `trip_assigned`); payload has driverTripId+tripGroupId |
| C4 | Offer sheet | `GET /drivers/trips/{id}/offer` | counts, cash, `requiredWalletCommission`, `offerExpiresAt` |
| C5 | Accept | `POST .../accept` | driver status flips to `on_trip` immediately; passenger request → MATCHED; passenger status shows driver card WITH `phoneNumber` |
| C6 | Busy driver skipped | while C5 accepted, book a 2nd trip | driver 1 gets NO new offer (only other active drivers) |
| C7 | Home summary carries trip | `GET /drivers/home-summary` | `status: on_trip`, `currentTrip.status: accepted` |
| C8 | Start | `POST .../start` | manifest returned; passenger status `DRIVER_EN_ROUTE`; push `driver_en_route` |
| C9 | Stop loop | arrive → confirm-pickup {passengersPickedUp} → arrive dropoff → confirm-dropoff {cashCollected:true} | passenger walks ARRIVED_AT_PICKUP → TRIP_IN_PROGRESS → COMPLETED; active-state advances |
| C10 | Complete + money | `POST .../complete` | summary: commission = rate × totalCashExpected; wallet debited by exactly that; ledger row type `commission`; driver back to `active` with session intact |
| C11 | Cancel before start (zone 1) | new accept → `POST .../cancel` | trip cancelled; driver back to `active`; passenger gets `trip_cancelled` with `reason: driver_cancelled`; matching restarts |
| C12 | Cancel after pickup blocked | in-progress with passenger on board → cancel | 403 |
| C13 | Admin cancel | admin `POST /admin/trips/{id}/cancel` {reason} | trip+requests cancelled; driver released to `active`; passenger reason `admin_cancelled` |
| C14 | No-show | confirm-pickup {passengersNoShow:[id]} | passenger request cancelled with `reason: no_show` notification |

## Suite D — Women-only

| ID | Case | Steps | Expected |
|---|---|---|---|
| D1 | Booking gate | male passenger books isFemaleOnly | 400/403 |
| D2 | Female priority | female passenger books women-only; Rania (5, female) + Ahmad (1, male) both active in origin | offer goes to Rania FIRST |
| D3 | Male fallback | only male drivers active → same booking | male eventually offered; on accept passenger receives `women_only_male_driver_fallback` push |
| D4 | Fallback free cancel | passenger cancels after D3 | no penalty applied |

## Suite E — Packages

| ID | Case | Steps | Expected |
|---|---|---|---|
| E1 | Prohibited + estimate | `GET /packages/prohibited-items`, `POST /packages/estimate` | bilingual list; fee quote |
| E2 | Book immediate | `POST /packages/request` (multipart, photo optional) | PENDING; `deliveryCode` present; `pickupDate`≈now+20m; receiver gets tracking link (check `trackingToken` row) when flow advances |
| E3 | Scheduled rules | pickupDate 10 min ahead / off-grid / 31 days | 400 ×3 |
| E4 | Status poll | `GET /packages/{id}/status` through the E2E chain | statuses PENDING→MATCHED→PICKED_UP→IN_TRANSIT→DELIVERED; `driver` fills at MATCHED; `pickupDate`+`isImmediate` always present |
| E5 | Wrong id / other sender | other passenger token → same call | 404 both |
| E6 | Trips endpoint rejects package id | `GET /trips/{packageId}/status` | 404 (by design) |
| E7 | Delivery code wrong | driver confirm-dropoff with wrong code | 400; package NOT delivered |
| E8 | Handover photo | driver `POST /drivers/trips/{id}/handover-photo` (multipart) → confirm-dropoff with returned photoUrl + right code | 200; sender status shows `deliveredPhotoUrl` |
| E9 | Tracking page | open `/track/{token}` unauthenticated | timeline renders, no map, no PII beyond first names |
| E10 | Refusal at pickup | confirm-pickup packagesRefused {reason} | package `CANCELLED`, sender push `package_cancelled` reason `not_collected`/refusal; no driver penalty |
| E11 | Sender cancel pre-pickup | `POST /packages/{id}/cancel` | CANCELLED; post-pickup attempt → 400 |

## Suite F — Wallet

| ID | Case | Steps | Expected |
|---|---|---|---|
| F1 | Config read/update | `GET /admin/wallet-config`; PATCH commission % as super admin; as finance → | 200; finance PATCH 403 |
| F2 | Batch generation | seller `POST /admin/cards/batches` {amount, count} | codes returned ONCE, count matches; `GET /admin/cards` shows masked only |
| F3 | Seller scoping | seller B lists batches | sees only own |
| F4 | Redeem happy path | `POST /admin/cards/lookup-driver` {phone} → `/admin/cards/redeem` {code, phone} | driverName confirmed; balance +amount; ledger `card_topup`; driver gets push |
| F5 | Double redeem | same code again | 409 "already redeemed" |
| F6 | Bad phone / bad code | redeem variants | 404 each |
| F7 | Admin credit + refund | `POST /admin/wallets/{id}/credit` {kind credit/refund} | ledger rows, `balanceAfter` chain consistent |
| F8 | Wallet gate | set driver balance below next trip's commission → book matching trip | driver skipped (`insufficient_wallet_balance`), low-balance notification emitted, group escalates if no one else |
| F9 | Commission snapshot | change commission % → book new trip | NEW trip uses new rate; previously created trips keep old `commissionRate` |

## Suite G — Ratings

| ID | Case | Steps | Expected |
|---|---|---|---|
| G1 | Passenger rates driver | after C10: `POST /trips/request/{id}/rate` {excellent} | 201; driver ratingCount +1, average recomputed |
| G2 | Bad requires message | level bad without message | 400 |
| G3 | Double rate | repeat G1 | 409 |
| G4 | Driver ratables mixed | `GET /drivers/trips/{id}/ratables` after trip w/ package | `kind: passenger` + `kind: sender` rows, alreadyRated flags |
| G5 | Driver rates both | `/rate` {passengerId} + `/rate-package` {packageDeliveryId} | 201 each; user aggregates move |
| G6 | Package sender rating | `POST /packages/{id}/rate` after DELIVERED; read back `GET /packages/{id}/rating` | 201; read-back with comment; before DELIVERED → 400 |

## Suite H — Notifications & push

| ID | Case | Steps | Expected |
|---|---|---|---|
| H1 | Register device + dedupe | `POST /drivers/device-token` {token A, deviceId X} then {token B, deviceId X} | token A row deleted; exactly one row per device |
| H2 | Data-only shape | trigger any push; inspect FCM (device log or Firebase console) | NO `notification` block; `data` has type/title/body/payload |
| H3 | Offer priority | offer push | `android.priority: high` |
| H4 | In-app lists | `GET /users/notifications?filter=...`, `GET /drivers/notifications` + mark-read | filters work; bilingual fields on passenger rows |
| H5 | Topic broadcast | portal Notifications page → broadcast to a topic | delivered with `type: system_announcement`; `{sent: true}` |
| H6 | Cancel reasons | run C11/C13/C14/E10 and inspect payloads | `reason` values match the documented table |

## Suite I — Admin portal APIs

| ID | Case | Steps | Expected |
|---|---|---|---|
| I1 | Driver registration | `POST /admin/drivers` + `POST /admin/drivers/{id}/documents` (multipart ×4 types) | driver created; docs land `verified` with reviewer; `GET .../documents` summary 4/4; new driver can OTP-login |
| I2 | Replace document | re-upload same type | old row+file replaced, still one per type |
| I3 | Suspend with reason | `POST /admin/drivers/{id}/suspend` {category, reason} | driver activation blocked with 403 + suspensionInfo shows category/reason; reinstate restores |
| I4 | Customers | `GET /admin/customers?search=` + `/{id}` | search by name/phone; detail: trips, ratings both directions (trip + package labeled) |
| I5 | Manual assign | from request page deeplink → `POST /admin/trips/manual-assign` | prefill time is LOCAL (not −3h); driver gets `offer_received` (manual:true), NOT trip_assigned |
| I6 | Map overview | `GET /admin/drivers/live/overview` | drivers with lastPingAt/wallet/currentTripId; demand groups; KPIs; city circles |
| I7 | Early access | `POST /landing/early-access` (public) → `GET /admin/early-access` | row appears |

## Suite J — Platform config & init

| ID | Case | Steps | Expected |
|---|---|---|---|
| J1 | Currency public | `GET /platform/currency` | code/symbols/decimals |
| J2 | Currency switch | PATCH `/admin/platform-config` JOD→SYP→JOD (super admin) | public endpoint reflects instantly; finance PATCH → 403 |
| J3 | Init per app | `GET /app/init?app=passenger` and `?app=driver` | independent version+maintenance blocks; currency embedded; legal present |
| J4 | Maintenance isolation | PATCH `/admin/app-config/passenger` {maintenanceMode:true, messages} | passenger init `maintenance.active:true` (both messages); driver init untouched; revert after |
| J5 | Update matrix | set androidMinVersion 2.0.0, latest 2.1.0; init with currentVersion 1.0.0 / 2.0.5 / 2.1.0 | forceUpdate true / optional only / neither |
| J6 | Invalid version | PATCH androidMinVersion "abc" | 400 |
