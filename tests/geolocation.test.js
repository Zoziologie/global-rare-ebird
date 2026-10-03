import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { createGeolocationController } from "../src/composables/geolocationController.js";

function controller() {
  const state = { locationCoords: ref(null), locationPermission: ref("unknown"), locationFeedback: ref(""), observationsMylocation: ref([]), observationsRegionByCode: {}, fitRequest: ref(0), applyDistanceToObservations: vi.fn() };
  return { state, ...createGeolocationController(state) };
}

describe("geolocation consent", () => {
  it("does not prompt for location on startup when permission cannot be checked", async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await controller().primeGeolocationForDisplay();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("does not prompt when permission has not been granted", async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition }, permissions: { query: vi.fn().mockResolvedValue({ state: "prompt" }) } });
    await controller().primeGeolocationForDisplay();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("reports an explicit denied location request to the user", async () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (resolve, reject) => reject({ code: 1 }) } });
    const { state, requestGeolocation } = controller();
    await expect(requestGeolocation()).rejects.toMatchObject({ code: 1 });
    expect(state.locationPermission.value).toBe("denied");
    expect(state.locationFeedback.value).toContain("denied");
  });
});
