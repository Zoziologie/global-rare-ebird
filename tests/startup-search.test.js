// @vitest-environment happy-dom
import { createApp, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchPreferenceKey, useGlobalRareBird } from "../src/composables/useGlobalRareBird.js";
import { lookupDefaultRegion } from "../src/utils/default-region.js";
import regionCatalog from "../data/region-catalog.json";

vi.mock("../src/utils/analytics.js", () => ({ trackEvent: vi.fn() }));
vi.mock("../src/config/index.js", () => ({
  ebirdApiKey: "fixture-token", ebirdBaseUrl: "https://api.ebird.org/v2",
  mapboxStyles: [{ key: "streets", url: "mapbox://styles/mapbox/streets-v12" }],
}));
vi.mock("../src/utils/taxonomy-resources.js", () => ({
  loadTaxonomyResources: vi.fn(async () => ({ taxonomyLookup: {}, regionTaxonomyLookups: {} })),
}));

const regions = new Map(regionCatalog.map(region => [region.code, region]));
const json = value => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
let component;
let app;
let fetchMock;
let getCurrentPosition;
function mount(search = "", saved) {
  window.history.replaceState(null, "", `/global-rare-ebird/${search}`);
  if (saved) window.localStorage.setItem(searchPreferenceKey, JSON.stringify(saved));
  component = createApp({ setup() { app = useGlobalRareBird(); return () => h("div"); } });
  component.mount(document.createElement("div"));
}
beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn().mockResolvedValue(json([]));
  vi.stubGlobal("fetch", fetchMock);
  getCurrentPosition = vi.fn((resolve, reject) => reject({ code: 1 }));
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition },
    permissions: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
  });
});
afterEach(() => {
  component?.unmount();
  component = null;
  vi.useRealTimers();
});

describe("initial region lookup", () => {
  it.each([["FR", "IDF", "FR"], ["US", "CA", "US-CA"], ["CA", "QC", "CA-QC"], ["US", "unknown", "US"], ["CA", undefined, "CA"]])("selects %s/%s as %s", async (country_code, region_code, expected) => {
    fetchMock.mockResolvedValueOnce(json({ success: true, country_code, region_code }));
    expect((await lookupDefaultRegion(regions, new AbortController().signal)).code).toBe(expected);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://ipwho.is/?fields=success,country_code,region_code");
  });

  it.each([new Response("", { status: 429 }), json({ success: false }), json({ success: true, country_code: "ZZ" })])("leaves unsupported or failed lookups to manual selection", async response => {
    fetchMock.mockResolvedValueOnce(response);
    expect(await lookupDefaultRegion(regions, new AbortController().signal)).toBeNull();
  });

  it("times out a lookup without leaving startup blocked", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason));
    }));
    const lookup = lookupDefaultRegion(regions, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await lookup).toBeNull();
  });
});

describe("startup search priority and persistence", () => {
  it("loads a labelled estimate on the first visit without requesting device location", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, country_code: "CA", region_code: "ON" }));
    mount();
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected.map(region => region.code)).toEqual(["CA-ON"]);
    expect(app.estimatedRegionCode).toBe("CA-ON");
    expect(fetchMock.mock.calls[1][0]).toContain("/data/obs/CA-ON/recent/notable");
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(JSON.parse(window.localStorage.getItem(searchPreferenceKey))).toMatchObject({ regionCodes: ["CA-ON"], estimatedRegionCode: "CA-ON" });
  });

  it("restores saved regions and settings with fresh data and no IP lookup", async () => {
    mount("", { search: "mode=r&r=CH&t=7&l=fr&c=1", regionCodes: ["CH"], estimatedRegionCode: "" });
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected.map(region => region.code)).toEqual(["CH"]);
    expect(app.backSelected).toBe(7);
    expect(app.sppLocale).toBe("fr");
    expect(app.detailSelected).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/data/obs/CH/");
  });

  it("honors a shared URL ahead of saved regions", async () => {
    mount("?mode=r&r=FR&t=2", { search: "mode=r&r=CH&t=7", regionCodes: ["CH"] });
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected.map(region => region.code)).toEqual(["FR"]);
    expect(app.backSelected).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps explicitly empty shared searches empty", async () => {
    mount("?mode=r", { search: "mode=r&r=CH", regionCodes: ["CH"] });
    await nextTick();
    expect(app.regionSelected).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not mistake unrelated tracking parameters for a shared search", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, country_code: "FR" }));
    mount("?utm_source=example");
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected[0].code).toBe("FR");
  });

  it("replaces an estimate with a manual choice and remembers the choice", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, country_code: "FR" }));
    mount();
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    await app.selectRegion(regions.get("CH"));
    await nextTick();
    expect(app.regionSelected.map(region => region.code)).toEqual(["CH"]);
    expect(app.estimatedRegionCode).toBe("");
    expect(JSON.parse(window.localStorage.getItem(searchPreferenceKey)).regionCodes).toEqual(["CH"]);
    app.removeRegion(regions.get("CH"));
    await nextTick();
    component.unmount();
    mount();
    expect(app.regionSelected).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignores a late estimate after a manual selection, even if transport ignores cancellation", async () => {
    let resolveLookup;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve; }));
    mount();
    await app.selectRegion(regions.get("CH"));
    resolveLookup(json({ success: true, country_code: "FR" }));
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected.map(region => region.code)).toEqual(["CH"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves a failed estimate retryable on the next bare-URL visit", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Offline"));
    mount();
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected).toEqual([]);
    expect(window.localStorage.getItem(searchPreferenceKey)).toBeNull();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("remains usable when browser storage is unavailable", async () => {
    const getItem = vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    const setItem = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    mount("?r=FR");
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.regionSelected[0].code).toBe("FR");
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

describe("nearby startup and recovery", () => {
  it.each(["prompt", "denied"])("restores nearby with %s permission by using saved regions without prompting", async state => {
    navigator.permissions.query.mockResolvedValue({ state });
    mount("", { search: "mode=n&d=25&t=3", regionCodes: ["CH"] });
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    await vi.waitFor(() => expect(app.isMylocation).toBe(false));
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(app.regionSelected[0].code).toBe("CH");
    expect(app.distSelected).toBe(25);
    expect(app.regionFallbackFeedback).toContain("Location access");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("restores nearby with fresh coordinates when permission is granted", async () => {
    navigator.permissions.query.mockResolvedValue({ state: "granted" });
    getCurrentPosition.mockImplementation(resolve => resolve({ coords: { latitude: 46.8, longitude: 8.2 } }));
    mount("", { search: "mode=n&d=25&t=3", regionCodes: ["CH"] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(app.isMylocation).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/data/obs/geo/");
    expect(fetchMock.mock.calls[0][0]).toContain("lat=46.8");
  });

  it("falls back to an estimate after an explicit shared nearby request is denied", async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, country_code: "US", region_code: "NY" }));
    mount("?mode=n");
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(app.isMylocation).toBe(false);
    expect(app.regionSelected[0].code).toBe("US-NY");
    expect(app.regionFallbackFeedback).toContain("denied");
  });

  it("ignores a pending estimate when Around me is chosen", async () => {
    let resolveLookup;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveLookup = resolve; }));
    getCurrentPosition.mockImplementation(resolve => resolve({ coords: { latitude: 46.8, longitude: 8.2 } }));
    mount();
    await app.myLocation();
    resolveLookup(json({ success: true, country_code: "FR" }));
    await vi.waitFor(() => expect(app.isLoading).toBe(false));
    expect(app.isMylocation).toBe(true);
    expect(app.regionSelected).toEqual([]);
  });
});
