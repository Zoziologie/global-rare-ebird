# Changelog

User-visible changes are recorded here. Versions follow Semantic Versioning. The site does not publish GitHub releases or require release tags.

## [Unreleased]

## [0.5.0] - 2026-10-03

### Added

- A local, offline taxonomy audit with pinned eBird inputs, source checksums, and row-level review reports for issue #39.
- A versioned Avibase concept crosswalk, comparison reports, persistent mappings, a guarded linear regeneration command, and reviewed reportable groups for source subspecies.
- Reproducible regional-source downloads/conversion and a monthly eBird version monitor that opens one review issue per new version.

### Changed

- Refreshed official regional lists and generated rarity lookups through exact Avibase concepts; 19 ambiguous or nonreportable entries remain explicitly unresolved.
- Preserved ABA status inheritance only for reportable issf groups and corrected Swiss 2026 occurrence periods and the historical status label.

## [0.4.1] - 2026-10-03

### Changed

- Updated checkout/setup-node to their latest stable v7 releases and Pages artifact/deployment Actions to v5, preserving exact commit pins.
- Moved CI to Node.js 24 and confirmed all direct npm packages are already at their latest stable versions.
- Kept package versions, the lockfile, and a changelog as the versioning system; renamed CI metadata checks accordingly.
- Documented focused issues and manual dependency maintenance.

### Removed

- Dependabot version-update configuration and GitHub release publication workflow.
- Requirements for GitHub releases and release tags.

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
