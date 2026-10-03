import { describe, expect, it } from "vitest";
import { buildRegionalLookups } from "../scripts/taxonomy-concepts.mjs";
import { getRegionTaxonomySystem } from "../src/config/region-taxonomies.js";

const crosswalk = [
  { avibaseId: "PARENT", code: "species", reportable: true, ebirdCategory: "species", reportAs: "" },
  { avibaseId: "GROUP", code: "group", reportable: true, ebirdCategory: "issf", reportAs: "species" },
  { avibaseId: "HYBRID", code: "hybrid", reportable: true, ebirdCategory: "hybrid", reportAs: "species" },
  { avibaseId: "SLASH", code: "slash", reportable: true, ebirdCategory: "slash", reportAs: "species" },
  { avibaseId: "SUB", code: "sub", reportable: false, ebirdCategory: "", reportAs: "species" },
];
const mapping = { source: "aba", sourceKey: "row", avibaseId: "PARENT", status: 4, decision: "accepted", review: "" };

describe("reviewed regional generation", () => {
  it("inherits ABA status only to reportable issf groups", () => {
    const result = buildRegionalLookups([mapping], crosswalk, "issf-report-as");
    expect(result.lookups.aba).toEqual({ species: 4, group: 4 });
    expect(result.inherited).toEqual([{ code: "group", avibaseId: "GROUP", reportAs: "species", parentAvibaseId: "PARENT", status: 4 }]);
  });
  it("preserves an explicit group status over inheritance", () => {
    expect(buildRegionalLookups([mapping, { ...mapping, avibaseId: "GROUP", status: 3 }], crosswalk, "issf-report-as").lookups.aba).toEqual({ species: 4, group: 3 });
  });
  it("does not inherit a committee status", () => {
    expect(buildRegionalLookups([{ ...mapping, source: "de" }], crosswalk, "issf-report-as").lookups.de).toEqual({ species: 4 });
  });
  it("omits explicit unresolved nonreportable subspecies", () => {
    expect(buildRegionalLookups([{ ...mapping, avibaseId: "SUB", decision: "unresolved", review: "explicitly-unresolved" }], crosswalk, "issf-report-as").lookups.aba).toEqual({});
  });
  it("rejects an accepted nonreportable concept instead of using its parent", () => {
    expect(() => buildRegionalLookups([{ ...mapping, avibaseId: "SUB" }], crosswalk, "issf-report-as")).toThrow("nonreportable-concept");
  });
  it("rejects pending and conflicting mappings", () => {
    expect(() => buildRegionalLookups([{ ...mapping, review: "source-status-changed" }], crosswalk, "issf-report-as")).toThrow("needs review");
    expect(() => buildRegionalLookups([mapping, { ...mapping, status: 3 }], crosswalk, "issf-report-as")).toThrow("Conflicting");
  });
  it("omits default ABA and Swiss status 1", () => {
    const result = buildRegionalLookups([{ ...mapping, status: 1 }, { ...mapping, source: "ch", status: 1 }], crosswalk, "issf-report-as");
    expect(result.lookups.aba).toEqual({});
    expect(result.lookups.ch).toEqual({});
  });
  it("uses current Swiss occurrence periods and labels", () => {
    const swiss = getRegionTaxonomySystem("CH");
    expect(swiss.maxStatus).toBe(4);
    expect(swiss.describeStatus(1)).toContain("2015 and 2024");
    expect(swiss.describeStatus(3)).toContain("1975 and 2024");
    expect(swiss.describeStatus(4)).toContain("since 1975");
    expect(swiss.formatBadge(4)).toBe("historical");
  });
});
