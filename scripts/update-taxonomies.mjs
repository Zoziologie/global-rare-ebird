import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const previousRegistry = process.env.TAXONOMY_PREVIOUS_REGISTRY;
const previousCrosswalk = process.env.TAXONOMY_PREVIOUS_CROSSWALK;

// Read sources and expose the initial name/alias audit ----------------------
execFileSync(process.execPath, ["scripts/audit-taxonomies.mjs"], { cwd: root, stdio: "inherit" });

// Build the matching-version concept crosswalk ------------------------------
execFileSync(process.execPath, ["scripts/build-taxonomy-crosswalk.mjs", ...previousCrosswalk ? ["", "", previousCrosswalk] : []], { cwd: root, stdio: "inherit" });

// Retain reviewed Avibase bindings; propose matches only for new rows --------
execFileSync(process.execPath, ["scripts/match-taxonomy-concepts.mjs", ...previousRegistry ? [previousRegistry] : []], { cwd: root, stdio: "inherit" });

// Generate only after review, locally unless --write is requested -----------
execFileSync(process.execPath, ["scripts/generate-reviewed-taxonomies.mjs", ...process.argv.includes("--write") ? ["--write"] : []], { cwd: root, stdio: "inherit" });
