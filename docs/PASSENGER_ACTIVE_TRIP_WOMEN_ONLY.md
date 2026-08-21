# Passenger Active Trip (women-only) — screen states & responses

Base URL: `http://169.58.67.105` · Customer JWT · Envelope `{ "code", "message", "data" }`.

A women-only trip uses **the same endpoints, statuses, and response
shapes as the shared trip** — read PASSENGER_ACTIVE_TRIP_SHARED.md first;
this document only lists the deltas. Everything not mentioned here is
identical.

## Booking

`POST /trips/request` with `"isFemaleOnly": true`. Only female passengers
can book it; the group is matched only with other women-only requests, and
the cascade puts **every female driver ahead of any male driver**.

`GET /trips/active` distinguishes it for the app:

```json
{ "type": "trip", "tripType": "womenOnly", "trip": { …same shape… } }
```

Use `tripType: "womenOnly"` to theme the screen (badge on the map header,
driver card, and booking summary).

## Status walkthrough — deltas only

| Status | Delta vs shared |
|---|---|
| `PENDING` | Show the women-only badge on the searching state. Matching pool is smaller — searches may run longer; `trip_delay_escalation` is more likely, keep the same copy. |
| `MATCHED` | Driver card as usual. **Check the fallback flag below** — if a male driver was assigned, render the fallback sheet on top of this state. |
| `DRIVER_EN_ROUTE` … `COMPLETED` | Identical to shared. |
| `CANCELLED` | Identical, plus the free-cancel path below. |

## The male-driver fallback (§9.4)

If no female driver is available, the system may assign a male driver
rather than leave the group unserved. When that happens, at `MATCHED` the
passenger receives this push:

```json
{ "type": "women_only_male_driver_fallback",
  "payload": "{\"tripRequestId\":81,\"tripId\":99}" }
```

Screen requirements:

1. Render the **fallback sheet** over the matched state: explain a male
   driver was assigned because no female driver was available.
2. Offer two actions: **Keep the trip** (dismiss, continue as normal
   shared flow) and **Cancel for free** — the passenger-side cancel
   carries **no penalty** on this path.
3. The driver card must still show the driver's real details — no hiding.

The `trip` object itself does not carry a dedicated flag — the app knows
from the push (or by comparing `driver` gender if it renders from a cold
resume; the driver object has no gender field, so **persist the fallback
notification locally** until the trip ends).

## Rating

Identical to shared (`POST /trips/request/{id}/rate`). Ratings feed the
same driver average — there is no separate women-only rating pool.
