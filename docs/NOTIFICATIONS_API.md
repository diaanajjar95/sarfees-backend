# Notifications & Push — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: `{ "code", "message", "data" }`
Firebase project: **`sarfees-f333f`** (config files from Diaa / the console).
Companion Postman collection: `docs/postman/Sarfees-Device-Push.postman_collection.json`.

## Architecture in one paragraph

Every server event writes an **in-app notification** (the lists below) and
simultaneously fires an **FCM push** to all of that person's registered
devices. The apps therefore integrate twice: (1) register the FCM device
token so pushes arrive, (2) render the in-app notification list. Package
**receivers** (not app users) are reached over WhatsApp with an anonymous
tracking link — nothing to build in the apps for them.

## 1. FCM setup (one-time)

1. Embed `google-services.json` (Android) / `GoogleService-Info.plist`
   (iOS) from project `sarfees-f333f`.
2. On login **and** in the FCM token-refresh callback:
   - Passenger app → `POST /users/device-token`
   - Driver app → `POST /drivers/device-token`

   ```json
   { "token": "<FCM token>", "platform": "android" }
   ```
   Real response: `{ "registered": true, "pushEnabled": true }`.
   `pushEnabled: false` means the server has no Firebase credentials
   (dev environments) — not an app error.
3. On logout: `DELETE` the same endpoint with `{ "token": … }` so the
   device stops receiving the old account's pushes.

Registration auto-subscribes the device to its platform topic
(`all_customers` / `all_drivers`) — ops broadcasts land with no extra work.
Re-POSTing a token is always safe; it re-homes to the current account.

## 2. Push payload → deep links

Pushes carry a display `notification` (title/body — Arabic by default for
passengers, the driver's own language for drivers) plus a `data` map:

```json
{ "type": "trip_assigned", "payload": "{\"tripRequestId\":77,\"tripId\":93}" }
```

`payload` is a **JSON string** — parse it, then route by `type` using the
tables below. Handle unknown types gracefully (open the notification list).

## 3. In-app notification lists

Both apps have the same contract:

| App | List | Mark read |
|---|---|---|
| Passenger | `GET /users/notifications?filter=all|trips|packages|system&page&limit` | `POST /users/notifications/mark-read` `{ "ids": [..] }` |
| Driver | `GET /drivers/notifications?filter=all|trips|earnings|system&page&limit` | `POST /drivers/notifications/mark-read` `{ "ids": [..] }` |

Passenger rows carry bilingual copy (`titleEn/titleAr/bodyEn/bodyAr`) —
pick by app language. Driver rows carry a single `title`/`body`.

## 4. Passenger notification types

| `type` | When | Deep link (payload keys) |
|---|---|---|
| `trip_frozen` | T-30: group locked, driver search started | trip screen (`tripRequestId`) |
| `request_matched` / `trip_assigned` | a driver accepted | trip screen — driver card |
| `women_only_male_driver_fallback` | male driver assigned to a women-only trip (free cancel) | trip screen with the fallback sheet |
| `driver_en_route` | driver started the trip | live trip |
| `driver_arrived` | driver at this passenger's pickup | live trip |
| `trip_started` | this passenger picked up | live trip |
| `trip_completed` | dropped off | trip summary |
| `trip_cancelled` | any cancellation (driver no-show marking included) | trip history |
| `trip_delay_escalation` | nobody accepted by departure — ops working on it | trip screen |
| `rate_your_trip` | trip completed — optional rating nudge | rating screen (`tripRequestId`) |
| `package_picked_up` | sender: parcel collected (cash paid) | package detail (`packageId`) |
| `package_delivered` | sender: delivered against the code | package detail (`packageId`) |
| `package_cancelled` | sender: refused / not found / cancelled | package detail (`packageId`) |
| `system_announcement` | ops broadcast | notification list |

### 4.1 Package payload examples

Every `package_*` push carries `packageId` — that is the deep-link key.
Open the app's package screen and hydrate it from
`GET /packages/{packageId}/status` (or `GET /packages/{packageId}` for
full details). `tripId`/`stopId` are the driver-side references — useful
for support tickets, not for navigation.

```json
{ "type": "package_picked_up",
  "payload": "{\"packageId\":14,\"tripId\":98,\"stopId\":301}" }
```

```json
{ "type": "package_delivered",
  "payload": "{\"packageId\":14,\"tripId\":98,\"stopId\":304}" }
```

`package_cancelled` adds a `reason` telling the app which copy to show:

```json
{ "type": "package_cancelled",
  "payload": "{\"packageId\":14,\"tripId\":98,\"reason\":\"driver_cancelled\"}" }
```

| `reason` | Meaning | Suggested CTA |
|---|---|---|
| `not_collected` | driver couldn't collect at pickup | rebook |
| `delivery_failed` | receiver unreachable / refused | contact support |
| `driver_cancelled` | driver cancelled the carrying trip — will be reassigned | none (auto-reassign) |
| `admin_cancelled` | ops cancelled the carrying trip | rebook / support |

Deep-link routing rule for the passenger app: `payload.tripRequestId`
present → trip screens; `payload.packageId` present → package screen.

## 5. Driver notification types

| `type` | When | Deep link |
|---|---|---|
| `offer_received` | cascade/broadcast offer — **30 s countdown** | offer screen (`tripId`) — treat as urgent |
| `offer_no_longer_available` | lost a broadcast race | dismiss offer screen |
| `trip_assigned` | accept confirmed | trip manifest |
| `trip_reminder` / `trip_updated` / `passenger_cancelled` | composition/time changes | trip manifest |
| `earnings_recorded` | trip completed (net earnings) **and wallet top-ups/credits** | earnings / wallet screen |
| `wallet_low_balance` | balance under threshold or missed a trip for wallet reasons (≤ 1/24 h) | wallet screen (see WALLET_API.md) |
| `outstanding_balance` | legacy debt reminders (rare) | earnings |
| `system_announcement` | ops broadcast | notification list |

## 6. Topics & broadcasts

`all_customers` and `all_drivers` are auto-subscribed at registration.
Ops sends broadcasts from the portal — they arrive as normal pushes with
no `data.type` routing needed (show as-is). Custom topics may appear
later; the apps can subscribe to them client-side by name via the FCM SDK.

## 7. Package receivers (FYI — no app work)

Receivers get WhatsApp messages at assigned / picked-up / delivered with
an anonymous link `http://169.58.67.105/track/<token>` — a bilingual
status timeline (no map, no login). The sender app may also want to show
this link for sharing: it is NOT currently returned by the package
endpoints — ask the backend team if you want it exposed to senders.

## 8. Testing

Use the **Sarfees-Device-Push** Postman collection: register your real
device token, then fire the self-test broadcast — the phone should buzz
within seconds. For event pushes, run any trip flow from the other
collections; every stage that appears in the in-app list also pushes.
