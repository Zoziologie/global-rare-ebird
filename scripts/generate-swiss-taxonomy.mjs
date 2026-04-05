import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

import {
  fetchText,
  normalizeScientificName,
  parseCsv,
  parseTaxonomyCsv,
  TAXONOMY_URL,
} from "./taxonomy-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const swissChecklistPath = resolve(rootDir, "raw-data/CH-Artliste_6.csv");
const outputPath = resolve(rootDir, "data/swiss-taxonomy.json");

function buildScientificLookup(rows, get) {
  const lookup = new Map();

  for (const row of rows) {
    const scientificName = normalizeScientificName(get(row, "SCIENTIFIC_NAME"));
    const speciesCode = String(get(row, "SPECIES_CODE")).trim();

    if (!scientificName || !speciesCode) {
      continue;
    }

    if (!lookup.has(scientificName)) {
      lookup.set(scientificName, speciesCode);
    }
  }

  return lookup;
}

function buildCommonLookup(rows, get) {
  const lookup = new Map();

  for (const row of rows) {
    const commonName = normalizeScientificName(get(row, "COMMON_NAME")).toLowerCase();
    const speciesCode = String(get(row, "SPECIES_CODE")).trim();

    if (!commonName || !speciesCode) {
      continue;
    }

    if (!lookup.has(commonName)) {
      lookup.set(commonName, speciesCode);
    }

    const strippedCommonName = commonName.replace(/\s*\([^)]*\)\s*$/g, "").trim();
    if (strippedCommonName && !lookup.has(strippedCommonName)) {
      lookup.set(strippedCommonName, speciesCode);
    }
  }

  return lookup;
}

function buildManualAliasLookup() {
  return new Map([
    ["accipiter gentilis", "norgos1"],
    ["bubulcus ibis", "categr1"],
    ["cattle egret", "categr1"],
    ["common little bittern", "litbit1"],
    ["common whitethroat", "grewhi1"],
    ["columba livia f. domestica", "rocpig1"],
    ["feral pigeon", "rocpig1"],
    ["ixobrychus minutus", "litbit1"],
    ["northern goshawk", "norgos1"],
    ["phylloscopus tristis", "comchi4"],
    ["siberian chiffchaff", "comchi4"],
    ["subalpine warbler", "subwar1"],
    ["sylvia cantillans", "subwar1"],
    ["sylvia communis", "grewhi1"],
  ]);
}

function parseSwissChecklist(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift();

  if (!header?.length) {
    throw new Error("Swiss checklist did not include a header row");
  }

  const headerIndex = new Map(header.map((name, index) => [String(name).trim(), index]));
  const get = (row, key) => row[headerIndex.get(key)] ?? "";

  return { rows, get };
}

function parseStatus(value) {
  const status = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(status) ? status : null;
}

async function main() {
  const taxonomyCsv = fetchText(TAXONOMY_URL);
  const swissCsv = await readFile(swissChecklistPath, "utf8");
  const { rows: taxonomyRows, get } = parseTaxonomyCsv(taxonomyCsv);
  const scientificLookup = buildScientificLookup(taxonomyRows, get);
  const commonLookup = buildCommonLookup(taxonomyRows, get);
  const manualAliasLookup = buildManualAliasLookup();
  const { rows: swissRows, get: getSwiss } = parseSwissChecklist(swissCsv);
  const taxonomy = Object.create(null);
  const unmatchedRows = [];
  const duplicateRows = [];

  for (const row of swissRows) {
    const scientificName = normalizeScientificName(getSwiss(row, "Species"));
    const commonName = normalizeScientificName(getSwiss(row, "English"));
    const status = parseStatus(getSwiss(row, "S"));

    if (!scientificName || status === null) {
      continue;
    }

    const speciesCode =
      scientificLookup.get(scientificName) ||
      commonLookup.get(commonName.toLowerCase()) ||
      manualAliasLookup.get(scientificName.toLowerCase()) ||
      manualAliasLookup.get(commonName.toLowerCase());

    if (!speciesCode) {
      unmatchedRows.push({ commonName, scientificName, status });
      continue;
    }

    const existingStatus = taxonomy[speciesCode] || 1;

    if (existingStatus > 1 && status > 1 && existingStatus !== status) {
      duplicateRows.push({
        commonName,
        scientificName,
        speciesCode,
        existing: existingStatus,
        status,
      });
    }

    if (status > existingStatus) {
      taxonomy[speciesCode] = status;
    }
  }

  if (duplicateRows.length) {
    console.warn(`Warning: ${duplicateRows.length} Swiss species rows mapped to duplicate eBird codes.`);
    console.warn(
      duplicateRows
        .map(
          (row) =>
            `${row.scientificName} :: ${row.commonName} :: ${row.speciesCode} (${row.existing} -> ${row.status})`,
        )
        .join("\n"),
    );
  }

  if (unmatchedRows.length) {
    console.warn(`Warning: ${unmatchedRows.length} Swiss species rows were not matched in eBird taxonomy.`);
    console.warn(
      unmatchedRows
        .map((row) => `${row.commonName} :: ${row.scientificName} :: ${row.status}`)
        .join("\n"),
    );
  }

  await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);

  console.log(`Wrote ${Object.keys(taxonomy).length} Swiss taxonomy rows to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
