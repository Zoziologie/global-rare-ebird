import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTaxonomyCsv } from "./taxonomy-helpers.mjs";
import { serializeAuditCsv } from "./taxonomy-audit-helpers.mjs";
import { buildConceptCrosswalk, compareConceptCrosswalks, parseConceptChecklist } from "./taxonomy-concepts.mjs";

// Read the matching-version snapshots --------------------------------------
const root = fileURLToPath(new URL("../", import.meta.url));
const snapshotDir = resolve(process.argv[3] || resolve(root, "raw-data/taxonomy-review"));
const outputDir = resolve(root, "output/taxonomy-review");
const previousPath = process.argv[4];
const manifest = JSON.parse(await readFile(resolve(snapshotDir, "snapshot.json"), "utf8"));
const checklistPath = resolve(process.argv[2] || resolve(snapshotDir, `clements-${manifest.version}-concepts.csv`));
const checklist = await readFile(checklistPath);
const taxonomy = await readFile(resolve(snapshotDir, "ebird.csv"));
const checklistHeader = checklist.toString("utf8").split(/\r?\n/, 1)[0];
const checklistVersion = checklistHeader.match(/sort[ _]v(\d{4})/i)?.[1];
if (!checklistVersion || Number(checklistVersion) !== manifest.version) throw new Error(`Checklist edition must match API version ${manifest.version}; found ${checklistVersion || "no versioned sort column"}`);
const { rows, get } = parseTaxonomyCsv(taxonomy.toString("utf8"));
const taxa = rows.map((row) => ({ code: get(row, "SPECIES_CODE"), category: get(row, "CATEGORY"), scientificName: get(row, "SCIENTIFIC_NAME"), reportAs: get(row, "REPORT_AS") }));

// Join by Cornell codes, never by similar names -----------------------------
const concepts = parseConceptChecklist(checklist.toString("utf8"));
const crosswalk = buildConceptCrosswalk(concepts, taxa);
const reportableCodes = new Set(crosswalk.filter((row) => row.reportable && row.avibaseId).map((row) => row.code));
const coverage = {};
for (const category of new Set(taxa.map((row) => row.category))) {
  const members = taxa.filter((row) => row.category === category);
  coverage[category] = { total: members.length, withConceptId: members.filter((row) => reportableCodes.has(row.code)).length };
}
const reportableCounts = new Map();
for (const row of crosswalk.filter((entry) => entry.reportable && entry.avibaseId)) {
  reportableCounts.set(row.avibaseId, (reportableCounts.get(row.avibaseId) || 0) + 1);
}
const ambiguousIds = [...reportableCounts].filter(([, count]) => count > 1).map(([id]) => id);
const summary = {
  version: manifest.version, checklistPath,
  checklistSha256: createHash("sha256").update(checklist).digest("hex"),
  taxonomySha256: createHash("sha256").update(taxonomy).digest("hex"),
  conceptRows: crosswalk.length, coverage, ambiguousReportableIds: ambiguousIds,
  missingReportableCodes: taxa.filter((row) => !reportableCodes.has(row.code)).map((row) => row.code),
};

// Write reviewable local artifacts -----------------------------------------
await mkdir(outputDir, { recursive: true });
const snapshot = { version: manifest.version, summary, rows: crosswalk };
await writeFile(resolve(outputDir, `crosswalk-${manifest.version}.json`), JSON.stringify(snapshot, null, 2) + "\n");
await writeFile(resolve(outputDir, "crosswalk.csv"), serializeAuditCsv(crosswalk, ["avibaseId", "originalAvibaseId", "code", "category", "scientificName", "commonName", "reportable", "ebirdCategory", "reportAs"]));
await writeFile(resolve(outputDir, "crosswalk-summary.json"), JSON.stringify(summary, null, 2) + "\n");
if (previousPath) {
  const previous = JSON.parse(await readFile(resolve(previousPath), "utf8"));
  const changes = compareConceptCrosswalks(previous.rows, crosswalk);
  await writeFile(resolve(outputDir, "concept-changes.csv"), serializeAuditCsv(changes, ["avibaseId", "oldCode", "newCode", "candidateCodes", "change", "oldScientificName", "newScientificName"]));
}
console.log(JSON.stringify(summary, null, 2));
