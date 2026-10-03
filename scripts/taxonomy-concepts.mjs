import { parseCsv } from "./taxonomy-helpers.mjs";

export function normalizeAvibaseId(value) {
  return value.trim().replace(/^avibase-/i, "").toUpperCase();
}

// Retain all rows: one concept may appear at several ranks in the integrated list.
export function parseConceptChecklist(text) {
  const [header, ...rows] = parseCsv(text);
  const columns = header.map((name) => name.trim().toLowerCase().replaceAll("_", " ").replace(/\s+/g, " "));
  const fields = {
    code: ["species code", "ebird species code"],
    avibaseId: ["taxon concept id"],
    category: ["category"],
    scientificName: ["scientific name", "sci name"],
    commonName: ["english name", "common name", "primary com name"],
  };
  const indices = Object.fromEntries(Object.entries(fields).map(([field, names]) => {
    const index = columns.findIndex((name) => names.includes(name));
    if (index === -1) throw new Error(`Concept checklist is missing ${names.join(" / ")}; inspect its header before importing.`);
    return [field, index];
  }));
  return rows.filter((row) => row[indices.code].trim()).map((row) => {
    const entry = Object.fromEntries(Object.entries(indices).map(([field, index]) => [field, row[index].trim()]));
    return { ...entry, originalAvibaseId: entry.avibaseId, avibaseId: normalizeAvibaseId(entry.avibaseId) };
  });
}

export function buildConceptCrosswalk(concepts, taxa) {
  const taxaByCode = new Map(taxa.map((taxon) => [taxon.code, taxon]));
  return concepts.map((concept) => {
    const reportable = taxaByCode.get(concept.code);
    return {
      ...concept, reportable: Boolean(reportable),
      ebirdCategory: reportable?.category || "", reportAs: reportable?.reportAs || "",
      ebirdScientificName: reportable?.scientificName || "",
    };
  });
}

// Compare concepts independently of names, codes, and rank. Changed scope requires review.
export function compareConceptCrosswalks(before, after) {
  const changes = [];
  const afterById = new Map();
  for (const row of after.filter((entry) => entry.avibaseId)) {
    if (!afterById.has(row.avibaseId)) afterById.set(row.avibaseId, []);
    afterById.get(row.avibaseId).push(row);
  }
  for (const old of before) {
    const candidates = old.avibaseId ? afterById.get(old.avibaseId) || [] : [];
    const exactCode = candidates.filter((row) => row.code === old.code);
    const reportable = candidates.filter((row) => row.reportable);
    const eligible = exactCode.length ? exactCode : old.reportable ? reportable : candidates;
    const current = eligible.length === 1 ? eligible[0] : undefined;
    let change;
    if (!old.avibaseId) change = "missing-id";
    else if (!candidates.length) change = after.some((row) => row.code === old.code && row.avibaseId) ? "concept-changed-at-code" : "concept-missing";
    else if (!current) change = "ambiguous";
    else if (old.reportable !== current.reportable) change = "reportability-changed";
    else if (old.category !== current.category || old.ebirdCategory !== current.ebirdCategory) change = "rank-or-category-changed";
    else if (old.reportAs !== current.reportAs) change = "report-as-changed";
    else if (old.code !== current.code) change = "code-changed";
    else if (old.scientificName !== current.scientificName || old.commonName !== current.commonName) change = "name-changed";
    else change = "unchanged";
    changes.push({
      avibaseId: old.avibaseId, oldCode: old.code, newCode: current?.code || "",
      candidateCodes: candidates.map((row) => row.code).join("|"), change,
      oldScientificName: old.scientificName, newScientificName: current?.scientificName || "",
    });
  }
  const previousIds = new Set(before.map((row) => row.avibaseId).filter(Boolean));
  for (const row of after.filter((entry) => entry.avibaseId && !previousIds.has(entry.avibaseId))) {
    changes.push({ avibaseId: row.avibaseId, oldCode: "", newCode: row.code, candidateCodes: row.code, change: "concept-added", oldScientificName: "", newScientificName: row.scientificName });
  }
  return changes;
}

export function resolveReviewedConcept(mapping, crosswalk) {
  const concept = crosswalk.filter((row) => row.avibaseId && row.avibaseId === normalizeAvibaseId(mapping.avibaseId));
  const reportable = concept.filter((row) => row.reportable);
  if (!concept.length) return { review: "concept-missing", codes: [] };
  if (!reportable.length) return { review: "nonreportable-concept", codes: [] };
  if (reportable.length !== 1) return { review: "ambiguous-reportable-concept", codes: reportable.map((row) => row.code) };
  return { review: "", codes: [reportable[0].code] };
}

export function buildRegionalLookups(mappings, crosswalk, abaIssfInheritance) {
  const lookups = { aba: {}, fr: {}, de: {}, ch: {} };
  const inherited = [];
  for (const mapping of mappings.filter((row) => row.decision !== "unresolved")) {
    if (mapping.decision !== "accepted" || mapping.review) throw new Error(`${mapping.source}:${mapping.sourceKey}: mapping still needs review`);
    const resolution = resolveReviewedConcept(mapping, crosswalk);
    if (resolution.review) throw new Error(`${mapping.source}:${mapping.sourceKey}: ${resolution.review}`);
    const code = resolution.codes[0];
    const target = lookups[mapping.source];
    if (Object.hasOwn(target, code) && target[code] !== mapping.status) throw new Error(`Conflicting ${mapping.source} statuses for ${code}`);
    target[code] = mapping.status;
  }
  const byCode = new Map(crosswalk.filter((row) => row.reportable).map((row) => [row.code, row]));
  if (abaIssfInheritance === "issf-report-as") {
    for (const taxon of crosswalk.filter((row) => row.reportable && row.ebirdCategory === "issf")) {
      const parent = byCode.get(taxon.reportAs);
      if (parent?.ebirdCategory === "species" && Object.hasOwn(lookups.aba, parent.code) && !Object.hasOwn(lookups.aba, taxon.code)) {
        lookups.aba[taxon.code] = lookups.aba[parent.code];
        inherited.push({ code: taxon.code, avibaseId: taxon.avibaseId, reportAs: parent.code, parentAvibaseId: parent.avibaseId, status: lookups.aba[parent.code] });
      }
    }
  }
  for (const source of ["aba", "ch"]) {
    for (const [code, status] of Object.entries(lookups[source])) {
      if (status === 1) delete lookups[source][code];
    }
  }
  return { lookups, inherited };
}
