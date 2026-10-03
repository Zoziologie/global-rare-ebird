import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFrenchSpeciesRows } from "./generate-french-taxonomy.mjs";
import { serializeAuditCsv } from "./taxonomy-audit-helpers.mjs";

// Download the published editions; refresh these URLs when publishers change them.
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = resolve(root, "raw-data/taxonomy-review");
await mkdir(directory, { recursive: true });
const config = JSON.parse(await readFile(resolve(root, "taxonomy/source-inputs.json"), "utf8"));
const provenance = {};
for (const source of ["aba", "fr", "de", "ch"]) {
  const input = config[source];
  const downloaded = resolve(directory, input.downloadFile);
  execFileSync("curl", ["--fail", "--location", "--silent", "--show-error", "--max-time", "60", input.url, "--output", downloaded]);
  const bytes = await readFile(downloaded);
  provenance[source] = { edition: input.edition, url: input.url, retrievedAt: new Date().toISOString(), downloadedSha256: createHash("sha256").update(bytes).digest("hex") };
}

// Convert the published inputs without changing taxon scope -----------------
await writeFile(resolve(root, config.aba.path), execFileSync("unzip", ["-p", resolve(directory, config.aba.downloadFile), "ABA_Checklist-8.19.csv"]));
extractFrenchSpeciesRows(await readFile(resolve(root, config.fr.path), "utf8"));
execFileSync(process.env.TAXONOMY_PYTHON || "python3", [resolve(root, "scripts/extract-german-checklist.py"), resolve(directory, config.de.downloadFile), resolve(root, config.de.path)], { stdio: "inherit" });
const swissText = execFileSync("pdftotext", ["-layout", resolve(directory, config.ch.downloadFile), "-"], { encoding: "utf8" });
if (!swissText.includes(`Switzerland – ${config.ch.edition}`)) throw new Error("Swiss PDF edition differs from source-inputs.json; inspect the new edition before conversion.");
const swiss = swissText.split(/\r?\n/).filter((line) => /^\d{2,}\s/.test(line)).map((line) => {
  const cells = line.trim().split(/\s{2,}/);
  if (![8, 10].includes(cells.length)) throw new Error(`Inspect Swiss PDF extraction: expected 8 or 10 cells, got ${cells.length}`);
  return { Nr: cells[0], English: cells[5], Species: cells[6], AERC: cells[7], S: cells[8] || "", "B/N": cells[9] || "" };
});
await writeFile(resolve(root, config.ch.path), serializeAuditCsv(swiss, ["Nr", "English", "Species", "AERC", "S", "B/N"]));
await writeFile(resolve(directory, "regional-provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
console.log(`Captured regional inputs and provenance in ${directory}; retained raw PDF/ZIP bytes for review.`);
