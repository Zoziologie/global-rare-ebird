import { execFileSync } from "node:child_process";

export const TAXONOMY_URL = "https://api.ebird.org/v2/ref/taxonomy/ebird";
export const ABA_CHECKLIST_PATH = "raw-data/ABA_Checklist-8.19.csv";
export const GERMAN_CHECKLIST_PATH = "raw-data/meldeliste_d_ab2023_sys.csv";
export const FRENCH_SPECIES_URL = "https://www.chn-france.org/en/homologation/species/";

export function fetchText(url, maxBuffer = 20 * 1024 * 1024) {
  return execFileSync("curl", ["-L", "-s", "--max-time", "30", url], {
    encoding: "utf8",
    maxBuffer,
  });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const source = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

export function parseTaxonomyCsv(text) {
  const rows = parseCsv(text);
  const header = rows.shift();

  if (!header?.length) {
    throw new Error("eBird taxonomy download did not include a header row");
  }

  const headerIndex = new Map(header.map((name, index) => [name.trim(), index]));
  const get = (row, key) => row[headerIndex.get(key)] ?? "";

  return { rows, header, get };
}

export function splitCodes(value) {
  return String(value || "")
    .split(/[\s,/]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

export function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

export function csvEscape(value) {
  const text = decodeHtmlEntities(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function normalizeScientificName(value) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}
