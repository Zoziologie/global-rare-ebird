import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EBIRD_BASE_URL = "https://api.ebird.org/v2";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "..");
const outputPath = resolve(rootDir, "data/region-catalog.json");

function loadEnvValue(name) {
  for (const envPath of [resolve(rootDir, ".env.local"), resolve(rootDir, ".env")]) {
    if (!existsSync(envPath)) {
      continue;
    }

    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      if (key !== name) {
        continue;
      }

      return trimmed.slice(separatorIndex + 1).trim();
    }
  }

  return "";
}

function normalizeRegion(region) {
  return {
    code: String(region?.code || "").trim().toUpperCase(),
    name: String(region?.name || "").trim(),
  };
}

function buildRegionListUrl(path, apiKey) {
  const url = new URL(`${EBIRD_BASE_URL}${path}`);
  if (apiKey) {
    url.searchParams.set("key", apiKey);
  }
  return url.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.json();
}

function mergeRegionLists(...lists) {
  const regions = new Map();

  for (const list of lists) {
    for (const region of list) {
      const normalized = normalizeRegion(region);
      if (!normalized.code || !normalized.name || regions.has(normalized.code)) {
        continue;
      }

      regions.set(normalized.code, normalized);
    }
  }

  return [...regions.values()].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.code.localeCompare(right.code);
  });
}

async function main() {
  const apiKey = process.env.EBIRD_API_KEY || loadEnvValue("EBIRD_API_KEY");
  const [countries, usStates, caStates] = await Promise.all([
    fetchJson(buildRegionListUrl("/ref/region/list/country/world", apiKey)),
    fetchJson(buildRegionListUrl("/ref/region/list/subnational1/US", apiKey)),
    fetchJson(buildRegionListUrl("/ref/region/list/subnational1/CA", apiKey)),
  ]);

  const regionCatalog = mergeRegionLists(countries, usStates, caStates);

  await writeFile(outputPath, `${JSON.stringify(regionCatalog)}\n`);

  console.log(`Wrote ${regionCatalog.length} region rows to ${outputPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
