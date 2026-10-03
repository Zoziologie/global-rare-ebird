import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./taxonomy-helpers.mjs";
import { indexTaxonNames, normalizeTaxonName, serializeAuditCsv } from "./taxonomy-audit-helpers.mjs";
import { normalizeScientificNameForMatch } from "./generate-aba-taxonomy.mjs";
import { normalizeAvibaseId, resolveReviewedConcept } from "./taxonomy-concepts.mjs";

// Read the concept snapshot, audit tables, and explicit review decisions -----
const root = fileURLToPath(new URL("../", import.meta.url));
const outputDir = resolve(root, "output/taxonomy-review");
const version = JSON.parse(await readFile(resolve(root, "raw-data/taxonomy-review/snapshot.json"), "utf8")).version;
const crosswalk = JSON.parse(await readFile(resolve(outputDir, `crosswalk-${version}.json`), "utf8"));
const scientificIndex = indexTaxonNames(crosswalk.rows.filter((row) => row.avibaseId), "scientificName");
const decisions = JSON.parse(await readFile(resolve(root, "taxonomy/mapping-decisions.json"), "utf8"));
const audit = JSON.parse(await readFile(resolve(outputDir, "summary.json"), "utf8"));
const reports = [];
const mappings = [];

// Reuse accepted concepts; match names only for new or still-unreviewed rows --
const previousPath = process.argv[2] || resolve(root, "taxonomy/accepted-mappings.json");
const previous = JSON.parse(await readFile(resolve(previousPath), "utf8"));
for (const source of ["aba", "fr", "de", "ch"]) {
  const [header, ...rows] = parseCsv(await readFile(resolve(outputDir, `${source}-matches.csv`), "utf8"));
  for (const cells of rows) {
    const row = Object.fromEntries(header.map((field, index) => [field, cells[index]]));
    const sourceKey = createHash("sha256").update(JSON.stringify([source, normalizeTaxonName(row.scientificName), normalizeTaxonName(row.commonName), row.restriction])).digest("hex");
    const rowDecision = decisions.find((entry) => entry.source === source && entry.sourceKey === sourceKey);
    const targetDecisions = rowDecision?.targets ? rowDecision.targets.map((target) => ({ ...rowDecision, ...target })) : [rowDecision];
    for (const decision of targetDecisions) {
      const retained = previous.rows.find((entry) => entry.source === source && entry.sourceKey === sourceKey && (!decision?.avibaseId || entry.avibaseId === normalizeAvibaseId(decision.avibaseId)) && ["accepted", "unresolved"].includes(entry.decision));
      const scientificName = source === "aba" ? normalizeScientificNameForMatch(row.scientificName) : row.scientificName;
      const candidates = scientificIndex.get(normalizeTaxonName(scientificName)) || [];
      const ids = [...new Set(candidates.map((entry) => entry.avibaseId))];
      const avibaseId = decision?.avibaseId ? normalizeAvibaseId(decision.avibaseId) : retained?.avibaseId || (ids.length === 1 ? ids[0] : "");
      const resolution = avibaseId ? resolveReviewedConcept({ avibaseId }, crosswalk.rows) : { review: ids.length > 1 ? "ambiguous-concept" : "unmatched-concept", codes: [] };
      const disposition = decision?.decision || retained?.decision || (resolution.review === "nonreportable-concept" ? "unresolved" : !previous.rows.length && ids.length === 1 && !resolution.review ? "accepted" : "proposed");
      // Exact unique scientific matches initialize the baseline. Exceptions are explicit.
      const currentTaxon = crosswalk.rows.find((entry) => entry.code === resolution.codes[0] && entry.reportable);
      let review = disposition === "unresolved" ? "explicitly-unresolved" : resolution.review || (disposition !== "accepted" ? "baseline-review" : "");
      const approvedChange = decision?.reviewedTaxonomySha256 === crosswalk.summary.taxonomySha256 && decision?.reviewedSourceSha256 === audit.provenance[source].sha256;
      if (retained && !approvedChange && disposition !== "unresolved" && retained.status !== Number(row.status)) review = "source-status-changed";
      if (retained && !approvedChange && disposition !== "unresolved" && (retained.category !== currentTaxon?.ebirdCategory || retained.reportAs !== currentTaxon?.reportAs)) review = "category-or-report-as-changed";
      if (decision && !decision.reason) throw new Error(`Missing rationale for decision ${source}:${sourceKey}`);
      if (!["accepted", "unresolved", "proposed"].includes(disposition)) throw new Error(`Unknown mapping decision: ${disposition}`);
      const mapping = {
        source, sourceKey, avibaseId, component: decision?.component || retained?.component || "", sourceVersionSha256: audit.provenance[source].sha256,
        status: Number(row.status), restriction: row.restriction, decision: disposition,
        code: resolution.codes.length === 1 ? resolution.codes[0] : "", review,
        category: currentTaxon?.ebirdCategory || "", reportAs: currentTaxon?.reportAs || "",
        reason: decision?.reason || retained?.reason || (disposition === "unresolved" ? "User policy: retain an exact nonreportable concept as unresolved; never assign its parent species." : disposition === "accepted" ? "Initial unique scientific-name concept match; no fuzzy or common-name acceptance." : ""),
      };
      mappings.push(mapping);
      reports.push({ ...row, ...mapping, component: decision?.component || retained?.component || "", candidateIds: ids.join("|"), legacyCandidateCodes: row.candidateCodes, candidateCodes: resolution.codes.join("|") });
    }
  }
}

// Save proposed/retained bindings and a focused review queue -----------------
await writeFile(resolve(outputDir, "concept-mappings.json"), JSON.stringify({ version, taxonomySha256: crosswalk.summary.taxonomySha256, rows: mappings }, null, 2) + "\n");
await writeFile(resolve(outputDir, "removed-regional-rows.json"), JSON.stringify(previous.rows.filter((old) => !mappings.some((row) => row.source === old.source && row.sourceKey === old.sourceKey && row.avibaseId === old.avibaseId)), null, 2) + "\n");
const columns = ["source", "row", "sourceKey", "scientificName", "commonName", "component", "status", "restriction", "avibaseId", "candidateIds", "code", "candidateCodes", "legacyCandidateCodes", "decision", "review", "reason"];
await writeFile(resolve(outputDir, "concept-matches.csv"), serializeAuditCsv(reports, columns));
await writeFile(resolve(outputDir, "concept-review.csv"), serializeAuditCsv(reports.filter((row) => row.review), columns));
console.log(JSON.stringify(Object.fromEntries(["aba", "fr", "de", "ch"].map((source) => {
  const rows = mappings.filter((row) => row.source === source);
  return [source, { sourceRows: new Set(rows.map((row) => row.sourceKey)).size, bindings: rows.length, accepted: rows.filter((row) => !row.review).length, unresolved: rows.filter((row) => row.decision === "unresolved").length, needsReview: rows.filter((row) => row.decision === "proposed" || row.decision === "accepted" && row.review).length }];
})), null, 2));
console.log("Review initial exact matches and the exception queue in concept-matches.csv before publishing generated data.");
