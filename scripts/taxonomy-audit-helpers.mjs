import { normalizeScientificName } from "./taxonomy-helpers.mjs";

export function normalizeTaxonName(value) {
  return normalizeScientificName(value).toLowerCase();
}

export function indexTaxonNames(taxa, field) {
  const index = new Map();
  for (const taxon of taxa) {
    const name = normalizeTaxonName(taxon[field]);
    if (!index.has(name)) index.set(name, []);
    index.get(name).push(taxon);
  }
  return index;
}

// Aliases inherited from the old generators are candidates, not reviewed equivalence.
export function auditTaxonMatch(row, scientificIndex, commonIndex, legacyCode) {
  const scientific = scientificIndex.get(normalizeTaxonName(row.scientificName)) || [];
  if (scientific.length) {
    return { method: "scientific", candidates: scientific, review: scientific.length > 1 ? "ambiguous" : "" };
  }
  if (legacyCode) return { method: "legacy-alias", candidates: [], legacyCode, review: "alias-needs-review" };
  const common = commonIndex.get(normalizeTaxonName(row.commonName)) || [];
  return {
    method: common.length ? "common" : "none",
    candidates: common,
    review: common.length > 1 ? "ambiguous" : common.length ? "common-name-needs-review" : "unmatched",
  };
}

export function serializeAuditCsv(rows, columns) {
  return [columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n") + "\n";
}
