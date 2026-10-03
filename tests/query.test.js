import { describe, expect, it } from "vitest";
import { parseShareState, serializeShareState } from "../src/utils/query.js";
import { escapeHtml } from "../src/utils/formatters.js";

describe("share links", () => {
  it("restores regions, locale, dates, and details after sharing", () => {
    const query = serializeShareState({ isMylocation: false, regionSelected: [{ code: "CH" }, { code: "US-CA" }], backSelected: 7, detailSelected: true, sppLocale: "fr" });
    expect(parseShareState(query)).toEqual({ isMylocation: false, regionCodes: ["CH", "US-CA"], backSelected: 7, distSelected: 50, detailSelected: true, sppLocale: "fr" });
  });

  it("keeps nearby links free of location coordinates and saved regions", () => {
    const query = serializeShareState({ isMylocation: true, regionSelected: [{ code: "CH" }], distSelected: 25, backSelected: 0, sppLocale: "en" });
    expect(query).toBe("mode=n&d=25&t=0");
    expect(parseShareState(query)).toMatchObject({ isMylocation: true, distSelected: 25, backSelected: 0 });
  });

  it("clamps shared search ranges to the supported API bounds", () => {
    expect(parseShareState("?mode=n&d=100&t=-1")).toMatchObject({ distSelected: 50, backSelected: 0 });
    expect(parseShareState("?d=invalid&t=invalid")).toMatchObject({ distSelected: 50, backSelected: 1 });
  });
});

describe("popup escaping", () => {
  it("escapes markup and both quote styles used in HTML attributes", () => {
    expect(escapeHtml('<img src="x" onerror=\'alert(1)\'> &')).toBe("&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt; &amp;");
  });
});
