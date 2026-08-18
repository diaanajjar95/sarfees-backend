# Driver Wallet — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: `{ "code", "message", "data" }` · Driver JWT (`Authorization: Bearer …`)

## The model in one paragraph

Trips stay **cash**: passengers pay the driver in the car, exactly as
before. The wallet is a **prepaid balance the platform's commission comes
out of**. Commission = `commissionPercent` × the trip's **total price**
(all seats + package fees), deducted automatically the moment the driver
completes a trip. **If the balance can't cover a trip's commission, the
driver receives no offers** until they top up — top-ups happen at a card
seller (a shop): the driver pays cash there and gives their **mobile
number**; the seller credits the wallet. There is nothing to redeem
inside the app.

## What the driver app must build

1. A **wallet screen**: balance, low-balance warning, transaction history.
2. The **low-balance state** on the Home tab (the `wallet` block is already
   in home-summary) with copy like "Top up at a Sarfees seller to keep
   receiving trips".
3. Handle the `wallet_low_balance` notification (push + in-app).
4. Show `commissionDeducted` / `walletBalance` on the trip-completion
   summary screen.

## Endpoints

### `GET /drivers/wallet`

Real response:
```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "balance": 8.5,
    "lowBalanceThreshold": 5,
    "isLow": false,
    "commissionPercent": 15
  }
}
```

`commissionPercent` lets the app show estimates: a 10 JD trip will cost
`10 × 15% = 1.50 JD` from the wallet. The percent can be changed by ops —
always read it from here, never hardcode.

### `GET /drivers/wallet/transactions?page=1&limit=20`

Newest first. Real rows:
```json
{
  "data": [
    { "id": 3, "type": "commission", "amount": -0.75, "balanceAfter": 9.25,
      "note": "Commission 15.0% of 5.00 JD trip total", "tripId": 91,
      "cardCodeMasked": null, "createdAt": "…" },
    { "id": 1, "type": "card_topup", "amount": 10, "balanceAfter": 10,
      "note": null, "tripId": null, "cardCodeMasked": "••••-••••-3792",
      "createdAt": "…" }
  ],
  "page": 1, "limit": 20, "totalItems": 2, "totalPages": 1
}
```

Transaction types: `card_topup` · `admin_credit` · `refund` ·
`commission` (always negative) · `adjustment` (either sign).
**Amounts are signed** — render credits green, commission red;
`balanceAfter` is the running balance for the row.

### Home-summary `wallet` block (already in `GET /drivers/home-summary`)

```json
"wallet": { "balance": 8.5, "lowBalanceThreshold": 5, "isLow": false }
```

`isLow: true` → show the top-up warning banner.

### Trip completion response (`POST /drivers/trips/{id}/complete`)

Real response gained these fields:
```json
{
  "totalCashCollected": 5,
  "commissionRate": 0.15,
  "commissionDeducted": 0.75,
  "netEarnings": 4.25,
  "walletBalance": 9.25
}
```

Show "Commission −0.75 JD (from wallet) · New balance 9.25 JD" on the
completion screen.

## Rules the app should reflect

- **No offers on insufficient balance.** The matcher checks per-trip:
  balance ≥ that trip's commission. The wallet screen and Home banner are
  the driver's only signal — surface them prominently when `isLow`.
- The wallet **can go negative** (a trip that was accepted while covered
  may complete after the balance dropped). Negative → definitely no
  offers; render the negative balance clearly.
- Commission is charged on the trip's **booked total**, not what was
  collected — a passenger no-show does not reduce it.
- Top-ups arrive as a `card_topup` transaction + an `earnings_recorded`
  notification ("Wallet topped up") the moment the seller redeems —
  refresh the wallet screen on that notification.

## `wallet_low_balance` notification

Fired (max once per 24 h per driver) when the balance drops under the
threshold after a completion, or when the driver misses a trip purely for
wallet reasons. Payload:

```json
{ "balance": 0, "threshold": 5, "requiredHint": 0.75 }
```

`requiredHint` (nullable) = the commission of the trip they just missed —
use it in copy: "You missed a trip that needed 0.75 JD commission".
Deep-link to the wallet screen.
