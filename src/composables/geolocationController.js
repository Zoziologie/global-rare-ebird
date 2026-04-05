const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 60 * 1000,
}

function normalizeGeolocationError(error) {
  switch (error?.code) {
    case 1:
      return {
        permission: "denied",
        feedback: "Location access is denied in this browser.",
      }
    case 2:
      return {
        permission: "unavailable",
        feedback: "Location could not be determined right now.",
      }
    case 3:
      return {
        permission: "timeout",
        feedback: "Location request timed out. Try again.",
      }
    default:
      return {
        permission: "error",
        feedback: error?.message || "Unable to access your location.",
      }
  }
}

function geolocationFailureLooksTransient(error) {
  const message = String(error?.message || "").toLowerCase()
  return error?.code === 2 || message.includes("locationunknown") || message.includes("unknown")
}

function getCurrentPositionOnce(geoOptions) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, geoOptions)
  })
}

export function createGeolocationController({
  locationCoords,
  locationPermission,
  locationFeedback,
  observationsMylocation,
  observationsRegionByCode,
  fitRequest,
  applyDistanceToObservations,
}) {
  function setLocationState(permission, feedback = "") {
    locationPermission.value = permission
    locationFeedback.value = feedback
  }

  async function refreshGeolocationPermission() {
    if (!navigator.permissions?.query) {
      return locationPermission.value
    }

    try {
      const result = await navigator.permissions.query({ name: "geolocation" })
      if (result?.state === "granted" || result?.state === "denied" || result?.state === "prompt") {
        locationPermission.value = result.state
      }
      return locationPermission.value
    } catch {
      return locationPermission.value
    }
  }

  async function requestGeolocation({ silent = false } = {}) {
    if (!("geolocation" in navigator)) {
      const error = new Error("Geolocation unavailable")
      if (!silent) {
        setLocationState("unavailable", "Geolocation is not available in this browser.")
      }
      throw error
    }

    void refreshGeolocationPermission()

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const position = await getCurrentPositionOnce(GEO_OPTIONS)
        locationCoords.value = position.coords
        setLocationState("granted", "")
        applyDistanceToObservations(observationsMylocation.value, position.coords)
        for (const observations of Object.values(observationsRegionByCode)) {
          applyDistanceToObservations(observations, position.coords)
        }
        fitRequest.value += 1
        return position.coords
      } catch (error) {
        if (attempt === 0 && geolocationFailureLooksTransient(error)) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }

        if (!silent) {
          const normalized = normalizeGeolocationError(error)
          setLocationState(normalized.permission, normalized.feedback)
        }
        throw error
      }
    }
  }

  async function primeGeolocationForDisplay() {
    if (!("geolocation" in navigator)) {
      return
    }

    if (navigator.permissions?.query) {
      try {
        const result = await navigator.permissions.query({ name: "geolocation" })
        if (result?.state !== "granted") {
          return
        }
      } catch {
        return
      }
    }

    await requestGeolocation({ silent: true }).catch(() => null)
  }

  return {
    requestGeolocation,
    primeGeolocationForDisplay,
  }
}
