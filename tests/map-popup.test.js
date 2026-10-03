// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from "vue";
import { expect, it, vi } from "vitest";
import MapView from "../src/components/MapView.vue";
import { birdAppKey } from "../src/composables/useGlobalRareBird.js";

vi.mock("../src/config/index.js", () => ({ mapboxAccessToken: "" }));

it("keeps expanded comments beneath their sighting controls and toggles them independently", async () => {
  const app = reactive({
    isMobileLayout: true, sidebarOpen: false, highlightedSpeciesCode: null, detailRevision: 0,
    popupLocation: {
      locName: "Klingnauer Stausee", locId: "L1", latLng: { lat: 47.6, lng: 8.2 },
      sp: [{ comName: "Black-winged Pratincole", speciesCode: "bkwpra", obs: [
        { obsId: "S1", subId: "S1", speciesCode: "bkwpra", daysAgo: 1, obsDt: "2026-10-02 12:50", howMany: 1, userDisplayName: "Dennis Rieder", hasRichMedia: true },
        { obsId: "S2", subId: "S2", speciesCode: "bkwpra", daysAgo: 1, obsDt: "2026-10-02 13:42", howMany: 1, userDisplayName: "Michael Gerber" },
      ] }],
    },
    observationDetails: {
      S1: { status: "loaded", isOpen: true, comments: "Twitch <near the lake>", mediaCounts: { P: 2 } },
      S2: { status: "loaded", isOpen: true, comments: "See pictures", mediaCounts: {} },
    },
    toggleObservationDetails: vi.fn((id) => { app.observationDetails[id].isOpen = !app.observationDetails[id].isOpen; }),
    loadMedia: vi.fn(),
  });
  const host = document.createElement("div");
  const component = createApp(MapView);
  component.provide(birdAppKey, app);
  component.mount(host);
  try {
    const rows = host.querySelectorAll(".map-popup__observation");
    expect(rows).toHaveLength(2);
    expect(rows[0].lastElementChild.className).toBe("map-popup__observation-details");
    expect(rows[0].querySelector(".map-popup__comment-quote").textContent).toBe("Twitch <near the lake>");
    expect(rows[0].querySelector(".map-popup__flags .map-popup__observation-details")).toBeNull();
    rows[0].querySelector("[data-media-id]").click();
    expect(app.loadMedia).toHaveBeenCalledWith("S1");
    rows[0].querySelector("[data-details-id]").click();
    await nextTick();
    expect(host.querySelectorAll(".map-popup__comment-quote")).toHaveLength(1);
    expect(host.querySelector(".map-popup__comment-quote").textContent).toBe("See pictures");
    expect(host.querySelector('[data-details-id="S1"]').getAttribute("aria-expanded")).toBe("false");
  } finally {
    component.unmount();
  }
});
