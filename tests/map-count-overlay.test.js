// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import { createMapCountOverlay } from "../src/utils/map-count-overlay.js";

let context, map, container, features, listeners;
beforeEach(() => {
  context = Object.fromEntries(["setTransform", "clearRect", "strokeText", "fillText"].map((name) => [name, vi.fn()]));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
  Object.defineProperty(window, "devicePixelRatio", { value: 3, configurable: true });
  container = document.createElement("div");
  features = [
    { properties: { cluster_id: 4, point_count: 2, obsCount: 123456 }, geometry: { coordinates: [10, 20] } },
    { properties: { locId: "L1", count: 7 }, geometry: { coordinates: [30, 40] } },
  ];
  listeners = new Map();
  map = {
    getCanvasContainer: () => container,
    getCanvas: () => ({ clientWidth: 200, clientHeight: 100 }),
    getLayer: vi.fn(() => true),
    queryRenderedFeatures: vi.fn(() => features),
    project: vi.fn(([x, y]) => ({ x, y })),
    on: vi.fn((event, handler) => listeners.set(event, handler)),
    off: vi.fn((event, handler) => { if (listeners.get(event) === handler) listeners.delete(event); }),
  };
});

it("draws exact cluster observation totals and point counts, deduplicating tile copies", () => {
  features.push(features[0]);
  const overlay = createMapCountOverlay(map, ["points", "clusters"]);
  listeners.get("render")();
  expect(context.fillText.mock.calls).toEqual([["123456", 10, 20, 28], ["7", 30, 40, 32]]);
  expect(overlay.stats.count).toBe(2);
  expect(overlay.canvas.width).toBe(400);
  expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
  expect(overlay.canvas.style.pointerEvents).toBe("none");
});

it("projects fresh positions each frame and replaces counts after source changes", () => {
  const overlay = createMapCountOverlay(map, ["points"]);
  overlay.render();
  map.project.mockImplementation(([x, y]) => ({ x: x + 15, y: y + 5 }));
  features = [{ properties: { locId: "L2", count: 99 }, geometry: { coordinates: [40, 50] } }];
  overlay.render();
  expect(context.fillText).toHaveBeenLastCalledWith("99", 55, 55, 32);
  expect(context.clearRect).toHaveBeenCalledTimes(2);
});

it("resizes with the map and clears stale labels while styles reload", () => {
  const overlay = createMapCountOverlay(map, ["points"]);
  overlay.render();
  map.getCanvas = () => ({ clientWidth: 100, clientHeight: 200 });
  map.getLayer.mockReturnValue(false);
  overlay.render();
  expect(overlay.canvas.width).toBe(200);
  expect(overlay.canvas.height).toBe(400);
  expect(overlay.stats.count).toBe(0);
  expect(context.clearRect).toHaveBeenLastCalledWith(0, 0, 100, 200);
  expect(map.queryRenderedFeatures).toHaveBeenCalledTimes(1);
});

it("skips offscreen centers and removes the render listener and canvas", () => {
  features[0].geometry.coordinates = [-20, 10];
  const overlay = createMapCountOverlay(map, ["points"]);
  overlay.render();
  expect(overlay.stats.count).toBe(1);
  overlay.remove();
  expect(container.children).toHaveLength(0);
  expect(listeners.has("render")).toBe(false);
});

it("draws dense data without retaining labels removed by a filter", () => {
  features = Array.from({ length: 5000 }, (_, i) => ({
    properties: { locId: String(i), count: i + 1 }, geometry: { coordinates: [i % 200, i % 100] },
  }));
  const overlay = createMapCountOverlay(map, ["points"]);
  overlay.render();
  expect(overlay.stats.count).toBe(5000);
  expect(context.fillText).toHaveBeenLastCalledWith("5000", 199, 99, 32);
  features = [];
  overlay.render();
  expect(overlay.stats.count).toBe(0);
  expect(context.clearRect).toHaveBeenCalledTimes(2);
});

it("uses location counts and cluster point totals when observation totals are absent", () => {
  delete features[0].properties.obsCount;
  const overlay = createMapCountOverlay(map, ["clusters"]);
  overlay.render();
  expect(context.fillText).toHaveBeenCalledWith("2", 10, 20, 28);
  features[0].properties.obsCount = 0;
  overlay.render();
  expect(context.fillText).toHaveBeenCalledWith("0", 10, 20, 28);
});
