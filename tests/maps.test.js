import { expect, it } from "vitest"
import { getGoogleMapsDirectionsUrl } from "../src/utils/maps.js"

it("opens the standard Google Maps directions view for a location", () => {
  expect(getGoogleMapsDirectionsUrl({ lat: 47.6, lng: 8.2 })).toBe(
    "https://www.google.com/maps/dir/?api=1&destination=47.6,8.2",
  )
})
