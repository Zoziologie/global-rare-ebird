export function createWorldBounds() {
  return {
    west: -180,
    south: -90,
    east: 180,
    north: 90,
  }
}

export function createBoundsFromPoints(points) {
  if (!points.length) {
    return null
  }

  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const point of points) {
    const lng = Number(point.lng)
    const lat = Number(point.lat)

    if (Number.isNaN(lng) || Number.isNaN(lat)) {
      continue
    }

    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  }

  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null
  }

  return { west, south, east, north }
}

export function toMapboxBounds(bounds) {
  if (!bounds) {
    return null
  }

  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ]
}

export function boundsContains(bounds, point, padding = 0) {
  if (!bounds || !point) {
    return true
  }

  const west = Number(bounds.west)
  const south = Number(bounds.south)
  const east = Number(bounds.east)
  const north = Number(bounds.north)
  const lng = Number(point.lng)
  const lat = Number(point.lat)

  if ([west, south, east, north, lng, lat].some((value) => Number.isNaN(value))) {
    return false
  }

  const crossesDateline = east < west
  const width = crossesDateline ? 360 - (west - east) : east - west
  const height = north - south
  const shrinkX = width > 0 ? (width * padding) / 2 : 0
  const shrinkY = height > 0 ? (height * padding) / 2 : 0

  const withinLatitude = lat >= south + shrinkY && lat <= north - shrinkY
  const withinLongitude = crossesDateline
    ? lng >= west + shrinkX || lng <= east - shrinkX
    : lng >= west + shrinkX && lng <= east - shrinkX

  return withinLatitude && withinLongitude
}
