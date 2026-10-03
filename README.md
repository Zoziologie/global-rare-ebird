# Global Rare eBird

A map displaying rare bird sightings worldwide using eBird data.

[![image](https://user-images.githubusercontent.com/7571260/190668681-2bd06339-2568-4da2-9931-bccc5e95c360.png)](https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/)

## About

Global Rare eBird retrieves and visualizes recent notable bird observations (i.e., rare species) reported via the eBird public API.

- 📍 **Nearby Mode**: Sightings within 50 km of your location (requires permission).
- 🌎 **Region Mode**: Sightings in a country or US state/CA province.

You can share the url link at any point or bookmark it to save your region's specific page! Press `⌘ Cmd + D` (Mac) or `Ctrl + D` (Windows/Linux).

Spotted a bug or have a suggestion? Open a [GitHub Issue](https://github.com/Zoziologie/global-rare-ebird/issues).

## Local setup

1. Use a supported Node.js version (22.13+, 24, or 26+) and install the locked dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and set `MAPBOX_ACCESS_TOKEN` and `EBIRD_API_KEY`.
3. Start the app with `npm run dev`.

The GitHub Pages workflow injects the same `MAPBOX_ACCESS_TOKEN` and `EBIRD_API_KEY` names from repository secrets during the production build.

Both credentials are included in the public website bundle. Use a dedicated Mapbox public token (`pk.`) with only the required read scopes and URL restrictions for the production site and local development. Secret Mapbox tokens (`sk.`) are rejected by the build. See [Mapbox token management](https://docs.mapbox.com/accounts/guides/tokens/).

The eBird key is sent in the `X-eBirdApiToken` header to keep it out of request URLs, but remains visible to visitors. Keeping it private requires a backend proxy; GitHub Pages alone cannot do that. See the [eBird API documentation](https://documenter.getpostman.com/view/664302/S1ENwy59).

On the default URL, shared search parameters take priority over the last search saved on this device. Returning visits fetch fresh sightings for the saved search; no sightings or precise coordinates are persisted. A saved Around me search uses location only when permission is already granted, otherwise it falls back to saved regions or an estimated region without prompting. Clicking Around me explicitly requests browser location access.

First visits without a shared or saved search estimate a country from [IPWhois](https://ipwhois.io/documentation), preferring a US state or Canadian province when available in the region catalog. The HTTPS request asks only for success and country/region codes, omits credentials and referrer, and times out after four seconds. The free endpoint has a shared per-domain limit of 1,000 browser requests/day and no uptime guarantee. Blocked, unavailable, unsupported or rate-limited lookups leave the manual picker usable. Browser language and IP coordinates are not used for nearby searches. Estimated regions are replaced when the user chooses another region. Search preferences use the functional localStorage key `global-rare-ebird.last-search`, independently of analytics consent.

Region results are cached for the current browser session. Use **Refresh sightings** in Settings to fetch fresh data or apply changes to the fetched duration and nearby radius. Requests time out after 20 seconds and automatically retry once on timeout, and failed regions can be retried without preventing successful regions from displaying.

Pull requests run lint, regression tests, version metadata checks, the production build, and a dependency audit. Only pushes to `main` deploy to GitHub Pages. Dependencies and GitHub Actions are updated manually through maintenance PRs.

## Development and versioning

See [CONTRIBUTING.md](CONTRIBUTING.md) for the issue/PR workflow, debugging commands, semantic versions, and manual dependency maintenance. Run `npm run check` for the local checks. Version history is recorded in [CHANGELOG.md](CHANGELOG.md).

## Taxonomy data

Use the linear Avibase workflow in [docs/taxonomy-review.md](docs/taxonomy-review.md):

1. Refresh official regional inputs: `npm run taxonomy:refresh-sources`.
2. Capture the versioned eBird API: `npm run audit:taxonomies -- --fetch`.
3. Supply the matching Cornell integrated checklist in `raw-data/taxonomy-review/`.
4. Run `npm run taxonomy:update`, then inspect local concept and matching reports.
5. Resolve exceptions before publishing with `npm run generate:taxonomies`.

Raw inputs and full reports stay local. Persistent concept bindings, exceptional decisions, source URLs, and summary checksums are tracked in Git. ABA species statuses are inherited only by reportable `issf` groups through `REPORT_AS`. The monthly Action opens a review issue when eBird's latest version changes.

The app uses compact code-keyed files in `data/`: `taxo.json` stores order/category; the four regional lookups store rarity statuses and load when their region is selected. The existing individual generator commands remain for comparison during the migration; use the reviewed workflow for publication.

The independent region catalog can be refreshed with `npm run generate:region-catalog`.
