import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTaxonomyCsv } from "./taxonomy-helpers.mjs";
import { buildRegionalLookups } from "./taxonomy-concepts.mjs";

// Read reviewed mappings from the preceding linear stages -------------------
const root = fileURLToPath(new URL("../", import.meta.url));
const reviewDir = resolve(root, "output/taxonomy-review");
const registry = JSON.parse(await readFile(resolve(reviewDir, "concept-mappings.json"), "utf8"));
const crosswalk = JSON.parse(await readFile(resolve(reviewDir, `crosswalk-${registry.version}.json`), "utf8"));
if (crosswalk.summary.missingReportableCodes.length || crosswalk.summary.ambiguousReportableIds.length) throw new Error("Crosswalk coverage or reportable concept ambiguity requires review before generation.");
const pending = registry.rows.filter((row) => row.decision !== "unresolved" && (row.decision !== "accepted" || row.review));
if (pending.length) throw new Error(`${pending.length} rows still need review. Inspect concept-matches.csv and record accepted IDs or explicit unresolved decisions before generation.`);
const taxonomy = await readFile(resolve(root, "raw-data/taxonomy-review/ebird.csv"));
if (registry.taxonomySha256 !== crosswalk.summary.taxonomySha256 || registry.taxonomySha256 !== createHash("sha256").update(taxonomy).digest("hex")) throw new Error("Mapping registry, crosswalk, and API snapshot must have matching checksums; rerun taxonomy:update.");
const policy = JSON.parse(await readFile(resolve(root, "taxonomy/status-policy.json"), "utf8"));
if (process.argv.includes("--write") && policy.abaIssfInheritance === "pending") throw new Error("ABA issf inheritance policy is pending user review; production data cannot be written yet.");
const { rows, get } = parseTaxonomyCsv(taxonomy.toString("utf8"));
const outputDir = process.argv.includes("--write") ? resolve(root, "data") : resolve(reviewDir, "generated");
const outputs = { "taxo.json": {}, "aba-taxonomy.json": {}, "french-rarity-taxonomy.json": {}, "german-taxonomy.json": {}, "swiss-taxonomy.json": {} };
const files = { aba: "aba-taxonomy.json", fr: "french-rarity-taxonomy.json", de: "german-taxonomy.json", ch: "swiss-taxonomy.json" };

// Preserve eBird order and exact accepted concept scope ---------------------
for (const row of rows) {
  const category = get(row, "CATEGORY");
  outputs["taxo.json"][get(row, "SPECIES_CODE")] = category === "species" ? [Number(get(row, "TAXON_ORDER"))] : [Number(get(row, "TAXON_ORDER")), category];
}
const { lookups, inherited } = buildRegionalLookups(registry.rows, crosswalk.rows, policy.abaIssfInheritance);
for (const [source, file] of Object.entries(files)) outputs[file] = lookups[source];
await writeFile(resolve(reviewDir, "aba-inheritance.json"), JSON.stringify(inherited, null, 2) + "\n");
await mkdir(outputDir, { recursive: true });
for (const [file, lookup] of Object.entries(outputs)) {
  await writeFile(resolve(outputDir, file), JSON.stringify(lookup) + "\n");
}
await writeFile(resolve(reviewDir, "generation-summary.json"), JSON.stringify({
  version: registry.version, abaIssfInheritance: policy.abaIssfInheritance, inheritedAbaGroups: inherited.length, accepted: registry.rows.filter((row) => row.decision === "accepted").length,
  unresolved: registry.rows.filter((row) => row.decision === "unresolved").length,
  counts: Object.fromEntries(Object.entries(outputs).map(([file, lookup]) => [file, Object.keys(lookup).length])),
}, null, 2) + "\n");
console.log(`Generated reviewed outputs in ${outputDir}; explicitly unresolved rows remain in the registry/report.`);
