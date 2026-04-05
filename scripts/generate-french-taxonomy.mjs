import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import {
  fetchText,
  FRENCH_SPECIES_URL,
  normalizeScientificName,
  parseTaxonomyCsv,
  TAXONOMY_URL,
} from "./taxonomy-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const outputPath = resolve(rootDir, "data/french-rarity-taxonomy.json");

function extractFrenchSpeciesRows(html) {
  const tableMatch = html.match(
    /<div[^>]*id="species-modal"[\s\S]*?<div[^>]*class="modal-body"[^>]*>[\s\S]*?(<table[\s\S]*?<\/table>)/i,
  );

  if (!tableMatch) {
    throw new Error("French species page did not contain the expected modal table");
  }

  const tableHtml = tableMatch[1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  if (!rows.length) {
    throw new Error("French species table did not contain any rows");
  }

  const species = [];

  for (const [index, rowMatch] of rows.entries()) {
    if (index === 0) {
      continue;
    }

    const cells = [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) =>
      normalizeScientificName(match[1]),
    );

    if (cells.length >= 2 && cells.some((cell) => cell)) {
      species.push({
        commonName: cells[0],
        scientificName: cells[1],
      });
    }
  }

  return species;
}

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
    ["acanthis hornemanni", "hoared"],
    ["acanthis hornemanni exilipes", "hoared2"],
    ["acanthis hornemanni hornemanni", "hoared1"],
    ["arctic redpoll", "hoared"],
    ["arctic redpoll (exilipes)", "hoared2"],
    ["greenland arctic redpoll (hornemann's )", "hoared1"],
    ["buteo buteo vulpinus", "combuz5"],
    ["curruca curruca blythi", "leswhi2"],
    ["curruca curruca halimodendri/minula/margelanica", "leswhi1"],
    ["grey-headed swamphen", "purswa3"],
    ["ficedula hypoleuca iberiae/ficedula speculigera", "y00819"],
    ["hydrobates [castro, jabejabe, monteroi]", "oceano2"],
    ["lanius isabellinus/phoenicuroides", "rutshr1"],
    ["phoenicurus ochruros phoenicuroides", "blkred1"],
    ["porphyrio poliocephalus seistanicus", "purswa3"],
    ["pterodroma feae/madeira/deserta", "y00609"],
  ]);
}

async function main() {
  const taxonomyCsv = fetchText(TAXONOMY_URL);
  const frenchHtml = fetchText(FRENCH_SPECIES_URL);
  const { rows: taxonomyRows, get } = parseTaxonomyCsv(taxonomyCsv);
  const scientificLookup = buildScientificLookup(taxonomyRows, get);
  const commonLookup = buildCommonLookup(taxonomyRows, get);
  const manualAliasLookup = buildManualAliasLookup();
  const frenchSpecies = extractFrenchSpeciesRows(frenchHtml);
  const taxonomy = Object.create(null);
  const unmatchedRows = [];

  for (const row of frenchSpecies) {
    const speciesCode =
      scientificLookup.get(row.scientificName) ||
      commonLookup.get(row.commonName.toLowerCase()) ||
      manualAliasLookup.get(row.scientificName.toLowerCase()) ||
      manualAliasLookup.get(row.commonName.toLowerCase());

    if (speciesCode) {
      taxonomy[speciesCode] = 1;
      continue;
    }

    unmatchedRows.push(row);
  }

  if (unmatchedRows.length) {
    console.warn(`Warning: ${unmatchedRows.length} French species rows were not matched in eBird taxonomy.`);
    console.warn(
      unmatchedRows
        .map((row) => `${row.commonName} :: ${row.scientificName}`)
        .join("\n"),
    );
  }

  await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);

  console.log(`Wrote ${Object.keys(taxonomy).length} French rarity taxonomy rows to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
