# Driver Preferences — go-online options endpoint

Base URL: `http://169.58.67.105` · Driver JWT (`Authorization: Bearer …`) · Envelope: `{ "code", "message", "data" }` — examples show `data` only.

The go-online sheet (S-05) must render its choices **from the server**,
not hardcode them. One call returns everything:

```
GET /drivers/preferences
```

Render this → the driver picks → submit the selection to
`POST /drivers/activate`. The two are a 1:1 mapping (table below).

## Response — real example (male driver)

```json
{
  "destinationCities": [
    { "value": null,    "nameEn": "Any Destination", "nameAr": "أي وجهة" },
    { "value": "Amman", "nameEn": "Amman",           "nameAr": "عمان" },
    { "value": "Irbid", "nameEn": "Irbid",           "nameAr": "إربد" }
  ],
  "tripTypes": [
    { "value": "mixed",         "labelEn": "Mixed (passengers + packages)", "labelAr": "مختلط (ركاب وطرود)" },
    { "value": "shared",        "labelEn": "Shared rides",                  "labelAr": "رحلات مشتركة" },
    { "value": "packages_only", "labelEn": "Packages only",                 "labelAr": "طرود فقط" }
  ],
  "minPassengers": [
    { "value": null, "labelEn": "Any", "labelAr": "أي عدد" },
    { "value": 1,    "labelEn": "1+",  "labelAr": "+1" },
    { "value": 2,    "labelEn": "2+",  "labelAr": "+2" },
    { "value": 3,    "labelEn": "3+",  "labelAr": "+3" }
  ],
  "goingHome": { "available": true, "homeCity": "Amman", "lockedUntil": null },
  "location": {
    "required": true,
    "hint": "Send currentLocationLat/Lng with activate, or call POST /drivers/me/location right after — the matcher skips drivers with no location snapshot."
  }
}
```

**Female drivers** get one extra trip type (verified live — same call as
driver Rania):

```json
{ "value": "women_only", "labelEn": "Women-only trips", "labelAr": "رحلات للنساء فقط" }
```

Male drivers never see `women_only` — they can't opt into it. (A male
driver may still be *assigned* a women-only trip as the §9.4 fallback
when no female driver exists; that's matcher-side and not a preference.)

## Field semantics

| Field | Notes |
|---|---|
| `destinationCities[]` | Bilingual; pick label by app language. `value: null` = "Any Destination" → **omit** `destinationCity` in activate. Other entries: send `value` as `destinationCity`. |
| `tripTypes[]` | Multi-select, **at least one required**. Send the chosen `value`s as the `tripTypes` array. |
| `minPassengers[]` | Single-select. `value: null` = Any → omit `minPassengers`; else send the number (1–3). |
| `goingHome.available` | `false` when the driver has no home city on file, or is inside the going-home lock. Hide/disable the toggle then. |
| `goingHome.homeCity` | Show it on the toggle ("Going home to Amman"). When goingHome is on, the server forces the destination to this city — grey out the destination picker. |
| `goingHome.lockedUntil` | Non-null while locked (driver completed a going-home trip into their home city — offline until local midnight). Show a countdown if you like; activating earlier returns 403. |
| `location.required` | Always true. Attach GPS to activate (`currentLocationLat/Lng`) or call `POST /drivers/me/location` immediately after — **a driver with no location snapshot receives no offers** (`no_location_snapshot` hard filter). |

## Mapping to activate

Selections → `POST /drivers/activate`:

```json
{
  "destinationCity": "Amman",        // omit when "Any" picked
  "tripTypes": ["mixed"],            // ≥ 1 required
  "goingHome": false,
  "minPassengers": 2,                // omit when "Any" picked
  "currentLocationLat": 31.9539,     // strongly recommended
  "currentLocationLng": 35.9106
}
```

Errors worth handling on the sheet:

| HTTP | When | UI |
|---|---|---|
| 400 | empty `tripTypes`, bad values | inline validation |
| 403 | going-home lock still active | show `lockedUntil` countdown |
| 403 | driver suspended | route to the suspension screen (home-summary `suspensionInfo`) |

## Refresh rule

Fetch every time the go-online sheet opens — cities can grow, the
going-home lock changes daily, and the women-only entry depends on the
profile. Don't cache across sessions.
