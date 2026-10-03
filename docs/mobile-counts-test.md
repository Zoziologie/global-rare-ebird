# Reproduce mobile marker-count rendering

The April 5, 2026 chat “Fix mobile map view lag” recorded Chrome becoming unresponsive and sometimes crashing on a Pixel 8 with vector basemaps. A raster basemap worked; adding glyph-based counts brought the slowdown back. HTML markers then visibly lagged during pan/zoom. These observations isolate problematic rendering paths, but do not identify a browser/GPU root cause or a limit on numerical values.

The new mobile overlay draws counts on one transparent 2D canvas from Mapbox's `render` event. It queries the visible circle layers, projects their current positions, and redraws every map frame. Desktop retains its native text layers. Existing circles still handle taps. Canvas resolution is capped at 2× CSS pixels to limit the drawing surface on high-DPR phones.

## Run the fixed-data test

```sh
npm ci
npm run dev -- --host 0.0.0.0 --port 5174
```

Open `http://localhost:5174/global-rare-ebird/map-counts-test.html` on the computer, or the Network address printed by Vite plus `map-counts-test.html` on a phone on the same Wi-Fi. The computer must stay running. This page is development-only and is not included in the production build.

The page uses 50, 500, or 5,000 deterministic synthetic locations and counts from 1 to 10,000, yielding larger cluster totals. It makes no eBird requests. Set the public `MAPBOX_ACCESS_TOKEN` in `.env.local` (Mapbox GL requires it even with a blank style). The blank basemap makes no tile requests. Raster streets/satellite require network access.

1. Start with 500 locations, clustering on, blank basemap. Run the fixed 12-second pan/zoom sequence with Counts off, then on. Repeat each three times after the first warm-up run.
2. Repeat with 50 and 5,000 locations, and clustering off. The 5,000 unclustered case deliberately stresses the drawing/query workload.
3. Repeat with raster streets and satellite. Let tiles finish loading before comparing runs.
4. Pan and pinch manually; counts should stay centered, update as clusters split, and remain readable for both individual locations and large totals.
5. Rotate the phone, toggle counts, change density/clustering, and switch basemaps. Counts should clear and redraw, without stale labels or duplicate canvases.
6. Open the real app on the same server. Switch list/map, select a species, tap a location/cluster, change basemap, and resize between desktop/mobile. Confirm counts match the current filter and taps still work.

Record device, OS/browser version, viewport, DPR, density, clustering, basemap, counts toggle, frame-interval p95, count-drawing p95, and any drift/lag. Timing includes querying, projection, clearing, and drawing the counts. Frame intervals are render-event spacing, not a complete GPU performance profile; compare like-for-like runs rather than treating them as benchmark FPS. Desktop mobile emulation is useful for layout but did not reproduce the Pixel problem.

## Offline regression checks

```sh
npm test -- tests/map-count-overlay.test.js
npm run check
npm audit
```

Fixed map/context mocks check exact cluster observation totals and individual counts, duplicate tile copies, updated positions/source data, high-DPR scaling, resize/style clearing, offscreen centers, and listener/canvas cleanup. They require no credentials or network. They verify behavior, not physical-device rendering speed.

## Initial browser observations (2026-10-03)

Desktop Chromium, 390×844 CSS pixels, DPR 1, one run per case after loading:

| Fixed scenario | Frame interval p95 | Count drawing p95 |
| --- | ---: | ---: |
| 500 locations, clustered, blank, counts off | 14.3 ms | 0.00 ms |
| 500 locations, clustered, blank, counts on | 14.5 ms | 0.60 ms |
| 500 locations, clustered, raster streets, counts on | 14.4 ms | 0.50 ms |
| 5,000 locations, unclustered, blank, counts on | 16.0 ms | 10.20 ms |

The unclustered stress case had 4,115 visible labels at the end of the camera sequence. It exposes the cost of drawing thousands of labels; it should not be treated as evidence of acceptable phone performance. Clustering substantially reduces the visible workload.

Raster streets/satellite, portrait/landscape resizing, and counts toggling retained one overlay and visible counts. The live-data app displayed mobile point/cluster counts, and a point tap opened its normal detail sheet. The style-switch test exposed observation layers being removed by Mapbox's style diff; explicit style reloads now rebuild them on `style.load`. An offline component regression covers this rebuild, desktop text restoration, mobile re-entry, and unmount cleanup.

The user confirmed the test works on their phone on 2026-10-03 and approved merging. No phone timing measurements were recorded.
