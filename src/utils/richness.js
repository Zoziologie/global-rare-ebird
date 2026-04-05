const richnessColorStops = [
  [1, "#d7c090"],
  [2, "#c6aa7a"],
  [4, "#af8b5e"],
  [8, "#916847"],
  [16, "#714f38"],
  [32, "#51382a"],
]

export function getRichnessColor(value) {
  const richness = Number(value)
  const fallback = richnessColorStops[0][1]

  if (!Number.isFinite(richness) || richness <= 1) {
    return fallback
  }

  for (let index = richnessColorStops.length - 1; index >= 0; index -= 1) {
    const [threshold, color] = richnessColorStops[index]
    if (richness >= threshold) {
      return color
    }
  }

  return fallback
}

export function getRichnessColorExpression(propertyExpression = ["coalesce", ["get", "speciesCount"], 1]) {
  const expression = ["interpolate", ["linear"], propertyExpression]

  for (const [threshold, color] of richnessColorStops) {
    expression.push(threshold, color)
  }

  return expression
}

export function getClusterMarkerSize(sightings) {
  const count = Math.max(1, Number(sightings) || 0)
  return Math.round(Math.min(68, 30 + Math.sqrt(count) * 4.2))
}
