// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from "vue"
import { expect, it } from "vitest"
import SidebarPanel from "../src/components/SidebarPanel.vue"
import { birdAppKey } from "../src/composables/useGlobalRareBird.js"

it("keeps sidebar observer names in one line when clicked", async () => {
  const app = reactive({
    activeStatusSystem: "",
    backMax: 30,
    backSelected: 7,
    clearHighlight() {},
    distMax: 100,
    distSelected: 10,
    filterSearch: "",
    filterSearchOptions: [],
    filterSearchOptionsSelected: [],
    filterSortOptions: [],
    filterSortOptionsSelected: [],
    fitToAllSightings() {},
    hasCandidateObservations: true,
    isLoading: false,
    isMobileLayout: false,
    isMylocation: false,
    loadMedia() {},
    loadRegionObservations() {},
    loadingLabel: "",
    locationFeedback: "",
    locationPermission: "unknown",
    mapViewportHiddenCount: 0,
    myLocation() {},
    observationDetails: {},
    observationError: "",
    openStatusBadgeModal() {},
    regionFallbackFeedback: "",
    regionSearch: [],
    regionSelected: [],
    reload() {},
    removeRegion() {},
    selectRegion() {},
    setHighlightLocationIds() {},
    setHighlightSpeciesCode() {},
    shareLink() {},
    speIndexMax: 10,
    speciesFiltered: [{
      speciesCode: "amewig",
      comName: "American Wigeon",
      obs: [{}],
      loc: [{
        locId: "L1",
        locName: "Lake",
        latLng: { lat: 46.8, lng: 8.2 },
        obs: [{
          subId: "S1",
          obsId: "S1",
          speciesCode: "amewig",
          daysAgo: 1,
          obsDt: "2026-10-03 09:00",
          howMany: 1,
          userDisplayName: "Alice, Bob",
        }],
      }],
    }],
    statusLimit: 10,
    statusOptions: [],
    toggleInstruction() {},
    toggleObservationDetails() {},
    toggleSidebar() {},
    trackSetting() {},
  })
  const host = document.createElement("div")
  const component = createApp(SidebarPanel)
  component.provide(birdAppKey, app)
  component.mount(host)

  try {
    host.querySelector(".accordion-button").click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 400))
    const observerName = host.querySelector(".species-location__user")
    expect(observerName.tagName).toBe("SPAN")
    expect(observerName.textContent).toBe("Alice, Bob")
    expect(observerName.title).toBe("Alice, Bob")
    observerName.click()
    await nextTick()
    expect(host.querySelector(".species-location__observers")).toBeNull()
  } finally {
    component.unmount()
  }
})
