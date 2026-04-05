import { boundsContains } from "./bounds"

function getExpandedBounds(map, paddingPx) {
  const bounds = map?.getBounds?.()
  const canvas = map?.getCanvas?.()
  const rect = canvas?.getBoundingClientRect?.()

  if (
    !bounds?.getWest ||
    !bounds?.getSouth ||
    !bounds?.getEast ||
    !bounds?.getNorth ||
    !rect?.width ||
    !rect?.height
  ) {
    return null
  }

  const west = Number(bounds.getWest())
  const south = Number(bounds.getSouth())
  const east = Number(bounds.getEast())
  const north = Number(bounds.getNorth())

  if ([west, south, east, north].some((value) => Number.isNaN(value))) {
    return null
  }

  const lngSpan = east >= west ? east - west : 360 - (west - east)
  const latSpan = north - south
  const padLng = lngSpan > 0 ? (lngSpan * paddingPx) / rect.width : 0
  const padLat = latSpan > 0 ? (latSpan * paddingPx) / rect.height : 0

  if (lngSpan + padLng * 2 >= 360) {
    return {
      west: -180,
      south: Math.max(-90, south - padLat),
      east: 180,
      north: Math.min(90, north + padLat),
    }
  }

  let expandedWest = west - padLng
  let expandedEast = east + padLng

  if (expandedWest < -180) {
    expandedWest += 360
  }

  if (expandedEast > 180) {
    expandedEast -= 360
  }

  return {
    west: expandedWest,
    south: Math.max(-90, south - padLat),
    east: expandedEast,
    north: Math.min(90, north + padLat),
  }
}

export function pointInViewport(map, point, paddingPx = 0) {
  if (!map || !point) {
    return true
  }

  const lng = Number(point.lng)
  const lat = Number(point.lat)

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return false
  }

  const expandedBounds = getExpandedBounds(map, paddingPx)
  if (expandedBounds) {
    return boundsContains(expandedBounds, { lng, lat })
  }

  const projected = map.project([lng, lat])
  const canvas = map.getCanvas?.()
  const rect = canvas?.getBoundingClientRect?.()

  if (!projected || !rect) {
    return false
  }

  return (
    projected.x >= -paddingPx &&
    projected.x <= rect.width + paddingPx &&
    projected.y >= -paddingPx &&
    projected.y <= rect.height + paddingPx
  )
}
