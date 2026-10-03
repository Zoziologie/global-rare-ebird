import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTaxonomyLookup } from "../src/utils/taxonomy.js";

beforeEach(() => vi.resetModules());

describe("taxonomy resources", () => {
  it("decodes compact taxonomy rows for both species and non-species entries", () => {
    expect(buildTaxonomyLookup({ amewig: [1], hybrid: [2, "hybrid"] })).toMatchObject({
      amewig: { tax: 1, category: "species" }, hybrid: { tax: 2, category: "hybrid" },
    });
  });

  it("shares an in-flight region lookup across callers", async () => {
    const { loadRegionTaxonomyLookup } = await import("../src/utils/taxonomy-resources.js");
    const system = { id: "fixture", loadLookup: vi.fn().mockResolvedValue({ amewig: 4 }) };
    const results = await Promise.all([loadRegionTaxonomyLookup(system), loadRegionTaxonomyLookup(system)]);
    expect(results).toEqual([{ amewig: 4 }, { amewig: 4 }]);
    expect(system.loadLookup).toHaveBeenCalledTimes(1);
  });

  it("allows retry after a lookup download fails", async () => {
    const { loadRegionTaxonomyLookup } = await import("../src/utils/taxonomy-resources.js");
    const system = { id: "fixture", loadLookup: vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ amewig: 4 }) };
    await expect(loadRegionTaxonomyLookup(system)).rejects.toThrow("Offline");
    await expect(loadRegionTaxonomyLookup(system)).resolves.toEqual({ amewig: 4 });
    expect(system.loadLookup).toHaveBeenCalledTimes(2);
  });
});
