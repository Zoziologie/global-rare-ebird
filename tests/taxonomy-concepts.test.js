import { describe, expect, it } from "vitest";
import { buildConceptCrosswalk, compareConceptCrosswalks, normalizeAvibaseId, parseConceptChecklist, resolveReviewedConcept } from "../scripts/taxonomy-concepts.mjs";

const before = [
  { code: "old", avibaseId: "1234ABCD", scientificName: "Genus species", commonName: "Old Bird", category: "species", ebirdCategory: "species", reportable: true, reportAs: "" },
  { code: "sub", avibaseId: "5678ABCD", scientificName: "Genus species minor", commonName: "", category: "subspecies", ebirdCategory: "", reportable: false, reportAs: "" },
];

describe("Avibase concept workflow", () => {
  it("reads the real integrated checklist headers and ignores citation rows", () => {
    const csv = '\uFEFFsort v2025,species_code,taxon concept ID,category,English name,scientific name\n0.2,,,,Citation,\n2,old,avibase-1234abcd,species,Old Bird,Genus species\n';
    expect(parseConceptChecklist(csv)).toEqual([{
      code: "old", avibaseId: "1234ABCD", originalAvibaseId: "avibase-1234abcd", category: "species", commonName: "Old Bird", scientificName: "Genus species",
    }]);
  });
  it("supports the official reportable taxonomy column names", () => {
    const csv = 'SPECIES_CODE,TAXON_CONCEPT_ID,CATEGORY,PRIMARY_COM_NAME,SCI_NAME\nold,avibase-1234ABCD,hybrid,Hybrid,Genus species x other\n';
    expect(parseConceptChecklist(csv)[0]).toMatchObject({ category: "hybrid", avibaseId: "1234ABCD" });
  });
  it("does not guess or truncate eight- and sixteen-character identifiers", () => {
    expect(normalizeAvibaseId(" avibase-1234abcd ")).toBe("1234ABCD");
    expect(normalizeAvibaseId("1234abcd00000000")).toBe("1234ABCD00000000");
    expect(normalizeAvibaseId("")).toBe("");
  });
  it("rejects a name-only file without the concept column", () => {
    expect(() => parseConceptChecklist("species_code,category,English name,scientific name\nold,species,Bird,Genus species\n"))
      .toThrow("taxon concept id");
  });
  it("keeps all subspecies and marks reportability from the API code set", () => {
    const crosswalk = buildConceptCrosswalk(before, [{ code: "old", category: "species", scientificName: "Genus species", reportAs: "" }]);
    expect(crosswalk.map((row) => row.reportable)).toEqual([true, false]);
  });
  it("carries an exact ID across an eBird code rename", () => {
    const after = [{ ...before[0], code: "new" }, before[1]];
    expect(compareConceptCrosswalks(before, after)[0]).toMatchObject({ change: "code-changed", newCode: "new", avibaseId: "1234ABCD" });
    expect(resolveReviewedConcept({ avibaseId: "avibase-1234ABCD" }, after)).toEqual({ review: "", codes: ["new"] });
  });
  it("detects changed scope even when the name and eBird code remain identical", () => {
    const after = [{ ...before[0], avibaseId: "9999ABCD" }, before[1]];
    expect(compareConceptCrosswalks(before, after)[0].change).toBe("concept-changed-at-code");
    expect(resolveReviewedConcept({ avibaseId: "1234ABCD" }, after).review).toBe("concept-missing");
  });
  it("does not assign a parent species to an unreportable subspecies", () => {
    expect(resolveReviewedConcept({ avibaseId: "5678ABCD" }, before)).toEqual({ review: "nonreportable-concept", codes: [] });
  });
  it("flags splits with multiple reportable candidates rather than choosing one", () => {
    const after = [{ ...before[0], code: "split1" }, { ...before[0], code: "split2" }];
    expect(compareConceptCrosswalks([before[0]], after)[0].change).toBe("ambiguous");
    expect(resolveReviewedConcept({ avibaseId: "1234ABCD" }, after).review).toBe("ambiguous-reportable-concept");
  });
  it("detects rank and reportability changes separately", () => {
    expect(compareConceptCrosswalks([before[0]], [{ ...before[0], category: "group (monotypic)" }])[0].change).toBe("rank-or-category-changed");
    expect(compareConceptCrosswalks([before[1]], [{ ...before[1], reportable: true }])[0].change).toBe("reportability-changed");
  });
  it("records added and missing concepts without inferring split/lump relationships", () => {
    const changes = compareConceptCrosswalks(before, [{ ...before[0], code: "new", avibaseId: "9999ABCD" }]);
    expect(changes.map((row) => row.change)).toEqual(["concept-missing", "concept-missing", "concept-added"]);
  });
  it("does not collapse identical concepts at multiple nonreportable ranks", () => {
    const rows = [before[0], { ...before[0], code: "internal", category: "subspecies", reportable: false }];
    expect(resolveReviewedConcept({ avibaseId: "1234ABCD" }, rows)).toEqual({ review: "", codes: ["old"] });
  });
});
