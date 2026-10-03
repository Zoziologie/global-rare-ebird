# Changelog

User-visible changes are recorded here. Versions follow Semantic Versioning; release tags use `vX.Y.Z`.

## [Unreleased]

## [0.4.0] - 2026-10-03

### Added

- A Settings action to refresh sightings and apply fetched duration/radius changes.
- Visible request failure messages, retry controls, and 20-second request timeouts.
- ESLint checks and 21 deterministic regression tests with Vitest.
- CI checks for lint, tests, dependency audit, release metadata, and production builds.
- Weekly Dependabot updates, issue/PR templates, and a manual GitHub release workflow.

### Changed

- Updated Vue, Vite, Mapbox, and associated dependencies; the dependency audit is clean.
- Cached region results and parallelized taxonomy lookups to avoid repeated downloads.
- Reduced the compressed taxonomy payload by about 30% and deferred closed species details and media images.
- Sent eBird authentication in a header and rejected secret Mapbox tokens during builds.
- Pinned GitHub Actions to commits and limited deployment permissions to the deploy job.

### Fixed

- Unescaped API identifiers in popup HTML.
- Older requests overwriting current sightings and one failed region hiding successful regions.
- Duplicate sightings from overlapping regions and the species pagination count.
- Responsive map style changes, delayed map initialization after unmount, and nearby map bounds.
- Settings refresh, failed taxonomy download retries, and unexpected geolocation prompts on startup.
- Local development dependency scanning of downloaded HTML under `raw-data`.

## [0.3.3]

Existing application version before release tracking was introduced. Earlier changes are available in Git history; no retrospective release date or tag is assigned.
