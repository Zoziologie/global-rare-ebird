export function formatTravelDuration(durationSeconds) {
  const totalMinutes = Math.round(durationSeconds / 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`
}

export async function fetchRouteEstimate({ origin, destination, mode, accessToken }) {
  const coordinates = [
    `${origin.longitude},${origin.latitude}`,
    `${destination.lng},${destination.lat}`,
  ].join(";")
  const params = new URLSearchParams({ access_token: accessToken, overview: "false" })
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let response

  try {
    response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinates}?${params}`,
      { signal: controller.signal },
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error("Travel estimate unavailable. Try again or open directions.")
  }

  const result = await response.json()
  const route = result.routes?.[0]

  if (!route) {
    throw new Error("No route found to this reported location. Try opening directions.")
  }

  return {
    duration: route.duration,
    distance: route.distance,
    snapDistance: result.waypoints?.[1]?.distance ?? 0,
  }
}
