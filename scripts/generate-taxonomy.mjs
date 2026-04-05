import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

import { fetchText, parseTaxonomyCsv, TAXONOMY_URL } from "./taxonomy-helpers.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const outputPath = resolve(rootDir, "data/taxo.json");

function encodeTaxonomyEntry({ tax, category }) {
  const entry = [tax];

  if (category && category !== "species") {
    entry.push(category);
  }

  return entry;
}

async function main() {
  const taxonomyCsv = fetchText(TAXONOMY_URL);
  const { rows: taxonomyRows, get } = parseTaxonomyCsv(taxonomyCsv);
  const taxonomy = Object.create(null);

  for (const row of taxonomyRows) {
    const cod = String(get(row, "SPECIES_CODE")).trim();
    if (!cod) {
      continue;
    }

    const tax = Number.parseFloat(String(get(row, "TAXON_ORDER")).trim());
    const category = String(get(row, "CATEGORY")).trim() || "species";

    taxonomy[cod] = encodeTaxonomyEntry({
      tax: Number.isFinite(tax) ? Math.trunc(tax) : 9999,
      category,
    });
  }

  await writeFile(outputPath, `${JSON.stringify(taxonomy)}\n`);

  console.log(`Wrote ${Object.keys(taxonomy).length} taxonomy rows to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
