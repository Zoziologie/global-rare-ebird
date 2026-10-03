// @vitest-environment happy-dom
import { createApp, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "../src/utils/analytics.js";
import { useGlobalRareBird } from "../src/composables/useGlobalRareBird.js";

vi.mock("../src/utils/analytics.js", () => ({ trackEvent: vi.fn() }));

vi.mock("../src/config/index.js", () => ({
  ebirdApiKey: "fixture-token", ebirdBaseUrl: "https://api.ebird.org/v2",
  mapboxStyles: [{ key: "streets", url: "mapbox://styles/mapbox/streets-v12" }, { key: "satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" }],
}));
vi.mock("../src/utils/taxonomy-resources.js", () => ({
  loadTaxonomyResources: vi.fn(async () => ({ taxonomyLookup: { amewig: { tax: 1, category: "species" } }, regionTaxonomyLookups: {} })),
}));

function row(subId = "S1") {
  return { speciesCode: "amewig", comName: "American Wigeon", sciName: "Mareca americana", locId: "L1", locName: "Lake", subId, obsId: subId, obsDt: "2026-10-03 09:00", lat: 46.8, lng: 8.2 };
}
function response(rows) {
  return new Response(JSON.stringify(rows), { headers: { "Content-Type": "application/json" } });
}

let component;
let app;
let fetchMock;
beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/global-rare-ebird/?mode=r");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  component = createApp({ setup() { app = useGlobalRareBird(); return () => h("div"); } });
  component.mount(document.createElement("div"));
});
afterEach(() => {
  component.unmount();
  vi.useRealTimers();
});

describe("sightings requests", () => {
  it("combines shared checklist rows in the sidebar and popup while retaining media access", async () => {
    fetchMock.mockResolvedValueOnce(response([
      { ...row(), howMany: 2, userDisplayName: "Alice" },
      { ...row("S2"), howMany: 5, userDisplayName: "Bob", hasRichMedia: true },
    ]));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    expect(app.allObservations).toHaveLength(1);
    expect(app.speciesFiltered[0].loc[0].obs[0]).toMatchObject({ howMany: 5, userDisplayName: "Alice, Bob", subId: "S2" });
    expect(app.locationFeatures[0].count).toBe(1);
    app.openLocationPopup("L1");
    expect(app.popupLocation.sp[0].obs[0].userDisplayName).toBe("Alice, Bob");
    app.mediaSelected = true;
    expect(app.filteredObservations[0].userDisplayName).toBe("Alice, Bob");
    fetchMock.mockResolvedValueOnce(response([{ assetId: "photo1" }]));
    await app.loadMedia("S2");
    expect(app.popupLocation.sp[0].obs[0].media).toEqual(["photo1"]);
  });

  it("loads checklist details on demand and reuses the completed response", async () => {
    fetchMock.mockResolvedValueOnce(response([row()]));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(response({ obs: [{
      obsId: "S1", speciesCode: "amewig", comments: "A comment", mediaCounts: { P: 2, A: 1 },
    }] }));
    await app.toggleObservationDetails("S1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/product/checklist/view/S1");
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ "X-eBirdApiToken": "fixture-token" });
    expect(app.observationDetails.S1).toMatchObject({
      status: "loaded", comments: "A comment", mediaCounts: { P: 2, A: 1 }, isOpen: true,
    });

    await app.toggleObservationDetails("S1");
    expect(app.observationDetails.S1.isOpen).toBe(false);
    await app.toggleObservationDetails("S1");
    expect(app.observationDetails.S1.isOpen).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows a retryable error when checklist details fail", async () => {
    fetchMock.mockResolvedValueOnce(response([row()]));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    fetchMock.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await app.toggleObservationDetails("S1");
    expect(app.observationDetails.S1.status).toBe("error");

    fetchMock.mockResolvedValueOnce(response({ obs: [{
      obsId: "S1", speciesCode: "amewig", comments: "", mediaCounts: {},
    }] }));
    await app.toggleObservationDetails("S1");
    expect(app.observationDetails.S1.status).toBe("loaded");
    expect(app.observationDetails.S1.comments).toBe("");
  });

  it("authenticates with a header and reuses regions when adding a selection", async () => {
    fetchMock.mockResolvedValueOnce(response([row("FR")])).mockResolvedValueOnce(response([{ ...row("CH"), locId: "L2" }]));
    app.applyRegionSelection({ code: "FR", name: "France" });
    await app.loadRegionObservations();
    app.applyRegionSelection({ code: "CH", name: "Switzerland" });
    await app.loadRegionObservations();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.has("key")).toBe(false);
    expect(options.headers).toEqual({ "X-eBirdApiToken": "fixture-token" });
    expect(app.allObservations).toHaveLength(2);
    expect(app.isLoading).toBe(false);
  });

  it("does not apply an older response after selection changes, even if transport ignores cancellation", async () => {
    let resolveFirst;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(response([row("CH")]));
    app.regionSelected = [{ code: "FR", name: "France" }];
    const first = app.loadRegionObservations();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    resolveFirst(response([row("FR")]));
    await first;
    expect(Object.keys(app.observationsRegionByCode)).toEqual(["CH"]);
    expect(app.allObservations[0].subId).toBe("CH");
    expect(app.observationError).toBe("");
    expect(app.isLoading).toBe(false);
  });

  it("retains successful regions and retries only a failed region", async () => {
    fetchMock.mockResolvedValueOnce(response([row("FR")]))
      .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
      .mockResolvedValueOnce(response([{ ...row("CH"), locId: "L2" }]));
    app.regionSelected = [{ code: "FR", name: "France" }, { code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    expect(app.allObservations.map(obs => obs.subId)).toEqual(["FR"]);
    expect(app.observationError).toContain("could not be loaded");
    await app.loadRegionObservations();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(app.allObservations).toHaveLength(2);
    expect(app.observationError).toBe("");
  });

  it("deduplicates a sighting returned for both a country and its subregion", async () => {
    fetchMock.mockImplementation(async () => response([row()]));
    app.regionSelected = [{ code: "US", name: "United States" }, { code: "US-CA", name: "California" }];
    await app.loadRegionObservations();
    expect(app.allObservations).toHaveLength(1);
  });

  it("ignores a nearby response after switching back to an empty region selection", async () => {
    let resolveNearby;
    fetchMock.mockImplementation(() => new Promise(resolve => { resolveNearby = resolve; }));
    app.locationCoords = { latitude: 46.8, longitude: 8.2 };
    const nearby = app.loadNearbyObservations();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await app.loadRegionObservations();
    resolveNearby(response([row()]));
    await nearby;
    expect(app.isMylocation).toBe(false);
    expect(app.observationsMylocation).toEqual([]);
    expect(app.isLoading).toBe(false);
  });

  it("refreshes cached data and limits the nearby radius after settings change", async () => {
    fetchMock.mockImplementation(async () => response([row()]));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    app.distMax = 10;
    await app.reload(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("back")).toBe("7");
    expect(app.distSelected).toBe(10);
  });

  it("retries a stalled request once and exposes timeout feedback if both attempts stall", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    const loading = app.loadRegionObservations();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20000);
    await loading;
    expect(app.observationError).toContain("automatic retry");
    expect(app.isLoading).toBe(false);
  });

  it("loads sightings when the automatic timeout retry succeeds", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })).mockResolvedValueOnce(response([row()]));
    app.regionSelected = [{ code: "FR", name: "France" }];
    const loading = app.loadRegionObservations();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(20000);
    await loading;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(app.allObservations).toHaveLength(1);
    expect(app.observationError).toBe("");
  });
});


describe("analytics interactions", () => {
  it("records network and cached loads, refreshes and failures without observation data", async () => {
    fetchMock.mockResolvedValueOnce(response([row()]));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    await app.loadRegionObservations();
    await app.loadRegionObservations();
    fetchMock.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await app.reload();
    expect(trackEvent.mock.calls).toEqual([
      ["data_load", { region_code: "CH", mode: "region", outcome: "success", source: "network" }],
      ["data_load", { region_code: "CH", mode: "region", outcome: "success", source: "cache" }],
      ["data_load", { region_code: "CH", mode: "region", outcome: "failure", source: "network" }],
    ]);
  });
  it("records native completion, cancellation, failure and clipboard outcomes", async () => {
    vi.stubGlobal("navigator", { share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    await app.shareLink();
    navigator.share.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
    await app.shareLink();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    navigator.share.mockRejectedValueOnce(new Error("Failed"));
    await app.shareLink();
    navigator.share = undefined;
    navigator.clipboard.writeText.mockRejectedValueOnce(new Error("Failed"));
    await app.shareLink();
    expect(trackEvent.mock.calls).toEqual([
      ["share", { method: "native", outcome: "completed" }],
      ["share", { method: "native", outcome: "cancelled" }],
      ["share", { method: "native", outcome: "failed" }],
      ["share", { method: "clipboard", outcome: "copied" }],
      ["share", { method: "clipboard", outcome: "failed" }],
    ]);
  });
  it("counts explicit layer changes once and never sends free-text filters", async () => {
    app.setMapStyleKey("streets");
    app.setMapStyleKey("satellite");
    app.setMapStyleKey("satellite");
    app.filterSearch = "private search";
    app.trackSetting("media_filter", true);
    expect(trackEvent.mock.calls).toEqual([["map_layer_change", { layer: "satellite" }], ["setting_change", { setting_name: "media_filter", setting_value: "true" }]]);
  });
});


it("records around loads and mode switches without coordinates", async () => {
  app.locationCoords = { latitude: 46.8, longitude: 8.2 };
  fetchMock.mockResolvedValueOnce(response([row()]));
  await app.myLocation();
  await app.loadRegionObservations([]);
  expect(trackEvent.mock.calls).toEqual([
    ["mode_change", { mode: "around" }],
    ["data_load", { mode: "around", outcome: "success", source: "network" }],
    ["mode_change", { mode: "region" }],
  ]);
});
