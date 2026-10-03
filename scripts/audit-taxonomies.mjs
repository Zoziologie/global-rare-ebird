import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, parseTaxonomyCsv, fetchText, TAXONOMY_URL } from "./taxonomy-helpers.mjs";
import { manualEbirdScientificNameByAbaScientificName, normalizeScientificNameForMatch } from "./generate-aba-taxonomy.mjs";
import { extractFrenchSpeciesRows, buildManualAliasLookup as frenchAliases } from "./generate-french-taxonomy.mjs";
import { parseGermanChecklist, normalizeLookupLabel, buildManualAliasLookup as germanAliases } from "./generate-german-taxonomy.mjs";
import { parseSwissChecklist, buildManualAliasLookup as swissAliases } from "./generate-swiss-taxonomy.mjs";
import { auditTaxonMatch, indexTaxonNames, normalizeTaxonName, serializeAuditCsv } from "./taxonomy-audit-helpers.mjs";

// Read inputs ---------------------------------------------------------------
const root = fileURLToPath(new URL("../", import.meta.url));
const snapshotDir = resolve(root, "raw-data/taxonomy-review");
const outputDir = resolve(root, "output/taxonomy-review");
await mkdir(snapshotDir, { recursive: true });
await mkdir(outputDir, { recursive: true });
const manifestPath = resolve(snapshotDir, "snapshot.json");

// Only --fetch accesses the network. Subsequent audits reuse identical bytes.
if (process.argv.includes("--fetch")) {
  const versions = JSON.parse(fetchText("https://api.ebird.org/v2/ref/taxonomy/versions"));
  const version = versions.find((entry) => entry.latest).authorityVer;
  const taxonomyUrl = `${TAXONOMY_URL}?version=${version}&fmt=csv&locale=en`;
  const taxonomyText = fetchText(taxonomyUrl);
  parseTaxonomyCsv(taxonomyText);
  await writeFile(resolve(snapshotDir, "ebird.csv"), taxonomyText);
  await writeFile(manifestPath, JSON.stringify({ version, taxonomyUrl, retrievedAt: new Date().toISOString() }, null, 2) + "\n");
}
const snapshot = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceInputs = JSON.parse(await readFile(resolve(root, "taxonomy/source-inputs.json"), "utf8"));
const inputPaths = { ebird: "raw-data/taxonomy-review/ebird.csv", ...Object.fromEntries(Object.entries(sourceInputs).map(([source, input]) => [source, input.path])) };
const inputs = {};
const provenance = {};
for (const [source, path] of Object.entries(inputPaths)) {
  const bytes = await readFile(resolve(root, path));
  inputs[source] = bytes.toString("utf8");
  provenance[source] = { path, edition: sourceInputs[source]?.edition, sha256: createHash("sha256").update(bytes).digest("hex") };
}

// Expose taxonomy and regional rows ----------------------------------------
const { rows: taxonomyRows, get } = parseTaxonomyCsv(inputs.ebird);
const taxa = taxonomyRows.map((row) => ({
  code: get(row, "SPECIES_CODE"), scientificName: get(row, "SCIENTIFIC_NAME"),
  commonName: get(row, "COMMON_NAME"), category: get(row, "CATEGORY"),
  order: Number(get(row, "TAXON_ORDER")), reportAs: get(row, "REPORT_AS"),
}));
const taxaByCode = new Map(taxa.map((taxon) => [taxon.code, taxon]));
const scientificIndex = indexTaxonNames(taxa, "scientificName");
const commonIndex = indexTaxonNames(taxa, "commonName");
const { rows: swissRows, get: getSwiss } = parseSwissChecklist(inputs.ch);
const sources = {
  aba: parseCsv(inputs.aba).filter((row) => row[3] && /^\d+$/.test(row[5]?.trim())).map((row) => ({
    scientificName: row[3], commonName: row[1], status: Number(row[5]), restriction: "",
  })),
  fr: extractFrenchSpeciesRows(inputs.fr).map((row) => ({ ...row, status: 1, restriction: "Committee list; review identification groups and subspecies" })),
  de: parseGermanChecklist(inputs.de).rows.filter((row) => row.scientificName).map((row) => ({
    ...row, commonName: row.englishName, status: 1,
  })),
  ch: swissRows.filter((row) => getSwiss(row, "Species") && /^\d+$/.test(getSwiss(row, "S").trim())).map((row) => ({
    scientificName: getSwiss(row, "Species"), commonName: getSwiss(row, "English"), status: Number(getSwiss(row, "S")), restriction: "",
  })),
};
const aliases = { fr: frenchAliases(), de: germanAliases(), ch: swissAliases() };
const columns = ["source", "row", "scientificName", "commonName", "status", "restriction", "method", "candidateCodes", "targetScientificName", "targetCategory", "review"];
const reports = [];
const summary = { snapshot, provenance, taxonomyRows: taxa.length, sources: {}, outputs: {} };

// Match without collapsing ambiguous names or approving legacy aliases ------
for (const [source, rows] of Object.entries(sources)) {
  const report = rows.map((row, index) => {
    let legacyCode;
    if (source === "aba") {
      const aliasName = manualEbirdScientificNameByAbaScientificName.get(normalizeScientificNameForMatch(row.scientificName));
      legacyCode = aliasName ? (scientificIndex.get(aliasName) || []).map((taxon) => taxon.code).join("|") : undefined;
    } else {
      const normalize = source === "de" ? normalizeLookupLabel : normalizeTaxonName;
      legacyCode = aliases[source].get(normalize(row.scientificName)) || aliases[source].get(normalize(row.commonName));
    }
    const scientificName = source === "aba" ? normalizeScientificNameForMatch(row.scientificName) : row.scientificName;
    const match = auditTaxonMatch({ ...row, scientificName }, scientificIndex, commonIndex, legacyCode);
    const candidates = match.legacyCode ? match.legacyCode.split("|").map((code) => taxaByCode.get(code)).filter(Boolean) : match.candidates;
    const candidateCodes = match.legacyCode || candidates.map((taxon) => taxon.code).join("|");
    const review = [match.review];
    if (match.legacyCode && candidates.length !== match.legacyCode.split("|").length) review.push("obsolete-alias-code");
    if (candidates.some((taxon) => taxon.category !== "species")) review.push("non-species-policy");
    if (candidates.length === 1 && normalizeTaxonName(scientificName).split(" ").length > 2 && candidates[0].category === "species") review.push("possible-scope-broadening");
    return {
      source, row: index + 1, ...row, method: match.method, candidateCodes,
      targetScientificName: candidates.map((taxon) => taxon.scientificName).join("|"),
      targetCategory: candidates.map((taxon) => taxon.category).join("|"), review: review.filter(Boolean).join("|"),
    };
  });
  for (const row of report) {
    const duplicates = report.filter((other) => row.candidateCodes && other.candidateCodes === row.candidateCodes);
    if (duplicates.length > 1) row.review = [row.review, "duplicate-target", new Set(duplicates.map((other) => other.status)).size > 1 ? "conflicting-status" : ""].filter(Boolean).join("|");
  }
  await writeFile(resolve(outputDir, `${source}-matches.csv`), serializeAuditCsv(report, columns));
  summary.sources[source] = {
    rows: report.length,
    methods: Object.fromEntries(["scientific", "legacy-alias", "common", "none"].map((method) => [method, report.filter((row) => row.method === method).length])),
    needsReview: report.filter((row) => row.review).length,
  };
  reports.push(...report);
}

// Audit deployed codes and taxonomic order ---------------------------------
for (const file of ["taxo.json", "aba-taxonomy.json", "french-rarity-taxonomy.json", "german-taxonomy.json", "swiss-taxonomy.json"]) {
  const deployed = JSON.parse(await readFile(resolve(root, "data", file), "utf8"));
  const codes = Object.keys(deployed);
  summary.outputs[file] = {
    codes: codes.length, obsoleteCodes: codes.filter((code) => !taxaByCode.has(code)),
  };
  if (file === "taxo.json") {
    summary.outputs[file].missingCodes = taxa.filter((taxon) => !Object.hasOwn(deployed, taxon.code)).map((taxon) => taxon.code);
    summary.outputs[file].orderDifferences = taxa.filter((taxon) => Object.hasOwn(deployed, taxon.code) && deployed[taxon.code][0] !== taxon.order).length;
    summary.outputs[file].fractionalOrders = taxa.filter((taxon) => !Number.isInteger(taxon.order)).length;
  }
}
await writeFile(resolve(outputDir, "needs-review.csv"), serializeAuditCsv(reports.filter((row) => row.review), columns));
await writeFile(resolve(outputDir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`Local reports: ${outputDir}. No application lookup files were changed.`);
