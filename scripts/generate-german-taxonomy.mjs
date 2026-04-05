import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";

import {
  fetchText,
  GERMAN_CHECKLIST_PATH,
  normalizeScientificName,
  parseCsv,
  parseTaxonomyCsv,
  TAXONOMY_URL,
} from "./taxonomy-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const germanChecklistPath = resolve(rootDir, GERMAN_CHECKLIST_PATH);
const outputPath = resolve(rootDir, "data/german-taxonomy.json");

function normalizeLookupLabel(value) {
  return normalizeScientificName(value)
    .replace(/["“”]/g, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/\bgrey\b/g, "gray")
    .replace(/[-/]+/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildScientificLookup(rows, get) {
  const lookup = new Map();

  for (const row of rows) {
    const scientificName = normalizeLookupLabel(get(row, "SCIENTIFIC_NAME"));
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
    const commonName = normalizeLookupLabel(get(row, "COMMON_NAME"));
    const speciesCode = String(get(row, "SPECIES_CODE")).trim();

    if (!commonName || !speciesCode) {
      continue;
    }

    if (!lookup.has(commonName)) {
      lookup.set(commonName, speciesCode);
    }
  }

  return lookup;
}

function buildManualAliasLookup() {
  return new Map([
    [normalizeLookupLabel("Accipiter gentilis buteoides"), "norgos1"],
    [normalizeLookupLabel("Acanthis flammea rostrata"), "comred4"],
    [normalizeLookupLabel("Acanthis hornemanni"), "hoared"],
    [normalizeLookupLabel("Buteo buteo vulpinus"), "combuz5"],
    [normalizeLookupLabel("Emberiza schoeniclus tschusii"), "reebun"],
    [normalizeLookupLabel("Phoenicurus ochruros phoenicuroides"), "blkred1"],
    [normalizeLookupLabel("Sylvia curruca blythi / halimodendri"), "leswhi1"],
  ]);
}

function parseGermanChecklist(csvText) {
  const rows = parseCsv(csvText);
  const header = rows.shift();

  if (!header?.length) {
    throw new Error("German checklist did not include a header row");
  }

  const headerIndex = new Map(header.map((name, index) => [String(name).trim(), index]));
  const get = (row, key) => row[headerIndex.get(key)] ?? "";

  const normalizedRows = [];

  for (const row of rows) {
    const germanName = normalizeScientificName(get(row, "Deutscher Name"));
    const englishName = normalizeScientificName(get(row, "Englischer Name"));
    const scientificName = normalizeScientificName(get(row, "Wissenschaftlicher\nName"));

    if (!germanName && !englishName && scientificName && normalizedRows.length > 0) {
      const previous = normalizedRows[normalizedRows.length - 1];
      previous.scientificName = `${previous.scientificName} ${scientificName}`.trim();
      continue;
    }

    normalizedRows.push({
      germanName,
      englishName,
      scientificName,
    });
  }

  return { rows: normalizedRows, get };
}

async function main() {
  const taxonomyCsv = fetchText(TAXONOMY_URL);
  const germanCsv = await readFile(germanChecklistPath, "utf8");
  const { rows: taxonomyRows, get } = parseTaxonomyCsv(taxonomyCsv);
  const scientificLookup = buildScientificLookup(taxonomyRows, get);
  const commonLookup = buildCommonLookup(taxonomyRows, get);
  const manualAliasLookup = buildManualAliasLookup();
  const { rows: germanRows } = parseGermanChecklist(germanCsv);
  const taxonomy = Object.create(null);
  const unmatchedRows = [];

  for (const row of germanRows) {
    const scientificName = normalizeLookupLabel(row.scientificName);
    const commonName = normalizeLookupLabel(row.englishName);

    if (!scientificName) {
      continue;
    }

    const speciesCode =
      scientificLookup.get(scientificName) ||
      commonLookup.get(commonName) ||
      manualAliasLookup.get(scientificName) ||
      manualAliasLookup.get(commonName);

    if (!speciesCode) {
      unmatchedRows.push({ commonName, scientificName });
      continue;
    }

    taxonomy[speciesCode] = 1;
  }

  if (unmatchedRows.length) {
    console.warn(`Warning: ${unmatchedRows.length} German checklist rows were not matched in eBird taxonomy.`);
    console.warn(
      unmatchedRows
        .map((row) => `${row.commonName} :: ${row.scientificName}`)
        .join("\n"),
    );
  }

  await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);

  console.log(`Wrote ${Object.keys(taxonomy).length} German taxonomy rows to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
