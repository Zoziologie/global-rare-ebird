# Analytics setup and interpretation

Issue: https://github.com/Zoziologie/global-rare-ebird/issues/43

Keep the existing GA4 property and web stream `G-0B2T8GT7JC`. No paid service is added.

## Before deployment (property owner)

- [ ] Export the existing 90-day reports as CSV/PDF, recording the exact date range and property timezone. The reported baseline is 329 users, 144 returning users, and 3m40 engagement; these are owner-reported, not independently verified. Record whether users means active or total users and whether engagement is per active user or per session.
- [ ] In Admin → Data streams → web stream, **turn Enhanced measurement off entirely**. This prevents duplicate outbound events and automatic browser-history/page URL collection. The app sends one sanitised page view per consenting page load; automatic GA session/engagement events remain.
- [ ] Disable Google Signals and advertising personalisation in data collection settings. Disable unused account data-sharing options and confirm no Ads links, user-provided data collection, or cross-domain measurement are enabled.
- [ ] Set event-data retention to **2 months** and turn off resetting retention on new activity. Confirm the actual value and update the on-site notice to state it before deployment. Aggregated standard reports have separate retention; cookie lifetime is capped at one year in code.
- [ ] Register the event-scoped custom dimensions listed below (Admin → Custom definitions). These apply prospectively and may take time to populate.
- [ ] Record the actual production deployment date/time and version below after merge/deployment. Compare equal time windows and annotate the consent boundary in reports.

Deployment: pending. Version: 0.6.0. Baseline export and exact metrics: pending owner verification.

## Events and dimensions

| Event | Properties / custom dimensions | Meaning |
| --- | --- | --- |
| `data_load` | `region_code`, `mode`, `outcome`, `source` | Completed initial or deliberate load; one event per selected region, or one around load. Outcome `success`/`failure`; source `network`/`cache`. Around loads omit region and coordinates. Aborted/superseded loads do not count. |
| `link_click` | `link_category` | `directions`, `ebird_hotspot`, `ebird_checklist`, `support`, `github`, `zoziologie`; includes sidebar and map popup links. No destination URL or identifiers. |
| `share` | `method`, `outcome` | Native `completed`/`cancelled`/`failed`; clipboard `copied`/`failed`. A failed native share followed by clipboard success yields two outcomes. Completion means the browser promise resolved, not that someone received it. |
| `map_layer_change` | `layer` | Explicit change to `streets` or `satellite`. |
| `mode_change` | `mode` | Explicit switch to `region` or `around`. Initial mode does not count as a switch. |
| `setting_change` | `setting_name`, `setting_value` | Explicit input change for language, fetched/filtered days and radius, search fields, sort, rarity, map/media/hotspot filters. No species search text. |

Build Explorations for loads by region/mode/outcome/source, links by category, sharing by method/outcome, layers, and settings. Use daily/weekly users, returning users, engagement, and event counts to assess trends. Use failures / (successes + failures) for load failure rates; cache hits are loads, not eBird API calls.

## Consent and privacy behavior

Basic consent mode: no Google script or analytics request for undecided/rejected visitors. Restored acceptance starts GA on reload; events before acceptance are discarded. Advertising consent stays denied. All configured page fields use the fixed public homepage, empty referrer, and fixed title. Event fields and values are allowlisted; no coordinates, tokens, free text, URLs, or observation identifiers are sent.

Withdrawal sets the GA disable flag before cookie deletion and reloads to unload the tag's listeners/timers. Existing in-flight requests or already collected data cannot be recalled. The local choice is stored separately from GA cookies. Reopening preferences moves keyboard focus to the controls and returns it on closing. The banner is a non-modal region; it does not block the app.

## Deployment verification and review

- [ ] In a clean browser, confirm no `googletagmanager` or `google-analytics` requests before acceptance, after rejection/reload, or after withdrawal/reload.
- [ ] Accept and inspect requests: fixed page location, empty referrer, denied advertising, documented event properties. Confirm Enhanced measurement is disabled in the property.
- [ ] Check desktop/mobile layout, keyboard controls, saved choice, and cookies.
- [ ] After deployment compare consent-era trends, feature usage, and failures. Totals now describe only consenting visitors and cannot be directly compared to the previous unconditional collection. Consent uptake cannot be calculated from GA alone because rejected visitors are not measured; do not add tracking of rejected visitors to calculate it.
- [ ] Decide whether these reports justify keeping GA or revisiting cookieless options.

References: [Google consent setup](https://developers.google.com/tag-platform/security/guides/consent), [GA configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [retention settings](https://support.google.com/analytics/answer/7667196).
