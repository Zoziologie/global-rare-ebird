import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const taxonomy = JSON.parse(readFileSync("data/taxo.json", "utf8"));
const aba = JSON.parse(readFileSync("data/aba-taxonomy.json", "utf8"));
const france = JSON.parse(readFileSync("data/french-rarity-taxonomy.json", "utf8"));
const germany = JSON.parse(readFileSync("data/german-taxonomy.json", "utf8"));
const swiss = JSON.parse(readFileSync("data/swiss-taxonomy.json", "utf8"));
const registry = JSON.parse(readFileSync("taxonomy/accepted-mappings.json", "utf8"));

describe("reviewed 2026 application taxonomy", () => {
  it("uses current codes throughout the regional lookups", () => {
    expect(registry.version).toBe(2026);
    expect(Object.keys(taxonomy)).toHaveLength(18631);
    for (const lookup of [aba, france, germany, swiss]) {
      expect(Object.keys(lookup).filter((code) => !Object.hasOwn(taxonomy, code))).toEqual([]);
    }
    expect(registry.rows.filter((row) => row.decision !== "unresolved" && (row.decision !== "accepted" || row.review))).toEqual([]);
    expect(registry.rows.filter((row) => row.decision === "unresolved")).toHaveLength(7);
  });

  it("keeps both Willet species and their combined identification rare in France", () => {
    expect(taxonomy.willet1[1]).toBe("slash");
    expect(taxonomy.willet2).toHaveLength(1);
    expect(taxonomy.willet3).toHaveLength(1);
    expect(france).toMatchObject({ willet1: 1, willet2: 1, willet3: 1 });
  });

  it("does not broaden Little Swift committee scope to the lumped species or House group", () => {
    for (const lookup of [france, germany]) {
      expect(lookup).toMatchObject({ litswi2: 1, litswi3: 1, litswi4: 1 });
      expect(lookup.y00960).toBeUndefined();
      expect(lookup.houswi1).toBeUndefined();
      expect(lookup.litswi1).toBeUndefined();
    }
  });

  it("restricts the former Tufted Flycatcher code to the ABA-recorded daughter species", () => {
    expect(taxonomy.tuffly1).toHaveLength(1);
    expect(aba.tuffly1).toBe(4);
    for (const code of ["tuffly", "yebtuf1", "tuffly2", "tuffly3"]) expect(aba[code]).toBeUndefined();
  });

  it("preserves the recorded ABA flycatcher and robin without assigning codes to unlisted split species", () => {
    expect(aba).toMatchObject({ spofly1: 5, spofly2: 5, eurrob1: 5, y01408: 5 });
    expect(taxonomy.spofly1[1]).toBe("slash");
    expect(taxonomy.y01408[1]).toBe("slash");
    expect(aba.spofly3).toBeUndefined();
    expect(aba.cairob1).toBeUndefined();
  });
});
