import { describe, expect, it } from "vitest";
import { auditTaxonMatch, indexTaxonNames, serializeAuditCsv } from "../scripts/taxonomy-audit-helpers.mjs";
import { parseCsv } from "../scripts/taxonomy-helpers.mjs";
import { parseGermanChecklist } from "../scripts/generate-german-taxonomy.mjs";

const taxa = [
  { code: "one", scientificName: "Genus species", commonName: "Example Bird", category: "species" },
  { code: "two", scientificName: "Genus species subspecies", commonName: "Example Bird", category: "issf" },
  { code: "three", scientificName: "Other species", commonName: "Other Bird", category: "species" },
];
const scientific = indexTaxonNames(taxa, "scientificName");
const common = indexTaxonNames(taxa, "commonName");

describe("taxonomy audit", () => {
  it("keeps a unique scientific match ahead of a stale alias", () => {
    expect(auditTaxonMatch({ scientificName: " Genus species ", commonName: "Example Bird" }, scientific, common, "obsolete"))
      .toMatchObject({ method: "scientific", candidates: [taxa[0]], review: "" });
  });
  it("retains all ambiguous scientific candidates", () => {
    const duplicated = indexTaxonNames([...taxa, { ...taxa[0], code: "four" }], "scientificName");
    const match = auditTaxonMatch({ scientificName: "Genus species" }, duplicated, common);
    expect(match.review).toBe("ambiguous");
    expect(match.candidates.map((taxon) => taxon.code)).toEqual(["one", "four"]);
  });
  it("does not collapse a common name shared by a species and subspecies", () => {
    const match = auditTaxonMatch({ scientificName: "Old genus", commonName: "Example Bird" }, scientific, common);
    expect(match.review).toBe("ambiguous");
    expect(match.candidates).toHaveLength(2);
  });
  it("requires review of legacy codes and does not accept fuzzy names", () => {
    expect(auditTaxonMatch({ scientificName: "Old genus" }, scientific, common, "obsolete"))
      .toMatchObject({ method: "legacy-alias", legacyCode: "obsolete", review: "alias-needs-review" });
    expect(auditTaxonMatch({ scientificName: "Genus specie" }, scientific, common).review).toBe("unmatched");
  });
  it("marks unique common-name fallbacks for biological review", () => {
    expect(auditTaxonMatch({ scientificName: "Old species", commonName: "Other Bird" }, scientific, common).review)
      .toBe("common-name-needs-review");
  });
  it("preserves source text and quotes in the row report", () => {
    const csv = serializeAuditCsv([{ name: 'A "quoted" bird\nsecond line', status: 3 }], ["name", "status"]);
    expect(parseCsv(csv)).toEqual([["name", "status"], ['A "quoted" bird\nsecond line', "3"]]);
  });
  it("retains German subspecies restrictions and scientific-name continuation rows", () => {
    const csv = 'Deutscher Name,Englischer Name,"Wissenschaftlicher\nName",Einschränkungen\nBird,Example Bird,Genus species,nur diese Unterart\n,,subspecies,\n';
    expect(parseGermanChecklist(csv).rows).toEqual([
      { germanName: "Bird", englishName: "Example Bird", scientificName: "Genus species subspecies", restriction: "nur diese Unterart" },
    ]);
  });
});
