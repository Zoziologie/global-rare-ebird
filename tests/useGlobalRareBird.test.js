// @vitest-environment happy-dom
import { createApp, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGlobalRareBird } from "../src/composables/useGlobalRareBird.js";

vi.mock("../src/config/index.js", () => ({
  ebirdApiKey: "fixture-token", ebirdBaseUrl: "https://api.ebird.org/v2",
  mapboxStyles: [{ key: "streets", url: "mapbox://styles/mapbox/streets-v12" }],
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
  window.history.replaceState(null, "", "/global-rare-ebird/");
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
  it("authenticates with a header and reuses regions when adding a selection", async () => {
    fetchMock.mockResolvedValueOnce(response([row("FR")])).mockResolvedValueOnce(response([row("CH")]));
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
      .mockResolvedValueOnce(response([row("CH")]));
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

  it("ends a stalled request after 20 seconds and exposes retry feedback", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    app.regionSelected = [{ code: "CH", name: "Switzerland" }];
    const loading = app.loadRegionObservations();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(20000);
    await loading;
    expect(app.observationError).toContain("try again");
    expect(app.isLoading).toBe(false);
  });
});
