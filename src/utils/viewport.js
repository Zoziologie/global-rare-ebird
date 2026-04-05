export function pointInViewport(map, point, paddingPx = 0) {
  if (!map || !point) {
    return true
  }

  const lng = Number(point.lng)
  const lat = Number(point.lat)

  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    return false
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
