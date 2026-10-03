// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from "vue";
import { expect, it, vi } from "vitest";
import MapView from "../src/components/MapView.vue";
import { birdAppKey } from "../src/composables/useGlobalRareBird.js";

const maps = vi.hoisted(() => []);
vi.mock("../src/config/index.js", () => ({ mapboxAccessToken: "pk.test" }));
vi.mock("mapbox-gl", () => ({ default: {
  NavigationControl: class {},
  Map: class {
    constructor(options) {
      this.options = options;
      this.container = options.container;
      this.canvas = document.createElement("canvas");
      this.container.appendChild(this.canvas);
      this.layers = new Map();
      this.sources = new Map();
      this.listeners = new Map();
      maps.push(this);
    }
    on(event, callback) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), callback]); }
    off(event, callback) { this.listeners.set(event, this.listeners.get(event).filter((handler) => handler !== callback)); }
    emit(event) { for (const handler of this.listeners.get(event) ?? []) handler(); }
    getLayer(id) { return this.layers.get(id); }
    addLayer(layer) { this.layers.set(layer.id, layer); }
    removeLayer(id) { this.layers.delete(id); }
    getSource(id) { return this.sources.get(id); }
    addSource(id, source) { this.sources.set(id, { ...source, setData: vi.fn() }); }
    getCanvasContainer() { return this.container; }
    getCanvas() { return this.canvas; }
    setFilter() {}
    addControl() {}
    resize() {}
    remove() {}
    setStyle = vi.fn(() => { this.layers.clear(); this.sources.clear(); });
  },
} }));

it("keeps one mobile overlay across styles, restores desktop text, and cleans up on unmount", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ clearRect: vi.fn() });
  const app = reactive({
    isMobileLayout: true, sidebarOpen: false, mapSelected: true,
    mapLocationCandidates: [], highlightedLocationIds: [], mapStyles: [],
    mapStyleKey: "streets", mapStyle: "mapbox://styles/mapbox/streets-v12",
    popupLocation: null, isMylocation: false,
  });
  const host = document.createElement("div");
  const component = createApp(MapView);
  component.provide(birdAppKey, app);
  component.mount(host);
  await vi.waitFor(() => expect(document.querySelector('link[data-mapbox-gl-css="true"]')).not.toBeNull());
  document.querySelector('link[data-mapbox-gl-css="true"]').dispatchEvent(new Event("load"));
  await vi.waitFor(() => expect(maps).toHaveLength(1));
  const map = maps[0];
  try {
    map.emit("load");
    expect(map.options.style.glyphs).toBeUndefined();
    expect(host.querySelectorAll(".map-pane__count-overlay")).toHaveLength(1);
    expect(map.getLayer("rare-birds-clusters-count")).toBeUndefined();
    app.mapStyle = "mapbox://styles/mapbox/satellite-streets-v12";
    await nextTick();
    expect(map.setStyle.mock.lastCall[1]).toEqual({ diff: false });
    map.emit("style.load");
    expect(host.querySelectorAll(".map-pane__count-overlay")).toHaveLength(1);
    expect(map.getLayer("rare-birds-clusters")).toBeDefined();
    app.isMobileLayout = false;
    await nextTick();
    map.emit("style.load");
    expect(host.querySelectorAll(".map-pane__count-overlay")).toHaveLength(0);
    expect(map.getLayer("rare-birds-clusters-count").type).toBe("symbol");
    expect(map.listeners.get("render")).toHaveLength(0);
    app.isMobileLayout = true;
    await nextTick();
    map.emit("style.load");
    expect(host.querySelectorAll(".map-pane__count-overlay")).toHaveLength(1);
  } finally {
    component.unmount();
  }
  expect(map.listeners.get("render")).toHaveLength(0);
});
