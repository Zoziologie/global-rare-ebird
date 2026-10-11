export function getGoogleMapsDirectionsUrl(latLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${latLng.lat},${latLng.lng}`
}
