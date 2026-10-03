import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { mapboxAccessToken } from "../config/index.js";
import { createMapCountOverlay } from "../utils/map-count-overlay.js";

const density = document.querySelector("#density");
const clustered = document.querySelector("#cluster");
const counts = document.querySelector("#counts");
const basemap = document.querySelector("#basemap");
const report = document.querySelector("#report");
const run = document.querySelector("#run");
const map = new mapboxgl.Map({
  container: "map", style: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#dce6ec" } }] },
  center: [8, 47], zoom: 5, attributionControl: true, renderWorldCopies: false,
  dragRotate: false, touchPitch: false, fadeDuration: 0, crossSourceCollisions: false,
  precompilePrograms: false, performanceMetricsCollection: false,
});
let overlay = null;
let started = 0;
let previousFrame = 0;
const frameIntervals = [];
const drawTimes = [];
let lastReport = 0;

function mountScenario() {
  overlay?.remove();
  if (map.getLayer("clusters")) map.removeLayer("clusters");
  if (map.getLayer("points")) map.removeLayer("points");
  if (map.getSource("test-points")) map.removeSource("test-points");
  map.addSource("test-points", {
    type: "geojson", cluster: clustered.checked, clusterRadius: 50, clusterMaxZoom: 12,
    clusterProperties: { obsCount: ["+", ["get", "count"]] },
    data: {
      type: "FeatureCollection",
      features: Array.from({ length: Number(density.value) }, (_, i) => ({
        type: "Feature", id: i,
        geometry: { type: "Point", coordinates: [3 + ((i * 137) % 1000) / 100, 44 + ((i * 97) % 600) / 100] },
        properties: { locId: String(i), count: [1, 2, 9, 10, 99, 100, 999, 10000][i % 8] },
      })),
    },
  });
  map.addLayer({ id: "points", source: "test-points", type: "circle", filter: ["!", ["has", "point_count"]], paint: { "circle-color": "#327b35", "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 10, 3, 13, 8, 16, 20, 20] } });
  map.addLayer({ id: "clusters", source: "test-points", type: "circle", filter: ["has", "point_count"], paint: { "circle-color": "#5268a0", "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 16, 5, 20, 10, 24, 20, 30] } });
  overlay = counts.checked ? createMapCountOverlay(map, ["points", "clusters"]) : null;
  map.off("render", sampleFrame);
  map.on("render", sampleFrame);
  map.triggerRepaint();
}

function updateReport() {
  const sortedFrames = [...frameIntervals].sort((a, b) => a - b);
  const sortedDraws = [...drawTimes].sort((a, b) => a - b);
  report.textContent = `${density.value} locations · ${clustered.checked ? "clustered" : "unclustered"} · counts ${counts.checked ? "on" : "off"} · ${basemap.value} · DPR ${window.devicePixelRatio} · visible labels ${overlay?.stats.count ?? 0} · ${frameIntervals.length} frame intervals · frame p95 ${(sortedFrames[Math.floor(sortedFrames.length * 0.95)] ?? 0).toFixed(1)} ms · count drawing p95 ${(sortedDraws[Math.floor(sortedDraws.length * 0.95)] ?? 0).toFixed(2)} ms${started ? " · running…" : ""}`;
}

map.on("load", mountScenario);
for (const input of [density, clustered, counts]) input.addEventListener("change", () => { mountScenario(); updateReport(); });
basemap.addEventListener("change", () => {
  if (basemap.value !== "blank" && !mapboxAccessToken) {
    report.textContent = "Set MAPBOX_ACCESS_TOKEN in .env.local and restart Vite to test raster tiles.";
    basemap.value = "blank";
    return;
  }
  overlay?.clear();
  map.once("style.load", mountScenario);
  const styleId = basemap.value === "satellite" ? "satellite-streets-v12" : "streets-v12";
  map.setStyle(basemap.value === "blank"
    ? { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#dce6ec" } }] }
    : { version: 8, sources: { basemap: { type: "raster", tileSize: 512, tiles: [`https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/512/{z}/{x}/{y}?access_token=${mapboxAccessToken}`], attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' } }, layers: [{ id: "basemap", type: "raster", source: "basemap" }] });
});
run.addEventListener("click", () => {
  map.stop();
  started = 0;
  map.jumpTo({ center: [8, 47], zoom: 5 });
  frameIntervals.length = 0;
  drawTimes.length = 0;
  previousFrame = 0;
  started = performance.now();
  for (const input of [run, density, clustered, counts, basemap]) input.disabled = true;
  map.easeTo({ center: [10, 48], zoom: 8, duration: 4000, easing: (t) => t });
  map.once("moveend", () => {
    map.easeTo({ center: [6, 46], zoom: 11, duration: 4000, easing: (t) => t });
    map.once("moveend", () => {
      map.easeTo({ center: [8, 47], zoom: 5, duration: 4000, easing: (t) => t });
      map.once("moveend", () => { started = 0; for (const input of [run, density, clustered, counts, basemap]) input.disabled = false; updateReport(); });
    });
  });
});
// This listener follows the overlay so timings include this frame's drawing.
function sampleFrame() {
  const now = performance.now();
  if (started) {
    if (previousFrame) frameIntervals.push(now - previousFrame);
    previousFrame = now;
    drawTimes.push(overlay?.stats.drawMs ?? 0);
  }
  if (now - lastReport > 500) { updateReport(); lastReport = now; }
}
map.on("error", (event) => { report.textContent = `Map error: ${event.error.message}`; });
