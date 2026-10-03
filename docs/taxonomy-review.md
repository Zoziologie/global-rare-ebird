# Taxonomy review — issue #39

This is the first audit milestone for [#39](https://github.com/Zoziologie/global-rare-ebird/issues/39). The regeneration workflow, reviewed exceptions, and annual update Action are still to implement. The audit never writes application lookup files.

## Run linearly

1. Obtain the source CSVs listed below and put them in `raw-data/`. The existing generators require the same files.
2. Run `npm run audit:taxonomies -- --fetch` once to discover the latest eBird version and download that explicitly versioned CSV plus the French committee page.
3. Inspect `raw-data/taxonomy-review/snapshot.json` for the version, URLs, and retrieval time.
4. Run `npm run audit:taxonomies` to reuse those snapshots without network access.
5. Read `output/taxonomy-review/summary.json`, the four `*-matches.csv` files, and `needs-review.csv`.

The script exposes input tables, taxonomy indexes, regional rows, matches, and output comparisons in that order. It records SHA-256 hashes of the original bytes. Identical snapshots, CSVs, and deployed JSON produce identical reports. `--fetch` replaces the local snapshots; retain a copy before reviewing a different upstream version.

Both input snapshots and row reports are ignored by Git. In particular, the ABA checklist states that reproduction requires express written permission. Do not attach the entire ABA checklist or its full row report to a public issue/PR. A future Action needs a permitted deterministic source acquisition step before it can reproduce every regional mapping.

## Source inventory on 2026-10-03

| Source | Input | Version/date established from the input |
| --- | --- | --- |
| eBird | Versioned API CSV, English locale | API reports 2025 as latest; explicitly requested version 2025 |
| ABA | `raw-data/ABA_Checklist-8.19.csv` | Header: version 8.19, January 2026, 1,161 species; some nomenclature revised August 2025 |
| France | [CHN species page](https://www.chn-france.org/en/homologation/species/) | Snapshot retrieved 2026-10-03; no source version established |
| Germany | `raw-data/meldeliste_d_ab2023_sys.csv` | Filename indicates effective from 2023; verify document edition and subsequent changes |
| Switzerland | `raw-data/CH-Artliste_6.csv` | Edition/date not established; filename is insufficient evidence |

Local PDFs/XLSX files accompany the German and Swiss lists. Their source URLs, conversion steps, dates, current editions, and redistribution terms remain to establish. File modification dates are not treated as source versions.

## Audit results

The eBird snapshot contains **17,891 taxa**. Every deployed taxonomy/rarity code exists in it. `data/taxo.json` has identical code membership and taxonomic orders; this snapshot has no fractional orders. This confirms membership/order, not the biological correctness of regional rarity mappings.

| List | Source rows | Unique scientific matches | Legacy alias candidates | Common-name candidates | Unmatched | Rows needing review |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ABA | 1,161 | 1,154 | 7 | 0 | 0 | 7 |
| France | 248 | 226 | 12 | 7 | 3 | 32 |
| Germany | 223 | 208 | 7 | 5 | 3 | 21 |
| Switzerland | 414 | 386 | 7 | 21 | 0 | 28 |

**88 rows need review** under the deliberately conservative audit rules. Review reasons include aliases, common-name fallbacks, non-species categories, duplicate targets, status conflicts, and possible scope broadening. A flag is a review candidate, not proof of an error. ABA's documented parenthetical AOS nomenclature is removed for name comparison; its original text remains in the report. German subspecies restrictions and continuation rows are preserved.

Scientific names and common names are indexed to all candidates. Ambiguous names remain ambiguous; no first-match or fuzzy acceptance is used. The audit retains existing generator aliases as unapproved candidates, including their original codes. Common-name candidates also require review. It does not yet reconstruct every old generator decision or validate inherited statuses for every `REPORT_AS` child.

## Decisions to resolve before generation

- **Subspecies scope:** German Common Snipe, Lesser Spotted Woodpecker, and Bearded Reedling entries restrict the list to a subspecies, but common-name matching selects the entire species. Goshawk and Reed Bunting aliases also select species-level codes. A rare subspecies must not automatically mark every observation of its parent species rare.
- **Groups broader than source taxa:** several legacy redstart, whitethroat, buzzard, redpoll, and flycatcher mappings target groups broader than the committee entry. Review their precise membership before accepting them.
- **Splits and renamed taxa:** French pipit entries remain unmatched in the strict audit; German plover entries require review after genus/name changes. Use upstream change documentation, rather than assuming every similar name is equivalent.
- **Status propagation:** decide how accepted ABA statuses apply to `REPORT_AS` descendants. Do not inherit national status automatically across splits, hybrids, slash taxa, or unrelated subspecies.
- **Swiss meaning:** the UI calls status 4 “Rare”, while its own description says “recorded at least once but not since 1965”. Verify the official source definitions and current edition before adjusting labels or filters. Selecting the numerically highest conflicting status requires an explicit policy.
- **Observation meaning:** fetched observations come from eBird's `recent/notable` endpoint; committee membership and ABA occurrence codes are additional regional classifications. Membership alone does not establish that a particular observation meets season, location, or subspecies restrictions.

Next, record approved equivalences and unresolved cases in one small exception table with source/version/rationale, replace the separate generators with one linear workflow, and build the annual version-check Action around that same workflow. Keep the complete workstream in #39.
