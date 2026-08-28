# Sarfees — mobile test cases (device side)

Run on a **physical Android device** (and iOS when available) against the test server. Each case: fill **Result** ✅ / ❌ + device + app version.

**Fixtures**: drivers `+962 770000001–5` (5 = Rania, female), passengers `+962 790000001–10` (even = female), OTP `1234`. Coordinate with whoever runs the API suite — several cases need a counterpart action (a booking, a portal change).

**Golden rules being verified throughout**: every push is **data-only** (the app renders all notifications itself); deep-link routing is `payload.tripRequestId` → trip screens, `payload.packageId` → package screen, driver `offer_received` → offer overlay.

---

## Suite M-A — Launch & init

| ID | Case | Steps | Expected |
|---|---|---|---|
| MA1 | Cold start init | Launch app fresh | one `GET /app/init?app=<correct app>&platform&currentVersion` call; home renders |
| MA2 | Maintenance (own app) | Ops flips YOUR app's maintenance on (portal App settings) → foreground the app | full-screen maintenance state with the Arabic/English message per app language; app unusable; flips back off on next foreground after ops reverts |
| MA3 | Maintenance isolation | Ops flips the OTHER app's maintenance | your app unaffected |
| MA4 | Force update | Ops raises your platform minVersion above installed | blocking update screen, store button, no skip |
| MA5 | Optional update | latestVersion above installed, minVersion below | dismissible nudge; app usable |
| MA6 | Currency rendering | Ops switches platform currency JOD⇄SYP | ALL amounts app-wide re-render with new symbol; SYP shows whole numbers (0 decimals); nothing shows hardcoded "JD" |
| MA7 | Legal re-acceptance | If implemented: `legal.updatedAt` changes | prompt shown once |

## Suite M-B — Push infrastructure

| ID | Case | Steps | Expected |
|---|---|---|---|
| MB1 | deviceId registration | Fresh install → login | register call includes `token`, `platform`, **`deviceId`** |
| MB2 | No duplicates after reinstall | Reinstall app (token rotates) → login → trigger any push | exactly ONE notification |
| MB3 | Foreground handling | App open → trigger a push | in-app handling (no OS banner duplication); handler log present |
| MB4 | Background handling | App backgrounded → trigger informational push (e.g. wallet credit) | app-rendered local notification appears; tap deep-links correctly |
| MB5 | Killed handling | Swipe app away → trigger push | notification still arrives (allow OS batching delay for normal-priority types); tap cold-starts into the right screen |
| MB6 | Logout cleanup | Logout → trigger push for that account | nothing arrives (DELETE device-token was called) |

## Suite M-C — Driver app

| ID | Case | Steps | Expected |
|---|---|---|---|
| MC1 | Go-online sheet | Open go-online | options come from `GET /drivers/preferences`: bilingual cities with "Any", trip types (women-only visible ONLY on Rania's account), min passengers, going-home toggle with home city |
| MC2 | GPS requirement | Activate with location permission denied | app warns / sends location ASAP after grant — driver with no GPS gets no offers (verify with API team) |
| MC3 | Offer overlay — foreground | Active + app open; API team books a matching trip | full-screen offer within seconds: route, counts, cash, countdown ring; type in log = `offer_received` |
| MC4 | Offer overlay — background | Same with app backgrounded | handler runs (log), overlay/ringtone fires — THE critical case |
| MC5 | Offer overlay — killed | Same with app killed | same outcome |
| MC6 | Exactly one notification | Any offer | ONE notification only (no trip_assigned double) |
| MC7 | Offer taken elsewhere | Two drivers active; other driver accepts first | your overlay dismisses via `offer_no_longer_available` |
| MC8 | Manual-assign offer | Ops assigns you from the portal | identical offer overlay (payload has `manual: true`) |
| MC9 | Decline + timeout | Decline one offer; let another expire | overlay closes / auto-closes at 0; no crash |
| MC10 | Accept → upcoming trip | Accept | home shows "Upcoming trip" card (status accepted) with Start button; app status on_trip |
| MC11 | Kill between accept & start | Kill + relaunch | home summary restores the upcoming-trip card; Start still works |
| MC12 | Stop loop UI | Start → walk the stops | arrive/confirm screens follow the manifest; passenger fares requested only at THEIR dropoff; package cash at pickup |
| MC13 | Delivery code | Enter wrong code then right code at package dropoff | wrong → inline error (400); right → confirmed |
| MC14 | Handover photo | Take photo at delivery | upload → photoUrl → attached to confirm; visible later to sender |
| MC15 | Complete summary | Finish trip | earnings breakdown + wallet after commission; driver back online automatically (no re-activate needed) |
| MC16 | Rating sheet | After complete | passengers AND package senders listed; bad level forces message; second attempt shows "already rated" |
| MC17 | Wallet screen | Open wallet | balance + ledger match API; low-balance state renders when under threshold |
| MC18 | Passenger cancelled mid-wait | API team cancels the request | `passenger_cancelled` push; upcoming trip clears; driver returns to matchable |
| MC19 | Suspension UX | Ops suspends with category+reason | activation blocked; correct card (documents/rating/payment/violation) with the reason text |

## Suite M-D — Passenger app (shared trip)

| ID | Case | Steps | Expected |
|---|---|---|---|
| MD1 | Booking constraints | Time picker | 15-min steps only; blocks <30 min ahead and >30 days |
| MD2 | Searching state | Book | "Finding your driver…" + free cancel; `trip_frozen` push arrives at T-30 without breaking the screen |
| MD3 | Matched card | Driver accepts | driver card: photo, ★, vehicle+plate, **working Call button** (dials the number) |
| MD4 | Live tracking | Driver starts + moves (GPS sim) | car marker moves/rotates; ETA updates; statuses walk EN_ROUTE→ARRIVED→IN_PROGRESS→ARRIVING→COMPLETED with matching pushes |
| MD5 | Cancelled by driver | Driver cancels pre-start | `trip_cancelled` reason `driver_cancelled` → correct banner ("finding you another driver") |
| MD6 | Cancelled by ops | Admin cancels | banner variant for `admin_cancelled` |
| MD7 | No-show | Driver marks you no-show | reason `no_show` banner |
| MD8 | Rating flow | After completion | `rate_your_trip` nudge opens the TRIP rate sheet; bad forces message; re-open shows stored rating |
| MD9 | Resume | Kill app mid-trip → relaunch | `GET /trips/active` restores the live screen at the right status |
| MD10 | Women-only booking | Female account books women-only | badge shown through the flow; male account cannot book it |
| MD11 | Male-fallback sheet | API team forces male fallback | `women_only_male_driver_fallback` push → fallback sheet with keep / free-cancel; free cancel really is free |

## Suite M-E — Passenger app (packages)

| ID | Case | Steps | Expected |
|---|---|---|---|
| ME1 | Booking | Send package (photo, sizes, receiver, immediate vs scheduled) | created; delivery code visible immediately with the "share with receiver" hint |
| ME2 | Collection countdown | Scheduled booking | PENDING screen shows "collection starts at …" from `pickupDate` |
| ME3 | Status walk | Full delivery cycle | timeline follows PENDING→MATCHED→PICKED_UP→IN_TRANSIT→DELIVERED; driver card + call from MATCHED |
| ME4 | Pushes + deep links | Background the app during the cycle | `package_picked_up` / `package_delivered` land, tap opens the PACKAGE screen (packageId routing — never the trip screen) |
| ME5 | Delivered photo | Driver attached handover photo | photo card renders; absent (not placeholder) when no photo |
| ME6 | Cancel reasons | not-collected / failed-delivery / ops-cancel scenarios | `package_cancelled` with the right reason → right banner + CTA |
| ME7 | Package rating | After delivery | `rate_your_trip` with packageId opens the PACKAGE rate sheet; stored rating on re-open |
| ME8 | Receiver link (no app) | Open the WhatsApp `/track/{token}` link in a browser | timeline only, bilingual, no login, no map |

## Suite M-F — Cross-cutting

| ID | Case | Steps | Expected |
|---|---|---|---|
| MF1 | Arabic end-to-end | Switch app language to Arabic; repeat MC3, MD3, ME3 briefly | RTL correct; pushes and screens Arabic |
| MF2 | Poor connectivity | Airplane-mode toggles mid-trip | polling recovers; no stuck screens; no duplicate submissions |
| MF3 | Clock skew | Device time manually +1 h | countdowns/ETAs still sane (server-time anchored) |
| MF4 | Notification list | In-app notification center | history matches received pushes; filters + mark-read work |
