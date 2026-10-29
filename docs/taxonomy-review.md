# Taxonomy review — issues #39 and #72

The eBird 2026 update is tracked in [issue #72](https://github.com/Zoziologie/global-rare-ebird/issues/72) and [PR #73](https://github.com/Zoziologie/global-rare-ebird/pull/73). All 11 changed regional bindings have been reviewed and the application lookups regenerated. Seven older source entries remain explicitly unresolved: two French entries and five German entries. The original Avibase workflow and Swiss 2026 status definitions were introduced in [issue #39](https://github.com/Zoziologie/global-rare-ebird/issues/39) and [PR #42](https://github.com/Zoziologie/global-rare-ebird/pull/42).

## Run linearly

Requires Node.js, `uv`, curl, unzip, and Poppler (`pdftotext`). Run `uv sync` once to install the locked Python environment; the refresh command uses it to run the German checklist extraction.

1. Check the publishers for new regional editions and update `taxonomy/source-inputs.json` if needed. Run `npm run taxonomy:refresh-sources` to download and convert the specified official inputs. Inspect PDFs and CSV counts after changing an edition.
2. Run `npm run audit:taxonomies -- --fetch` to discover the latest eBird version and download its explicitly versioned English API CSV. This replaces local API snapshots; retain previous snapshots first.
3. Obtain the same-year Cornell integrated checklist or extract the eBird workbook as described below. Record the reviewed source path and checksums in `taxonomy/concept-source.json`, which supplies the default crosswalk input. For an unreviewed candidate, set `TAXONOMY_CONCEPT_CHECKLIST` to its CSV path. The original 2025 integrated file was found in another local project after Cornell downloads returned HTTP 403.
4. Run `npm run taxonomy:update` offline. Stages run top-to-bottom: source audit, versioned code/concept crosswalk, persistent regional matching, local JSON generation. Each stage also has a separate npm command.
5. Inspect `output/taxonomy-review/crosswalk-summary.json`, `concept-matches.csv`, `concept-review.csv`, and `generation-summary.json`. Local generated lookups are in `output/taxonomy-review/generated/`.
6. Record exceptions in `taxonomy/mapping-decisions.json` with source key, exact Avibase ID, accepted/unresolved disposition, reason, and evidence. Run the workflow again. Proposed or invalid accepted rows block generation. Explicit unresolved rows are retained in the report and omitted from app lookups.
7. Review the proposed app diff before running `npm run generate:taxonomies` (equivalent to `taxonomy:update --write`). Inheritance policy is recorded in `taxonomy/status-policy.json`. Update `taxonomy/accepted-mappings.json` from the reviewed local registry only after inspecting all changes. Commit the baseline, summaries, app data, version, and changelog together in the PR.

Raw files and full row reports are ignored. In particular, the ABA source prohibits redistribution without express written permission. Do not attach the whole checklist or full row report to a public issue. The tracked registry contains identifiers, statuses, restrictions, hashes, and rationale; it omits the full source name table.

## Using the 2026 five-tab eBird workbook

The user-supplied `eBird_Taxonomy_v2026_5-tab_27Oct2026.xlsx` can supply the reportable concept crosswalk while Cornell's integrated checklist is unavailable. Its `Sparse` sheet includes `bio_concept_code` Avibase IDs. The extractor checks the `Fleshed` sheet's authority version against the local API snapshot, preserves the original IDs, and records workbook/CSV SHA-256 hashes alongside the extracted CSV. The workbook is read without modification.

After retaining the previous crosswalk and fetching the new API snapshot, run:

```sh
uv sync --locked
uv run --locked python scripts/extract-ebird-concepts.py /path/to/eBird_Taxonomy_v2026_5-tab_27Oct2026.xlsx
TAXONOMY_CONCEPT_CHECKLIST=raw-data/taxonomy-review/ebird-2026-concepts.csv \
  TAXONOMY_PREVIOUS_CROSSWALK=output/taxonomy-review/crosswalk-2025.json \
  npm run taxonomy:update
```

`TAXONOMY_CONCEPT_CHECKLIST` overrides the concept CSV input for the complete workflow; omitting it uses the reviewed path in `taxonomy/concept-source.json`. The 2026 workbook matches all 18,631 API codes, categories, scientific names, and primary common names, with 100% concept-ID coverage and no ambiguous reportable IDs. The crosswalk takes REPORT_AS from the API, whose empty/self-parent conventions differ from the workbook.

This workbook contains reportable taxa only. Comparison with the 2025 integrated crosswalk cannot establish disappearance of a nonreportable subspecies. Existing explicit unresolved decisions stay unresolved, and new nonreportable matches require the integrated checklist or separate concept evidence. Do not approve a same-name replacement when its concept ID has changed.

All 11 flagged 2026 bindings have been reviewed: six ABA, two French, one German, and two Swiss. The accepted registry and application data now use eBird 2026. The seven previously explicit unresolved entries remain unresolved. See `docs/taxonomy-2026-review.json` for provenance, complete reportable coverage, and the accepted targets for each reviewed row; `docs/taxonomy-data-diff.json` compares the regenerated data against 2025.

The decisions preserve regional scope:

- Willet: the old concept becomes the Saltmarsh/Prairie slash. France also includes both daughter species explicitly. ABA retains both species at its existing default code 1. The same explicit treatment covers both ABA Marsh Wren species and their combined slash.
- Great Horned Owl and Tufted Flycatcher: [ABA's 2026 review](https://www.aba.org/2026-checklist-redux/) identifies the relevant North American concepts. Tawny Tufted-Flycatcher retains ABA code 4; Lemon-bellied Tufted-Flycatcher and its groups do not inherit it.
- Spotted Flycatcher and European Robin: retain each exact pre-split concept as its new slash. ABA also maps the recorded restricted species to code 5. The [Alaska checklist](https://americanornithologistsunion.org/bulletin/Withrow_et_al_2025_Bull_Amer_Ornithol_Union_Birds_of_Alaska.pdf) identifies Spotted Flycatcher neumanni; the [ABA committee report](https://www.birdpop.org/docs/pubs/Pyle_et_al_2018_29th_Report_of_the_ABA_Checklist_Committee.pdf) documents European Robin. No new ABA code is inferred for Mediterranean Flycatcher or Canary Islands Robin. Swiss status 1 is retained on the exact combined concepts; the old Swiss rows do not establish separate occurrence-period statuses for the daughter species.
- Little Swift: [the former species](https://avibase.bsc-eoc.org/species.jsp?avibaseid=D209A90C) comprises the affinis group, bannermani, and singalensis. France and Germany map these three retained reportable concepts explicitly. The new full species and House group are excluded because they include populations outside the source scope.

Generation has zero pending mappings. Regenerated lookups contain 18,631 eBird, 1,080 ABA, 254 French, 223 German, and 137 Swiss codes. Regional source editions remain those checked on 2026-10-03; this review updates their mapping into the new eBird taxonomy, not the publishers' underlying rarity decisions.

## Latest official inputs, checked 2026-10-03

| Source | Official edition | Parsed rows |
| --- | --- | ---: |
| [ABA](https://www.aba.org/aba-checklist/) | 8.19, January 2026; identical to the existing local input | 1,161 |
| [France CHN](https://www.chn-france.org/en/homologation/species/) | Current page; 2026 removals reflected | 248 |
| [Germany DDA](https://www.dda-web.de/dak/meldebogen) | Effective 2023-01-01; published for 2023–2026; PDF identical to existing input | 223 |
| [Swiss committee](https://www.vogelwarte.ch/de/forschen/monitoring/schweizerische-avifaunistische-kommission/) | PDF titled 2026, despite its older URL; 433 numeric-status rows and 6 rows without S status | 433 |

Download/conversion provenance is in `docs/taxonomy-source-provenance.json`; normalized input hashes and the legacy audit are in `docs/taxonomy-audit-summary.json`. Germany's 223 names and restrictions agree with the old CSV. Switzerland previously had 414 rows; current occurrence periods are 2015–2024 and 1975–2024. The UI now uses these periods and labels status 4 “Historical”.

## Historical 2025 concept coverage and review

The 2025 integrated file contains 35,853 coded rows. Joining by exact Cornell code to the API gives **100% concept-ID coverage** for all 17,891 reportable taxa: species 11,167; issf 3,952; slash 1,035; hybrid 792; spuh 722; form 156; domestic 25; intergrade 42. No ID maps to multiple reportable codes in this snapshot. The current 2026 summary is in `docs/taxonomy-crosswalk-summary.json`.

| Source | Accepted bindings | Explicit unresolved | Pending proposals |
| --- | ---: | ---: | ---: |
| ABA | 1,161 | 0 | 0 |
| France | 250 | 2 | 0 |
| Germany | 221 | 5 | 0 |
| Switzerland | 433 | 0 | 0 |

The initial baseline uses unique exact scientific-name concepts. These initial matches are automatic, not individually certified biological reviews. Forty-two explicit decisions record nomenclature exceptions and reviewed group mappings. The unresolved subspecies were checked against reportable eBird issf, form, slash, and other group taxa; where a reportable group clearly included the listed population, the exact group was accepted. The seven unresolved rows are listed in [taxonomy-unresolved.csv](taxonomy-unresolved.csv). Fuzzy and common-name candidates are never automatically accepted. A nonreportable subspecies remains unresolved when the only available eBird code is the full parent species or a broader group without a defensible scope match. The Eastern Lesser Whitethroat approximation uses the reportable curruca/blythi group (which also includes nominate curruca), as approved by the user. The reportable whbwoo9, grgshr2, blkred1, combuz5, and comred4 concepts cover the named White-backed Woodpecker, Great Grey Shrike, Eastern Black Redstart, Steppe Buzzard, and Greenland Redpoll populations respectively. The French Buff-bellied Pipit entry uses the Siberian/American Pipit slash (japonicus/rubescens), including the already rare Siberian taxon. The Siberian/American Pipit slash includes rubescens; the Sand-Plover decision includes both species and their slash taxon. Iberian Pied Flycatcher, Grey-headed Swamphen seistanicus, Faroe Snipe, Goshawk buteoides, Lesser Spotted Woodpecker minor, Bearded Reedling russicus, and Reed Bunting tschusii remain unresolved because no suitable reportable subspecies/group mapping is available.

The baseline retains exact Avibase IDs on subsequent runs. New regional rows become proposals even if their names match uniquely. Changes in source status, reportability, category, or REPORT_AS require review; persistent alias decisions cannot silently approve them. To explicitly approve a flagged status/category change, add `reviewedTaxonomySha256` and `reviewedSourceSha256` to the decision using the inspected current report hashes. Conflicting statuses for the same code block generation rather than selecting a numeric maximum.

**ABA policy:** the user approved inheritance of species-level ABA status only to reportable `issf` groups through REPORT_AS. Explicit group status takes precedence. Hybrids, slash taxa, and nonreportable subspecies do not inherit. `aba-inheritance.json` records each inherited code and its parent concept; default status 1 is omitted from compact lookups. The regenerated ABA lookup has 1,063 codes: 15 domestic/form entries previously reached through scientific-name matching are omitted because they are neither the listed species concept nor an approved issf inheritance. The remaining statuses agree with the deployed lookup. `docs/taxonomy-data-diff.json` records the code/status changes in the other regional lookups.

## Annual update

Cornell recommends [Taxon Concept IDs](https://www.birds.cornell.edu/clementschecklist/introduction/updateindex/october-2025/) to compare concepts across versions. A name/rank change may preserve an ID; a changed circumscription may require a new one. IDs are strings: source prefixes are normalized, but eight- and sixteen-character identifiers are not truncated or guessed equivalent.

Before replacing snapshots, retain the previous full crosswalk locally. Run the next workflow with `TAXONOMY_PREVIOUS_CROSSWALK=/path/to/old-crosswalk.json` to produce `concept-changes.csv`. `TAXONOMY_PREVIOUS_REGISTRY` optionally selects a different reviewed baseline; otherwise the tracked registry is used. Comparison flags missing/changed concepts, ambiguity, code/name/rank changes, reportability, and REPORT_AS changes. It does not infer split/lump relationships from similar names; changed concepts need upstream biological review.

The scheduled `check_taxonomy.yml` Action checks on the first day of each month at 08:17 UTC and supports manual dispatch. It compares the latest API version with `data/taxonomy-version.json` and opens one marked review issue per new version, checking open and closed issues for duplicates. `npm run taxonomy:check-update` performs a read-only local check. The Action creates the issue and checklist; full downloads, concept comparison, regional review, and draft PR preparation remain the issue's workflow. It becomes active after merge to the default branch. It does not publish data, merge PRs, or create releases.

The current API version agrees with deployed code membership/order. `conceptCrosswalkReviewed` records completion of this crosswalk/mapping pass; unresolved source concepts remain listed in the registry. Observation-level season/location restrictions are retained in reports but are not yet enforced by the app's regional lookup.
