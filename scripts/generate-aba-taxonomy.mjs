import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

import {
  ABA_CHECKLIST_PATH,
  fetchText,
  parseCsv,
  parseTaxonomyCsv,
  TAXONOMY_URL,
  normalizeScientificName,
} from "./taxonomy-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const abaChecklistPath = resolve(rootDir, ABA_CHECKLIST_PATH);
const outputPath = resolve(rootDir, "data/aba-taxonomy.json");

function buildAbaLookup(rows) {
  const lookup = new Map();
  const sourceByEbirdScientificName = new Map();

  for (const row of rows) {
    const scientificName = normalizeScientificNameForMatch(row[3]);
    const abaValue = Number.parseInt(String(row[5] || "").trim(), 10);
    const ebirdScientificName = manualEbirdScientificNameByAbaScientificName.get(scientificName) ?? scientificName;

    if (!scientificName || !Number.isFinite(abaValue)) {
      continue;
    }

    lookup.set(ebirdScientificName, abaValue);
    sourceByEbirdScientificName.set(ebirdScientificName, scientificName);
  }

  return { lookup, sourceByEbirdScientificName };
}

function normalizeScientificNameForMatch(value) {
  return normalizeScientificName(value)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const manualEbirdScientificNameByAbaScientificName = new Map([
  ["dryobates borealis", "leuconotopicus borealis"],
  ["dryobates villosus", "leuconotopicus villosus"],
  ["dryobates albolarvatus", "leuconotopicus albolarvatus"],
  ["dryobates arizonae", "leuconotopicus arizonae"],
  ["milvago chimachima", "daptrius chimachima"],
  ["coccothraustes vespertinus", "hesperiphona vespertina"],
  ["basileuterus lachrymosus", "euthlypis lachrymosa"],
]);

async function main() {
  const taxonomyCsv = fetchText(TAXONOMY_URL);
  const abaCsv = await readFile(abaChecklistPath, "utf8");
  const { rows: taxonomyRows, get } = parseTaxonomyCsv(taxonomyCsv);
  const abaRows = parseCsv(abaCsv);
  const { lookup: abaLookup, sourceByEbirdScientificName } = buildAbaLookup(abaRows);
  const entriesByCode = new Map();
  const directAbaByCode = new Map();
  const resolvedAbaByCode = new Map();
  const matchedAbaScientificNames = new Set();

  for (const row of taxonomyRows) {
    const cod = String(get(row, "SPECIES_CODE")).trim();
    if (!cod) {
      continue;
    }

    const scientificName = normalizeScientificNameForMatch(get(row, "SCIENTIFIC_NAME"));
    const category = String(get(row, "CATEGORY")).trim().toLowerCase();
    const reportAsCode = String(get(row, "REPORT_AS")).trim().toLowerCase();
    const aba = abaLookup.get(scientificName) ?? null;

    entriesByCode.set(cod, {
      cod,
      category,
      reportAsCode,
      scientificName,
    });

    if (aba !== null && aba !== undefined) {
      directAbaByCode.set(cod, aba);
      if (aba > 1) {
        resolvedAbaByCode.set(cod, aba);
      }

      const sourceScientificName = sourceByEbirdScientificName.get(scientificName);
      if (sourceScientificName) {
        matchedAbaScientificNames.add(sourceScientificName);
      }
    }
  }

  const resolving = new Set();
  const resolveAbaForCode = (code) => {
    if (resolvedAbaByCode.has(code)) {
      return resolvedAbaByCode.get(code);
    }

    if (resolving.has(code)) {
      return null;
    }

    resolving.add(code);

    const directAba = directAbaByCode.get(code);
    if (directAba !== undefined) {
      resolving.delete(code);
      return directAba;
    }

    const entry = entriesByCode.get(code);
    if (entry?.category === "issf" && entry.reportAsCode) {
      const parentAba = resolveAbaForCode(entry.reportAsCode);
      if (parentAba !== null && parentAba !== undefined) {
        resolving.delete(code);
        return parentAba;
      }
    }

    resolving.delete(code);
    return null;
  };

  const taxonomy = Object.create(null);
  for (const code of entriesByCode.keys()) {
    const aba = resolveAbaForCode(code);
    if (aba !== null && aba !== undefined && aba > 1) {
      taxonomy[code] = aba;
    }
  }

  const missingAbaNames = abaRows
    .map((row) => {
      const scientificName = normalizeScientificNameForMatch(row[3]);
      const abaValue = Number.parseInt(String(row[5] || "").trim(), 10);

      return scientificName && Number.isFinite(abaValue) ? scientificName : null;
    })
    .filter(Boolean)
    .filter((name) => !matchedAbaScientificNames.has(name))
    .filter((name, index, array) => array.indexOf(name) === index);

  if (missingAbaNames.length) {
    console.warn(`Warning: ${missingAbaNames.length} ABA scientific names were not matched in eBird taxonomy.`);
    console.warn(missingAbaNames.join(", "));
  }

  await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);

  console.log(
    `Wrote ${Object.keys(taxonomy).length} ABA taxonomy rows to ${outputPath}${matchedAbaScientificNames.size ? ` (${matchedAbaScientificNames.size} scientific-name matches)` : ""}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
