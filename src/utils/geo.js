import { createBoundsFromPoints } from "./bounds"

const EARTH_RADIUS_KM = 6371

function toRadians(value) {
  return (value * Math.PI) / 180
}

function toDegrees(value) {
  return (value * 180) / Math.PI
}

function normalizeLongitude(value) {
  return ((((value + 180) % 360) + 360) % 360) - 180
}

export function createGeodesicCircle(center, radiusKm, steps = 96) {
  const lat = Number(center?.lat)
  const lng = Number(center?.lng)
  const distance = Number(radiusKm)

  if ([lat, lng, distance].some((value) => !Number.isFinite(value)) || distance < 0) {
    return []
  }

  const angularDistance = distance / EARTH_RADIUS_KM
  const latRad = toRadians(lat)
  const lngRad = toRadians(lng)
  const coordinates = []

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (2 * Math.PI * index) / steps
    const sinLat = Math.sin(latRad)
    const cosLat = Math.cos(latRad)
    const sinAngularDistance = Math.sin(angularDistance)
    const cosAngularDistance = Math.cos(angularDistance)

    const nextLat = Math.asin(
      sinLat * cosAngularDistance + cosLat * sinAngularDistance * Math.cos(bearing),
    )
    const nextLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * sinAngularDistance * cosLat,
        cosAngularDistance - sinLat * Math.sin(nextLat),
      )

    coordinates.push([normalizeLongitude(toDegrees(nextLng)), toDegrees(nextLat)])
  }

  return coordinates
}

export function createGeodesicCircleFeature(center, radiusKm, steps = 96) {
  const coordinates = createGeodesicCircle(center, radiusKm, steps)

  if (!coordinates.length) {
    return null
  }

  return {
    type: "Feature",
    properties: {
      radiusKm: Number(radiusKm),
    },
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
  }
}

export function createGeodesicCircleBounds(center, radiusKm, steps = 96) {
  const ring = createGeodesicCircle(center, radiusKm, steps)

  if (!ring.length) {
    return null
  }

  return createBoundsFromPoints(ring.map(([lng, lat]) => ({ lng, lat })))
}
