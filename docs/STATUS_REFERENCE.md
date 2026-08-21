# Sarfees Status Reference — driver & passenger

Every status enum the mobile apps see, what each value means, and how it is
entered and exited. Exact strings as the API serializes them — note the
convention: **passenger-facing statuses are UPPERCASE**, driver-side and
internal statuses are lowercase.

Related: [DRIVER_HOME_SUMMARY.md](DRIVER_HOME_SUMMARY.md) has full captured
responses for each driver status; [MOBILE_API.md](MOBILE_API.md) is the
endpoint reference.

---

## Part 1 — Driver app

### 1.1 Driver status (`status` in `/drivers/home-summary` and profile)

```
inactive ──activate──► active ──accept──► on_trip
    ▲                    │                         │
    └────deactivate──────┘◄────complete/cancel─────┘
              (admin suspend from any state → suspended → reinstate → inactive)
```

| Status | Meaning |
|---|---|
| `inactive` | Off shift. The matcher never considers this driver. Home tab shows the Go Online button and the `lastSession` recap. Entered on app deactivate, on admin reinstate, or automatically after completing a going-home trip into the driver's home city (locked out until local midnight — re-activating earlier returns 403). |
| `active` | On shift and matchable. The driver locked in preferences (destination city, trip types, going-home, min passengers) at activation and streams GPS every ~10 s — that live position is what the matcher's origin-city filter uses. While active, a `pendingOffer` may appear on home-summary with a **30-second countdown**; no response counts as a decline (and declines/timeouts carry a 30-day decaying ranking penalty). |
| `on_trip` | Booked on a trip — entered the moment the driver ACCEPTS an offer (before pressing Start). Home-summary carries the full `currentTrip` block; `currentTrip.status` says which phase: `accepted` (not started yet — show the Start button) or `in_progress` (current stop, progress, on-board list, running earnings). Returns to `active` when the trip completes or is cancelled. |
| `suspended` | Blocked by ops. Activation refused. `suspensionInfo.category` tells the app which card to render: `documents` (paperwork lapse — re-upload), `rating` (below platform minimum — current vs required shown), `payment` (commission overdue — outstanding balance shown), `violation` (conduct report — 1–3 day review window + appeal), or `null` for legacy suspensions (generic card). Only admin reinstate exits this state. |

### 1.2 Driver trip status (`status` on a DriverTrip — offers and rides)

```
offered ──accept──► accepted ──start──► in_progress ──complete──► completed
   │ decline / 30 s timeout                  │
   ▼                                         └──cancel──► cancelled
declined / expired
```

| Status | Meaning |
|---|---|
| `offered` | The matcher (or ops manual assign) offered this trip to the driver. Shows as `pendingOffer` on home-summary with `secondsRemaining`. The driver holds it exclusively — no other driver sees this group while the countdown runs. |
| `accepted` | Driver accepted within the countdown. The trip group locks to this driver (first accept wins — a race loser gets "no longer available"). Passengers are notified; the manifest (stops, passengers, parcels, cash) is available. Not yet started. |
| `in_progress` | Driver tapped start. Stop-by-stop execution begins (arrive → confirm pickup/dropoff per stop). Passengers see live progression. |
| `completed` | All stops resolved and the driver tapped complete. Earnings finalized (cash collected − commission), linked trip group closes, and going-home auto-offline fires if applicable. |
| `cancelled` | Killed before completion — by the driver (cancel penalty applies, group goes back to the top of the offer queue), by ops full-stop cancel, or because every member cancelled. |
| `declined` | Driver explicitly declined the offer. Counts toward the decline penalty. The cascade moves to the next ranked driver. |
| `expired` | The 30-second countdown lapsed with no response. Treated like a decline (penalty + cascade advances). |

### 1.3 Stop status (`stops[].status` inside a trip)

| Status | Meaning |
|---|---|
| `pending` | Not reached yet. |
| `arrived` | Driver tapped "arrive" at this stop; passengers at the stop are notified. Pickup/dropoff confirmations now allowed. |
| `confirmed` | Every passenger/parcel at this stop was resolved (picked up / dropped / no-show / refused…) and the driver confirmed. The next stop becomes current. |

Multi-passenger trips have **one pickup and one dropoff stop per passenger**
(each at that passenger's own coordinates). Mixed trips order package
collection first and package delivery last.

### 1.4 Per-passenger outcome at a stop (`passengers[].status`)

Roles: `boarding` (this is their pickup) / `alighting` (their dropoff).

| Status | Meaning |
|---|---|
| `pending` | Awaiting action at this stop. |
| `picked_up` | Boarded at pickup (their request becomes `TRIP_IN_PROGRESS`). |
| `no_show` | Didn't appear within the grace window after in-app call attempts. Their request is CANCELLED, the no-show fee applies, and their downstream dropoff auto-resolves so the trip can continue. |
| `dropped_off` | Delivered at their dropoff; their fare was collected there (5 JD per seat). |
| `cash_not_collected` | Dropped off but the driver flagged the fare as unpaid — surfaces to ops for follow-up. |
| `cancelled` | The passenger cancelled before this stop was executed. |

### 1.5 Per-parcel outcome at a stop (`packages[].status`)

Roles: `collecting` (pickup from sender) / `delivering` (handover to recipient).

| Status | Meaning |
|---|---|
| `pending` | Awaiting action at this stop. |
| `collected` | Taken from the sender — **cash is collected here** (§6.1, sender pays at pickup). |
| `not_found` | Sender/parcel not at the pickup within the grace window. Downstream delivery auto-resolves. |
| `refused` | Driver refused the parcel at pickup with a reason: `not_as_declared`, `suspicious`, `prohibited_item`, `oversized`, or `other` (photo optional). **Never** counts against the driver's decline record; sender is not charged. |
| `delivered` | Handed to the recipient against their **4-digit delivery code** (wrong code → 400, nothing saved) with a handover photo. No cash at delivery. |
| `delivery_failed` | Recipient unreachable/refused at dropoff — parcel stays with ops flow (return/redelivery fee policy). |

---

## Part 2 — Passenger app

### 2.1 Trip request status (`status` on a trip request)

```
PENDING ──driver accepts──► MATCHED ──driver starts──► DRIVER_EN_ROUTE
   │                                                        │ driver arrives at my pickup
   │ cancel / no-show                                       ▼
   ▼                                              ARRIVED_AT_PICKUP
CANCELLED                                                   │ I board
                                                            ▼
              COMPLETED ◄──trip completes── ARRIVING_AT_DROPOFF ◄──driver arrives
                                                            ▲       at my dropoff
                                                  TRIP_IN_PROGRESS
```

| Status | Meaning |
|---|---|
| `PENDING` | Request created and grouped (or waiting to group) — no driver yet. Scheduling rules applied at creation: quarter-hour slot (:00/:15/:30/:45), ≥ 30 min ahead; "now" requests get a 15–30 min window. A passenger can hold **one live request at a time**. The driver search happens at T-30 before departure; if nobody accepts, ops is escalated (the passenger gets a "we're still finding a driver" notification — never a silent failure). |
| `MATCHED` | A driver accepted the group. The passenger is notified with driver + vehicle details. Women-only riders are additionally notified (with free cancel) if the assigned driver is the §9.4 male fallback. |
| `DRIVER_EN_ROUTE` | The driver started the trip and is heading to pickups. |
| `ARRIVED_AT_PICKUP` | The driver marked arrival at **this passenger's** pickup stop. |
| `TRIP_IN_PROGRESS` | This passenger boarded (driver confirmed their pickup). |
| `ARRIVING_AT_DROPOFF` | The driver marked arrival at this passenger's dropoff stop. Fare (5 JD/seat) is collected here in cash. |
| `COMPLETED` | Dropped off; trip closed for this passenger. |
| `CANCELLED` | Ended without service: passenger cancelled (fee matrix applies after freeze), ops cancelled with a reason, the whole trip was cancelled, or the passenger no-showed at pickup (no-show fee). |

Statuses move per passenger — in a shared trip each rider's request advances
as *their own* stops are reached, not in lockstep with the others.

### 2.2 Package delivery status (`status` on a package request)

```
PENDING ──driver accepts──► MATCHED ──collected at pickup──► PICKED_UP ──► DELIVERED
   │ cancel (free)             │ cancel (fee applies)
   ▼                           ▼
CANCELLED                  CANCELLED
```

| Status | Meaning |
|---|---|
| `PENDING` | Delivery request created and grouped — no driver yet. Same scheduling rules as trips (quarter-hour, ≥ 30 min lead; immediate pickups get the 15–30 min window). A 4-digit `deliveryCode` is generated at creation — the sender shares it with the recipient; the driver needs it at handover. Cancelling now is free. |
| `MATCHED` | A driver accepted the carrying trip. Cancelling now incurs the sender cancellation fee. |
| `PICKED_UP` | Driver collected the parcel from the sender — **payment happened here in cash** (§6.1). Cancellation is no longer possible through the app (ops return flow only). |
| `IN_TRANSIT` | Reserved value — the backend does not currently set it; parcels go straight from `PICKED_UP` to `DELIVERED`. Treat as equivalent to `PICKED_UP` if ever seen. |
| `DELIVERED` | Handed to the recipient against the delivery code, with a handover photo stored (`deliveredPhotoUrl` on the package detail). |
| `CANCELLED` | Cancelled by the sender (fee depends on stage), by ops with a reason, or refused at pickup by the driver (reason recorded; sender not charged for refusals). |

---

## Part 3 — Behind the scenes (ops / admin portal)

Mobile apps never see these directly, but they explain what the passenger is
experiencing while `PENDING`.

### 3.1 Trip group status (matching engine)

| Status | Meaning |
|---|---|
| `open` | Collecting compatible members on a corridor (30-min pickup window, geography/detour/time/gender/capacity checks). |
| `frozen` | T-30 reached — membership locked, driver search starts. Full-car and urgent-package groups are *born* frozen. |
| `offering` | Cascade running: ranked drivers offered one at a time, 30 s each. Women-only groups rank every female driver above any male. |
| `broadcasting` | Cascade exhausted — all remaining eligible drivers offered simultaneously; first accept wins. |
| `assigned` | A driver accepted. Members are `MATCHED`. |
| `in_progress` | The driver started the trip. |
| `completed` | Trip finished; group closed. |
| `cancelled` | Emptied out (all members cancelled) or killed by ops. |
| `unserved_escalation` | Nobody accepted by departure. Ops is alerted (portal + escalation case), members get the delay notification, and the group stays open for a late accept — never a silent failure. |

### 3.2 Offer response (offer history / audit)

| Value | Meaning |
|---|---|
| `pending` | Offer live, countdown running. |
| `accept` | Driver took it (first accept wins the group). |
| `decline` | Driver said no — ranking penalty. |
| `timeout` | 30 s elapsed — treated as a decline. |
| `superseded` | Another driver accepted first (broadcast race) — this offer voided, no penalty. |
| `cancel_after_accept` | Driver bailed after accepting — heaviest penalty; group returns to the top of the queue. |
