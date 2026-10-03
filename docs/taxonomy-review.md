# Taxonomy review — issue #39

Implementation is tracked in [issue #39](https://github.com/Zoziologie/global-rare-ebird/issues/39) and [draft PR #42](https://github.com/Zoziologie/global-rare-ebird/pull/42). The Avibase workflow, refreshed application lookups, and Swiss 2026 status definitions are implemented for review. Nineteen source entries remain explicitly unresolved.

## Run linearly

Requires Node.js, curl, unzip, Poppler (`pdftotext`), and Python with `pdfplumber` from `taxonomy/requirements.txt`. Set `TAXONOMY_PYTHON` if the desired Python executable is not `python3`.

1. Check the publishers for new regional editions and update `taxonomy/source-inputs.json` if needed. Run `npm run taxonomy:refresh-sources` to download and convert the specified official inputs. Inspect PDFs and CSV counts after changing an edition.
2. Run `npm run audit:taxonomies -- --fetch` to discover the latest eBird version and download its explicitly versioned English API CSV. This replaces local API snapshots; retain previous snapshots first.
3. Obtain the same-year [Cornell integrated checklist](https://www.birds.cornell.edu/clementschecklist/introduction/updateindex/october-2025/2025-citation-checklist-downloads/) and save it as `raw-data/taxonomy-review/clements-YYYY-concepts.csv`. The 2025 copy was found in another local project after Cornell downloads returned HTTP 403. Its checksum and citation are recorded in `taxonomy/concept-source.json`.
4. Run `npm run taxonomy:update` offline. Stages run top-to-bottom: source audit, versioned code/concept crosswalk, persistent regional matching, local JSON generation. Each stage also has a separate npm command.
5. Inspect `output/taxonomy-review/crosswalk-summary.json`, `concept-matches.csv`, `concept-review.csv`, and `generation-summary.json`. Local generated lookups are in `output/taxonomy-review/generated/`.
6. Record exceptions in `taxonomy/mapping-decisions.json` with source key, exact Avibase ID, accepted/unresolved disposition, reason, and evidence. Run the workflow again. Proposed or invalid accepted rows block generation. Explicit unresolved rows are retained in the report and omitted from app lookups.
7. Review the proposed app diff before running `npm run generate:taxonomies` (equivalent to `taxonomy:update --write`). Inheritance policy is recorded in `taxonomy/status-policy.json`. Update `taxonomy/accepted-mappings.json` from the reviewed local registry only after inspecting all changes. Commit the baseline, summaries, app data, version, and changelog together in the PR.

Raw files and full row reports are ignored. In particular, the ABA source prohibits redistribution without express written permission. Do not attach the whole checklist or full row report to a public issue. The tracked registry contains identifiers, statuses, restrictions, hashes, and rationale; it omits the full source name table.

## Latest official inputs, checked 2026-10-03

| Source | Official edition | Parsed rows |
| --- | --- | ---: |
| [ABA](https://www.aba.org/aba-checklist/) | 8.19, January 2026; identical to the existing local input | 1,161 |
| [France CHN](https://www.chn-france.org/en/homologation/species/) | Current page; 2026 removals reflected | 248 |
| [Germany DDA](https://www.dda-web.de/dak/meldebogen) | Effective 2023-01-01; published for 2023–2026; PDF identical to existing input | 223 |
| [Swiss committee](https://www.vogelwarte.ch/de/forschen/monitoring/schweizerische-avifaunistische-kommission/) | PDF titled 2026, despite its older URL; 433 numeric-status rows and 6 rows without S status | 433 |

Download/conversion provenance is in `docs/taxonomy-source-provenance.json`; normalized input hashes and the legacy audit are in `docs/taxonomy-audit-summary.json`. Germany's 223 names and restrictions agree with the old CSV. Switzerland previously had 414 rows; current occurrence periods are 2015–2024 and 1975–2024. The UI now uses these periods and labels status 4 “Historical”.

## Concept coverage and review

The 2025 integrated file contains 35,853 coded rows. Joining by exact Cornell code to the API gives **100% concept-ID coverage** for all 17,891 reportable taxa: species 11,167; issf 3,952; slash 1,035; hybrid 792; spuh 722; form 156; domestic 25; intergrade 42. No ID maps to multiple reportable codes in this snapshot. Summary: `docs/taxonomy-crosswalk-summary.json`.

| Source | Accepted bindings | Explicit unresolved | Pending proposals |
| --- | ---: | ---: | ---: |
| ABA | 1,161 | 0 | 0 |
| France | 240 | 8 | 0 |
| Germany | 212 | 11 | 0 |
| Switzerland | 433 | 0 | 0 |

The initial baseline uses unique exact scientific-name concepts. These initial matches are automatic, not individually certified biological reviews. Thirty-three exceptional entries record reviewed name/rank equivalents or unresolved scope. Fuzzy and common-name candidates are never automatically accepted. Exact nonreportable subspecies remain unresolved under the user's policy; they never acquire a parent species' code. Ambiguous whitethroat/flycatcher groups and the German Lesser Sand-Plover scope also remain unresolved.

The baseline retains exact Avibase IDs on subsequent runs. New regional rows become proposals even if their names match uniquely. Changes in source status, reportability, category, or REPORT_AS require review; persistent alias decisions cannot silently approve them. To explicitly approve a flagged status/category change, add `reviewedTaxonomySha256` and `reviewedSourceSha256` to the decision using the inspected current report hashes. Conflicting statuses for the same code block generation rather than selecting a numeric maximum.

**ABA policy:** the user approved inheritance of species-level ABA status only to reportable `issf` groups through REPORT_AS. Explicit group status takes precedence. Hybrids, slash taxa, and nonreportable subspecies do not inherit. `aba-inheritance.json` records each inherited code and its parent concept; default status 1 is omitted from compact lookups. The regenerated ABA lookup has 1,063 codes: 15 domestic/form entries previously reached through scientific-name matching are omitted because they are neither the listed species concept nor an approved issf inheritance. The remaining statuses agree with the deployed lookup. `docs/taxonomy-data-diff.json` records the code/status changes in the other regional lookups.

## Annual update

Cornell recommends [Taxon Concept IDs](https://www.birds.cornell.edu/clementschecklist/introduction/updateindex/october-2025/) to compare concepts across versions. A name/rank change may preserve an ID; a changed circumscription may require a new one. IDs are strings: source prefixes are normalized, but eight- and sixteen-character identifiers are not truncated or guessed equivalent.

Before replacing snapshots, retain the previous full crosswalk locally. Run the next workflow with `TAXONOMY_PREVIOUS_CROSSWALK=/path/to/old-crosswalk.json` to produce `concept-changes.csv`. `TAXONOMY_PREVIOUS_REGISTRY` optionally selects a different reviewed baseline; otherwise the tracked registry is used. Comparison flags missing/changed concepts, ambiguity, code/name/rank changes, reportability, and REPORT_AS changes. It does not infer split/lump relationships from similar names; changed concepts need upstream biological review.

The scheduled `check_taxonomy.yml` Action checks weekly and supports manual dispatch. It compares the latest API version with `data/taxonomy-version.json` and opens one marked review issue per new version, checking open and closed issues for duplicates. `npm run taxonomy:check-update` performs a read-only local check. The Action creates the issue and checklist; full downloads, concept comparison, regional review, and draft PR preparation remain the issue's workflow. It becomes active after merge to the default branch. It does not publish data, merge PRs, or create releases.

The current API version agrees with deployed code membership/order. `conceptCrosswalkReviewed` records completion of this crosswalk/mapping pass; unresolved source concepts remain listed in the registry. Observation-level season/location restrictions are retained in reports but are not yet enforced by the app's regional lookup.
