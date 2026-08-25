# App Init — mobile integration guide

Base URL: `http://169.58.67.105` · Envelope: every response is `{ "code", "message", "data" }` — examples show `data` only. · No auth — both endpoints are public. · `Accept-Language: en|ar` resolves `currentLanguage` and the back-compat `settings.maintenanceMessage`.

Everything here is **runtime-controlled from the admin portal** (App
settings page) — per app, no redeploy: maintenance mode, force /
optional update gates, store URLs, plus the platform currency.

## 1. `GET /app/init` — call on every launch

```
GET /app/init?app=passenger&platform=android&currentVersion=1.4.1
```

| Query param | Required | Notes |
|---|---|---|
| `app` | recommended | `passenger` \| `driver`. **Omitted = `passenger`** (back-compat) — the driver app MUST send `app=driver` or it reads the passenger config. |
| `platform` | recommended | `android` \| `ios` — picks which version gate applies. Omitted = `ios`. |
| `currentVersion` | recommended | Installed version, semver `X.Y.Z`. Omitted → no force/optional verdict (both false). |

Real response (captured live; legal HTML elided):

```json
{
  "app": "passenger",
  "version": {
    "latestVersion": "1.0.0",
    "minVersion": "1.0.0",
    "storeUrl": "https://play.google.com/store/apps/details?id=PLACEHOLDER",
    "forceUpdate": false,
    "updateAvailable": false
  },
  "maintenance": {
    "active": false,
    "messageEn": "Scheduled maintenance, back soon",
    "messageAr": "صيانة مجدولة، سنعود قريباً"
  },
  "currency": {
    "code": "SYP", "symbolEn": "SYP", "symbolAr": "ل.س",
    "nameEn": "Syrian Pound", "nameAr": "ليرة سورية", "decimals": 0
  },
  "links": {
    "termsUrl": "https://sarfees.com/legal/terms",
    "privacyUrl": "https://sarfees.com/legal/privacy",
    "supportEmail": "support@sarfees.com",
    "supportPhone": ""
  },
  "settings": {
    "maintenanceMode": false,
    "maintenanceMessage": "Scheduled maintenance, back soon",
    "defaultLanguage": "en",
    "supportedLanguages": ["en", "ar"]
  },
  "currentLanguage": "en",
  "legal": {
    "terms":   { "ar": "<html…>", "en": "<html…>", "format": "html", "updatedAt": "2026-08-25T18:38:09.000Z" },
    "privacy": { "ar": "<html…>", "en": "<html…>", "format": "html", "updatedAt": "2026-08-25T18:38:09.000Z" }
  }
}
```

## 2. Launch decision order

Evaluate in THIS order — maintenance wins over updates:

1. **`maintenance.active === true`** → full-screen maintenance state.
   Show `messageAr` / `messageEn` by app language (fall back to the
   other if one is empty). Block all usage; re-check on foreground.
2. **`version.forceUpdate === true`** → blocking update screen, single
   button to `version.storeUrl`. No skip.
3. **`version.updateAvailable === true`** → dismissible "update
   available" nudge to `version.storeUrl`. Continue normally.
4. Otherwise → proceed to the app.

The semantics behind the two flags: `forceUpdate` fires when
`currentVersion < minVersion`; `updateAvailable` when
`currentVersion < latestVersion`. Ops raises `minVersion` to kill old
clients, `latestVersion` for a soft nudge — per app, per platform.

## 3. What else to consume from init

| Block | Use |
|---|---|
| `currency` | Format **every** money amount with `symbolEn`/`symbolAr` + `decimals` (SYP = 0 decimals, whole pounds). Same data as `GET /platform/currency` — you don't need the second call when you already hit init. |
| `maintenance` | Bilingual pair — prefer it over the legacy `settings.maintenanceMessage` (single string, request-language resolved, kept for back-compat). |
| `settings.maintenanceMode` | Duplicate of `maintenance.active` (back-compat — same value). |
| `links` | Support email/phone + hosted terms/privacy URLs. |
| `legal` | Terms + privacy rendered HTML in both languages; `updatedAt` changes when the documents change — prompt re-acceptance on change if the app tracks acceptance. |
| `currentLanguage` | Server-resolved from `Accept-Language`; informational. |

## 4. `GET /app/force-update` — lightweight foreground check

Same query params as init, returns only the update verdict — use it on
app resume when you don't need the full payload:

```
GET /app/force-update?app=driver&platform=android&currentVersion=1.0.0
```

```json
{
  "forceUpdate": false,
  "updateAvailable": false,
  "minVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "storeUrl": "https://play.google.com/store/apps/details?id=PLACEHOLDER"
}
```

Note it does NOT include `maintenance` — if you want the maintenance
state on foreground too, call `/app/init` instead (it's still cheap).

## 5. Recommended app behavior

- Call `/app/init` on **cold start** and on **returning to foreground**
  after being backgrounded a while (e.g. > 5 minutes).
- Cache the last response for offline cold starts, but never cache the
  maintenance/force verdicts beyond the session.
- Maintenance and version gates are **per app** — passenger can be
  under maintenance while driver runs normally, and vice versa.
- Verified live: flipping passenger maintenance + raising its
  `minVersion` changed the passenger verdicts instantly while the
  driver init stayed untouched.
