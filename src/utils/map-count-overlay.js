// Draw counts outside Mapbox's glyph pipeline, on the same render event as the map.
export function createMapCountOverlay(map, layerIds) {
  const canvas = document.createElement("canvas");
  canvas.className = "map-pane__count-overlay";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", inset: "0", pointerEvents: "none" });
  map.getCanvasContainer().appendChild(canvas);
  const context = canvas.getContext("2d");
  const stats = { count: 0, drawMs: 0 };

  function render() {
    const started = performance.now();
    const { clientWidth: width, clientHeight: height } = map.getCanvas();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.font = "600 12px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f8fafc";
    context.strokeStyle = "rgba(15, 23, 42, 0.7)";
    context.lineWidth = 2.4;
    context.lineJoin = "round";
    stats.count = 0;
    const layers = layerIds.filter((id) => map.getLayer(id));
    const seen = new Set();
    if (layers.length && width && height) {
      for (const feature of map.queryRenderedFeatures({ layers })) {
        const coordinates = feature.geometry.coordinates;
        const key = `${feature.properties.cluster_id ?? feature.properties.locId}:${coordinates}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { x, y } = map.project(coordinates);
        if (x < 0 || x > width || y < 0 || y > height) continue;
        const count = feature.properties.obsCount ?? feature.properties.count ?? feature.properties.point_count;
        // Fit exact counts inside the existing circles, including very large totals.
        const maxWidth = feature.properties.point_count ? Math.min(54, 26 + feature.properties.point_count) : 32;
        context.strokeText(String(count), x, y, maxWidth);
        context.fillText(String(count), x, y, maxWidth);
        stats.count += 1;
      }
    }
    stats.drawMs = performance.now() - started;
  }

  map.on("render", render);
  return {
    canvas, stats, render,
    clear() { context.clearRect(0, 0, canvas.width, canvas.height); },
    remove() {
      map.off("render", render);
      canvas.remove();
    },
  };
}
