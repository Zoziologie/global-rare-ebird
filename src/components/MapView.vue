<template>
  <section class="map-pane">
    <button
      v-if="app.isMobileLayout && !app.sidebarOpen"
      type="button"
      class="map-pane__toggle"
      @click="app.toggleSidebar()"
    >
      <i class="bi bi-list"></i>
      <span>List</span>
    </button>
    <div ref="mapContainer" class="map-pane__map"></div>
    <Transition name="map-pane__mobile-popup-transition" appear>
      <div
        v-if="app.isMobileLayout && app.popupLocation"
        class="map-pane__mobile-popup"
        @click="handlePopupClick"
      >
        <div class="map-pane__mobile-popup-sheet">
          <div class="map-pane__mobile-popup-header">
            <div class="map-pane__mobile-popup-header-copy" v-html="mobilePopupHeaderHtml"></div>
            <button
              type="button"
              class="icon-button icon-button--inline map-pane__mobile-popup-close"
              aria-label="Close details"
              title="Close"
              @click.stop="app.closeLocationPopup()"
            >
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="map-popup map-pane__mobile-popup-body" v-html="mobilePopupSpeciesHtml"></div>
        </div>
      </div>
    </Transition>
    <div v-if="!hasToken" class="map-pane__warning">
      <h2>Mapbox token missing</h2>
      <p>Set <code>MAPBOX_ACCESS_TOKEN</code> and reload the app.</p>
    </div>
  </section>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import mapboxCssUrl from "mapbox-gl/dist/mapbox-gl.css?url"

import { mapboxAccessToken } from "../config/index.js"
import { birdAppKey } from "../composables/useGlobalRareBird"
import { createBoundsFromPoints, toMapboxBounds } from "../utils/bounds"
import { createGeodesicCircleBounds, createGeodesicCircleFeature } from "../utils/geo"
import { escapeHtml, formatDaysAgo, formatObservationTime } from "../utils/formatters"
import { getClusterCountColorExpression, getRichnessColorExpression } from "../utils/richness"
import { pointInViewport } from "../utils/viewport"

const app = inject(birdAppKey)

if (!app) {
  throw new Error("MapView requires the bird app context")
}

const mapContainer = ref(null)
const mapInstance = ref(null)
const popupInstance = ref(null)
const mapReady = ref(false)
const lastFitRequest = ref(-1)
const hasToken = computed(() => Boolean(mapboxAccessToken))
const mobilePopupHeaderHtml = computed(() => {
  if (!app.popupLocation || !app.isMobileLayout) {
    return ""
  }

  return buildPopupLocationHeaderHtml(app.popupLocation)
})
const mobilePopupSpeciesHtml = computed(() => {
  if (!app.popupLocation || !app.isMobileLayout) {
    return ""
  }

  return buildPopupSpeciesHtml(app.popupLocation)
})
let resizeObserver = null
let styleSwitcherControl = null

const sourceId = "rare-birds"
const pointLayerId = "rare-birds-points"
const pointHighlightLayerId = "rare-birds-points-highlight"
const pointLabelLayerId = "rare-birds-points-label"
const clusterLayerId = "rare-birds-clusters"
const clusterCountLayerId = "rare-birds-clusters-count"
const myLocationSourceId = "rare-birds-mylocation-radius"
const myLocationFillLayerId = "rare-birds-mylocation-radius-fill"
const myLocationLineLayerId = "rare-birds-mylocation-radius-line"
const viewportPaddingPx = 32
let mapboxgl = null
let mapboxglPromise = null
let mapboxCssPromise = null
let highlightFrameId = null
let myLocationMarker = null
let mapboxPreloadHandle = null
let mapboxPreloadHandleType = null

function loadMapboxCss() {
  if (typeof document === "undefined") {
    return Promise.resolve()
  }

  if (document.querySelector('link[data-mapbox-gl-css="true"]')) {
    return Promise.resolve()
  }

  if (!mapboxCssPromise) {
    mapboxCssPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = mapboxCssUrl
      link.dataset.mapboxGlCss = "true"
      link.onload = () => {
        resolve()
      }
      link.onerror = () => {
        mapboxCssPromise = null
        link.remove()
        reject(new Error("Unable to load Mapbox styles"))
      }
      document.head.appendChild(link)
    })
  }

  return mapboxCssPromise
}

async function loadMapbox() {
  if (mapboxgl) {
    return mapboxgl
  }

  if (!mapboxglPromise) {
    mapboxglPromise = Promise.all([loadMapboxCss(), import("mapbox-gl")])
      .then(([, module]) => {
        mapboxgl = module.default
        return mapboxgl
      })
      .catch((error) => {
        mapboxglPromise = null
        throw error
      })
  }

  return mapboxglPromise
}

function shouldDeferMapInitialization() {
  return app.isMobileLayout && app.sidebarOpen
}

function shouldUseMobileRasterBasemap() {
  return false
}

function getMobileRasterStyleId() {
  return app.mapStyleKey === "satellite" ? "satellite-streets-v12" : "streets-v12"
}

function createMobileMapboxRasterStyle() {
  const styleId = getMobileRasterStyleId()

  return {
    version: 8,
    sources: {
      "mobile-mapbox-raster-basemap": {
        type: "raster",
        tiles: [
          `https://api.mapbox.com/styles/v1/mapbox/${styleId}/tiles/512/{z}/{x}/{y}?access_token=${mapboxAccessToken}`,
        ],
        tileSize: 512,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>',
      },
    },
    layers: [
      {
        id: "mobile-mapbox-raster-basemap",
        type: "raster",
        source: "mobile-mapbox-raster-basemap",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  }
}

function getMountedMapStyle(style = app.mapStyle) {
  return shouldUseMobileRasterBasemap() ? createMobileMapboxRasterStyle() : style
}

function cancelMapboxPreload() {
  if (typeof window === "undefined" || mapboxPreloadHandle === null) {
    return
  }

  if (mapboxPreloadHandleType === "idle" && "cancelIdleCallback" in window) {
    window.cancelIdleCallback(mapboxPreloadHandle)
  } else {
    window.clearTimeout(mapboxPreloadHandle)
  }

  mapboxPreloadHandle = null
  mapboxPreloadHandleType = null
}

function scheduleMapboxPreload() {
  if (
    typeof window === "undefined" ||
    !hasToken.value ||
    mapboxgl ||
    mapboxglPromise ||
    mapboxPreloadHandle !== null
  ) {
    return
  }

  const preload = () => {
    mapboxPreloadHandle = null
    mapboxPreloadHandleType = null
    void loadMapbox()
  }

  if ("requestIdleCallback" in window) {
    mapboxPreloadHandleType = "idle"
    mapboxPreloadHandle = window.requestIdleCallback(preload, { timeout: 1200 })
    return
  }

  mapboxPreloadHandleType = "timeout"
  mapboxPreloadHandle = window.setTimeout(preload, 250)
}

function getMapOptions() {
  const options = {
    container: mapContainer.value,
    style: getMountedMapStyle(),
    projection: "mercator",
    center: [0, 20],
    zoom: 1,
    attributionControl: true,
  }

  if (!app.isMobileLayout) {
    return options
  }

  return {
    ...options,
    crossSourceCollisions: false,
    dragRotate: false,
    fadeDuration: 0,
    keyboard: false,
    maxTileCacheSize: 64,
    performanceMetricsCollection: false,
    pitchWithRotate: false,
    precompilePrograms: false,
    refreshExpiredTiles: false,
    renderWorldCopies: false,
    touchPitch: false,
    trackResize: false,
  }
}

function buildGeoJson() {
  return {
    type: "FeatureCollection",
    features: app.mapLocationCandidates.map((location) => ({
        type: "Feature",
        id: location.locId,
        properties: {
          locId: location.locId,
          locName: location.locName,
          locationPrivate: location.locationPrivate,
          regionCode: location.regionCode,
          count: location.count,
          speciesCount: location.speciesCount,
          speciesCodes: location.speciesCodes,
        },
        geometry: {
          type: "Point",
          coordinates: [location.latLng.lng, location.latLng.lat],
        },
      })),
  }
}

function buildMyLocationGeoJson() {
  if (!app.isMylocation || !app.locationCoords) {
    return null
  }

  const center = {
    lng: Number(app.locationCoords.longitude),
    lat: Number(app.locationCoords.latitude),
  }
  const radiusKm = Number(app.distSelected)
  const feature = createGeodesicCircleFeature(center, radiusKm)

  if (!feature) {
    return null
  }

  return {
    type: "FeatureCollection",
    features: [feature],
  }
}

function ensureMyLocationMarker() {
  if (!mapInstance.value || !app.locationCoords) {
    return
  }

  const lng = Number(app.locationCoords.longitude)
  const lat = Number(app.locationCoords.latitude)

  if ([lng, lat].some((value) => Number.isNaN(value))) {
    return
  }

  if (!myLocationMarker) {
    const markerNode = document.createElement("div")
    markerNode.className = "map-pane__my-location-marker"
    markerNode.setAttribute("role", "img")
    markerNode.setAttribute("aria-label", "Your location")
    markerNode.title = "Your location"
    markerNode.innerHTML = `
      <span class="map-pane__my-location-marker-ring"></span>
      <span class="map-pane__my-location-marker-core"></span>
    `

    myLocationMarker = new mapboxgl.Marker({
      element: markerNode,
      anchor: "center",
    })
  }

  myLocationMarker.setLngLat([lng, lat])

  if (!myLocationMarker.getElement().isConnected) {
    myLocationMarker.addTo(mapInstance.value)
  }
}

function removeMyLocationMarker() {
  if (!myLocationMarker) {
    return
  }

  myLocationMarker.remove()
  myLocationMarker = null
}

function syncTextCountLayers() {
  if (!mapInstance.value || !mapInstance.value.getSource(sourceId)) {
    return
  }

  if (app.isMobileLayout) {
    if (mapInstance.value.getLayer(pointLabelLayerId)) {
      mapInstance.value.removeLayer(pointLabelLayerId)
    }

    if (mapInstance.value.getLayer(clusterCountLayerId)) {
      mapInstance.value.removeLayer(clusterCountLayerId)
    }

    return
  }

  if (!mapInstance.value.getLayer(pointLabelLayerId)) {
    mapInstance.value.addLayer({
      id: pointLabelLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["to-string", ["get", "count"]],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "rgba(15, 23, 42, 0.7)",
        "text-halo-width": 1.2,
        "text-opacity": 1,
      },
    })
  }

  if (!mapInstance.value.getLayer(clusterCountLayerId)) {
    mapInstance.value.addLayer({
      id: clusterCountLayerId,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["to-string", ["coalesce", ["get", "obsCount"], ["get", "point_count"], 0]],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "rgba(15, 23, 42, 0.7)",
        "text-halo-width": 1.2,
        "text-opacity": 1,
      },
    })
  }
}

function zoomToCluster(clusterId, lngLat = null) {
  const source = mapInstance.value?.getSource(sourceId)

  if (!source || !mapInstance.value) {
    return
  }

  source.getClusterExpansionZoom(clusterId, (error, zoom) => {
    if (error) {
      return
    }

    if (!Array.isArray(lngLat)) {
      return
    }

    mapInstance.value.easeTo({
      center: lngLat,
      zoom,
    })
  })
}

function handlePopupClick(event) {
  const target = event.target instanceof HTMLElement ? event.target : null

  if (!target) {
    return
  }

  const mediaButton = target.closest("[data-media-id]")
  if (mediaButton) {
    const mediaId = mediaButton.getAttribute("data-media-id")
    if (mediaId) {
      app.loadMedia(mediaId)
    }
    return
  }

  const statusButton = target.closest("[data-status-system-id]")
  if (statusButton) {
    const systemId = statusButton.getAttribute("data-status-system-id")
    if (systemId) {
      app.openStatusBadgeModal(systemId)
    }
  }
}

function buildPopupSpeciesHtml(location) {
  const popupSpecies = app.highlightedSpeciesCode
    ? location.sp.filter((species) => species.speciesCode === app.highlightedSpeciesCode)
    : location.sp

  return popupSpecies
    .map(
      (species) => `
        <article class="map-popup__species">
          <div class="map-popup__species-head">
            <span class="map-popup__species-title">
              <span class="map-popup__species-name">
                ${escapeHtml(species.comName)}
              </span>
              ${
                species.statusBadge
                  ? `<button type="button" class="badge rounded-pill ms-2 status-badge status-badge--interactive ${escapeHtml(
                      species.statusBadgeClass || "bg-secondary-subtle text-body",
                    )}" data-status-system-id="${escapeHtml(
                      species.statusSystemId || "",
                    )}" aria-label="Open details for ${escapeHtml(species.statusBadge)}">${escapeHtml(
                      species.statusBadge,
                    )}</button>`
                  : ""
              }
            </span>
            <span class="badge rounded-pill bg-dark map-popup__species-count">${species.obs.length}</span>
          </div>
          <div class="map-popup__observations">
            ${species.obs
              .map(
                (obs) => `
                  <div class="map-popup__observation">
                    <small class="species-location__meta map-popup__observation-meta d-flex flex-nowrap align-items-center gap-1 flex-grow-1 min-w-0 text-body-secondary">
                      <a
                        href="https://ebird.org/checklist/${obs.subId}#${obs.speciesCode}"
                        target="_blank"
                        rel="noreferrer"
                        class="map-popup__observation-link species-location__obs-link"
                      >
                        <span class="species-location__obs-date">
                          ${formatDaysAgo(obs.daysAgo)} ${formatObservationTime(obs.obsDt)}
                        </span>
                      </a>
                      <span class="species-location__obs-separator">•</span>
                      <span class="species-location__obs-count">${escapeHtml(obs.howMany)} ind.</span>
                      <span class="species-location__obs-separator">•</span>
                      <span class="species-location__user">${escapeHtml(obs.userDisplayName)}</span>
                    </small>
                    <span class="map-popup__flags">
                      ${
                        obs.hasRichMedia
                          ? `<button type="button" class="map-popup__flag map-popup__flag--media" data-media-id="${obs.obsId}" title="Has media" aria-label="Has media">
                               <i class="bi bi-camera-fill"></i>
                             </button>`
                          : ""
                      }
                      ${
                        obs.hasComments
                          ? `<span class="map-popup__flag map-popup__flag--comments" title="Has comments" aria-label="Has comments"><i class="bi bi-chat-square-text-fill"></i></span>`
                          : ""
                      }
                    </span>
                    ${
                      obs.media?.length
                        ? `<div class="map-popup__media">
                            ${obs.media
                              .map(
                                (mediaId) => `
                                  <img
                                    src="https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${mediaId}/320"
                                    alt=""
                                  />
                                `
                              )
                              .join("")}
                          </div>`
                        : ""
                    }
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `,
    )
    .join("")
}

function buildPopupLocationHeaderHtml(location) {
  const locationTitle = location.locationPrivate
    ? `<span class="map-popup__title species-location__title species-location__title--static fw-semibold text-body">${escapeHtml(
        location.locName,
      )}</span>`
    : `<a
        href="https://ebird.org/hotspot/${location.locId}"
        target="_blank"
        rel="noreferrer"
        class="map-popup__title species-location__title species-location__title--link fw-semibold text-body"
        title="${escapeHtml(location.locName)}"
        aria-label="${escapeHtml(location.locName)}"
      >
        ${escapeHtml(location.locName)}
      </a>`

  return `
    <div class="species-location__head d-flex align-items-center justify-content-between gap-2 map-popup__location-head">
      <span class="species-location__title-group d-flex align-items-center gap-2 min-w-0 flex-grow-1">
        ${locationTitle}
      </span>
      <a
        href="https://www.google.com/maps/dir/?api=1&destination=${location.latLng.lat},${location.latLng.lng}&dir_action=navigate"
        target="_blank"
        rel="noreferrer"
        class="species-location__direction text-body-secondary flex-shrink-0"
        title="Directions"
        aria-label="Directions"
      >
        <i class="bi bi-sign-turn-right-fill"></i>
      </a>
    </div>
  `
}

function ensureMyLocationOverlay() {
  if (!mapInstance.value) {
    return
  }

  const active = app.locationCoords
  const showRadius = app.isMylocation && app.locationCoords
  const source = mapInstance.value.getSource(myLocationSourceId)
  const geojson = buildMyLocationGeoJson()

  if (!active) {
    removeMyLocationMarker()

    if (mapInstance.value.getLayer(myLocationLineLayerId)) {
      mapInstance.value.removeLayer(myLocationLineLayerId)
    }

    if (mapInstance.value.getLayer(myLocationFillLayerId)) {
      mapInstance.value.removeLayer(myLocationFillLayerId)
    }

    if (source) {
      mapInstance.value.removeSource(myLocationSourceId)
    }

    return
  }

  ensureMyLocationMarker()

  if (!showRadius || !geojson) {
    if (mapInstance.value.getLayer(myLocationLineLayerId)) {
      mapInstance.value.removeLayer(myLocationLineLayerId)
    }

    if (mapInstance.value.getLayer(myLocationFillLayerId)) {
      mapInstance.value.removeLayer(myLocationFillLayerId)
    }

    if (source) {
      mapInstance.value.removeSource(myLocationSourceId)
    }

    return
  }

  if (!source) {
    mapInstance.value.addSource(myLocationSourceId, {
      type: "geojson",
      data: geojson,
    })
  } else {
    source.setData(geojson)
  }

  if (!mapInstance.value.getLayer(myLocationFillLayerId)) {
    mapInstance.value.addLayer({
      id: myLocationFillLayerId,
      type: "fill",
      source: myLocationSourceId,
      paint: {
        "fill-color": "#4ca800",
        "fill-opacity": 0.08,
      },
    })
  }

  if (!mapInstance.value.getLayer(myLocationLineLayerId)) {
    mapInstance.value.addLayer({
      id: myLocationLineLayerId,
      type: "line",
      source: myLocationSourceId,
      paint: {
        "line-color": "#4ca800",
        "line-width": 2,
        "line-opacity": 0.85,
      },
    })
  }
}

function createStyleSwitcherControl() {
  const container = document.createElement("div")
  container.className = "mapboxgl-ctrl map-pane__style-switcher"
  container.setAttribute("role", "group")
  container.setAttribute("aria-label", "Map style")

  const buttonRow = document.createElement("div")
  buttonRow.className = "map-pane__style-switcher-row"
  container.appendChild(buttonRow)

  const buttons = new Map()

  const syncActive = () => {
    for (const [key, button] of buttons) {
      const active = app.mapStyleKey === key
      button.classList.toggle("map-pane__style-button--active", active)
      button.setAttribute("aria-pressed", String(active))
    }
  }

  for (const style of app.mapStyles) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "map-pane__style-button"
    button.textContent = style.label
    button.setAttribute("aria-pressed", String(app.mapStyleKey === style.key))
    button.addEventListener("click", () => {
      app.setMapStyleKey(style.key)
    })

    buttons.set(style.key, button)
    buttonRow.appendChild(button)
  }

  return {
    onAdd() {
      syncActive()
      return container
    },
    onRemove() {
      container.remove()
    },
    syncActive,
  }
}

function syncVisibleLocations() {
  if (!mapInstance.value) {
    return
  }

  const container = mapContainer.value
  if (!container || container.offsetParent === null || container.clientWidth === 0 || container.clientHeight === 0) {
    return
  }

  if (app.isMobileLayout && app.sidebarOpen) {
    return
  }

  if (!app.mapSelected) {
    app.clearMapVisibleLocationIds()
    return
  }

  const visibleIds = app.mapLocationCandidates
    .filter((location) => pointInViewport(mapInstance.value, location.latLng, viewportPaddingPx))
    .map((location) => location.locId)

  app.setMapVisibleLocationIds(visibleIds)
}

function createHighlightFilter(ids) {
  if (!ids.length) {
    return ["all", ["!", ["has", "point_count"]], ["==", ["get", "locId"], "__none__"]]
  }

  return ["all", ["!", ["has", "point_count"]], ["in", ["get", "locId"], ["literal", ids]]]
}

function getHighlightedLocationIds() {
  if (app.highlightedLocationIds.length) {
    return app.highlightedLocationIds
  }

  if (!app.highlightedSpeciesCode) {
    return []
  }

  return app.mapLocationCandidates
    .filter((location) => location.speciesCodes?.includes(app.highlightedSpeciesCode))
    .map((location) => location.locId)
}

function syncHighlightLayer() {
  if (!mapInstance.value?.getLayer(pointHighlightLayerId)) {
    return
  }

  mapInstance.value.setFilter(pointHighlightLayerId, createHighlightFilter(getHighlightedLocationIds()))
}

function scheduleHighlightLayerSync() {
  if (highlightFrameId !== null) {
    cancelAnimationFrame(highlightFrameId)
  }

  highlightFrameId = requestAnimationFrame(() => {
    highlightFrameId = null
    syncHighlightLayer()
    renderPopup()
  })
}

function ensureSource() {
  if (!mapInstance.value || mapInstance.value.getSource(sourceId)) {
    return
  }

  mapInstance.value.addSource(sourceId, {
    type: "geojson",
    data: buildGeoJson(),
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 50,
    clusterProperties: {
      obsCount: ["+", ["get", "count"]],
    },
  })
}

function addLayers() {
  if (!mapInstance.value || !mapInstance.value.getSource(sourceId)) {
    return
  }

  if (!mapInstance.value.getLayer(pointLayerId)) {
    mapInstance.value.addLayer({
      id: pointLayerId,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": getRichnessColorExpression(),
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          1,
          10,
          3,
          13,
          8,
          16,
          20,
          20,
        ],
        "circle-opacity": 0.92,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(15, 23, 42, 0.26)",
      },
    })
  }

  if (!mapInstance.value.getLayer(pointHighlightLayerId)) {
    mapInstance.value.addLayer({
      id: pointHighlightLayerId,
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#4ca800",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "count"],
          1,
          14,
          3,
          17,
          8,
          20,
          20,
          24,
        ],
        "circle-opacity": 0.95,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    })
  }

  if (!mapInstance.value.getLayer(clusterLayerId)) {
    mapInstance.value.addLayer({
      id: clusterLayerId,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": getClusterCountColorExpression(),
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "point_count"],
          2,
          16,
          5,
          20,
          10,
          24,
          20,
          30,
        ],
        "circle-opacity": 0.94,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "rgba(15, 23, 42, 0.26)",
      },
    })
  }

  syncTextCountLayers()
}

function syncSourceData() {
  if (!mapInstance.value?.getSource(sourceId)) {
    return
  }

  mapInstance.value.getSource(sourceId).setData(buildGeoJson())

  syncHighlightLayer()
  renderPopup()
}

function removePopup() {
  const popup = popupInstance.value
  popupInstance.value = null

  if (!popup) {
    return
  }

  popup.off("close", handlePopupClosed)
  popup.remove()
}

function handlePopupClosed() {
  popupInstance.value = null
  app.closeLocationPopup()
}

function renderPopup() {
  if (!mapInstance.value || !app.popupLocation) {
    removePopup()
    return
  }

  if (app.isMobileLayout) {
    removePopup()
    return
  }

  const location = app.popupLocation
  const popupNode = document.createElement("div")
  popupNode.className = "map-popup"

  popupNode.innerHTML = `
    <div class="map-popup__header">
      ${buildPopupLocationHeaderHtml(location)}
    </div>
    <div class="map-popup__body">${buildPopupSpeciesHtml(location)}</div>
  `

  popupNode.addEventListener("click", handlePopupClick)

  if (!popupInstance.value) {
    popupInstance.value = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: true,
      maxWidth: "600px",
    })

    popupInstance.value.on("close", handlePopupClosed)
  }

  popupInstance.value.setLngLat([location.latLng.lng, location.latLng.lat]).setDOMContent(popupNode)

  if (!popupInstance.value.isOpen()) {
    popupInstance.value.addTo(mapInstance.value)
  }
}

function fitToFeatures() {
  if (!mapInstance.value) {
    return
  }

  const bounds = app.isMylocation && app.locationCoords
    ? createGeodesicCircleBounds(
        {
          lng: Number(app.locationCoords.longitude),
          lat: Number(app.locationCoords.latitude),
        },
        Number(app.distSelected),
      )
    : createBoundsFromPoints(app.mapLocationCandidates.map((location) => location.latLng))

  if (!bounds) {
    return
  }

  if (app.mapLocationCandidates.length === 1) {
    mapInstance.value.easeTo({
      center: [app.mapLocationCandidates[0].latLng.lng, app.mapLocationCandidates[0].latLng.lat],
      zoom: 9,
    })
    return
  }

  mapInstance.value.fitBounds(toMapboxBounds(bounds), {
    padding: 48,
    maxZoom: 10,
  })
}

function resizeMap() {
  if (!mapInstance.value) {
    return
  }

  mapInstance.value.resize()
}

function getInteractiveLayers() {
  if (!mapInstance.value) {
    return []
  }

  return [clusterLayerId, clusterCountLayerId, pointLayerId, pointHighlightLayerId, pointLabelLayerId].filter((layerId) =>
    Boolean(mapInstance.value.getLayer(layerId))
  )
}

function syncCursor(event) {
  if (!mapInstance.value) {
    return
  }

  const layers = getInteractiveLayers()
  if (!layers.length) {
    mapInstance.value.getCanvas().style.cursor = ""
    return
  }

  const features = mapInstance.value.queryRenderedFeatures(event.point, { layers })

  mapInstance.value.getCanvas().style.cursor = features.length ? "pointer" : ""
}

function handleMapClick(event) {
  if (!mapInstance.value) {
    return
  }

  const layers = getInteractiveLayers()
  if (!layers.length) {
    return
  }

  const features = mapInstance.value.queryRenderedFeatures(event.point, { layers })

  const feature = features[0]
  if (!feature) {
    return
  }

  if (feature.properties?.point_count) {
    zoomToCluster(Number(feature.properties.cluster_id), feature.geometry?.coordinates)
    return
  }

  app.openLocationPopup(feature.properties.locId)
}

async function initializeMap() {
  if (!mapContainer.value || !hasToken.value || mapInstance.value) {
    return mapInstance.value
  }

  if (shouldDeferMapInitialization()) {
    return null
  }

  const mapbox = await loadMapbox()

  if (!mapContainer.value || !hasToken.value || mapInstance.value || shouldDeferMapInitialization()) {
    return mapInstance.value
  }

  mapbox.accessToken = mapboxAccessToken
  mapInstance.value = new mapbox.Map(getMapOptions())

  styleSwitcherControl = createStyleSwitcherControl()
  mapInstance.value.addControl(styleSwitcherControl, "top-right")
  mapInstance.value.addControl(new mapbox.NavigationControl({ showCompass: false }), "top-right")

  mapInstance.value.on("load", () => {
    mapReady.value = true
    ensureSource()
    ensureMyLocationOverlay()
    addLayers()
    syncVisibleLocations()
    syncHighlightLayer()
    syncSourceData()
    fitToFeatures()
  })

  mapInstance.value.on("style.load", () => {
    ensureSource()
    ensureMyLocationOverlay()
    addLayers()
    syncVisibleLocations()
    syncHighlightLayer()
    syncSourceData()
  })

  mapInstance.value.on("moveend", () => {
    syncVisibleLocations()
  })
  mapInstance.value.on("zoomend", () => {
    syncVisibleLocations()
  })
  mapInstance.value.on("resize", () => {
    syncVisibleLocations()
  })
  mapInstance.value.on("mousemove", syncCursor)
  mapInstance.value.on("click", handleMapClick)

  resizeObserver = new ResizeObserver(() => {
    resizeMap()
  })

  resizeObserver.observe(mapContainer.value)

  return mapInstance.value
}

watch(
  () => app.mapLocationCandidates,
  () => {
    syncSourceData()
    syncVisibleLocations()
  },
)

watch(
  () => app.mapSelected,
  (selected) => {
    if (!selected) {
      app.clearMapVisibleLocationIds()
      return
    }

    syncVisibleLocations()
  }
)

watch(
  () => [app.isMylocation, app.locationCoords?.latitude, app.locationCoords?.longitude, app.distSelected],
  () => {
    ensureMyLocationOverlay()
    if (app.isMylocation && mapReady.value) {
      fitToFeatures()
    }
  },
  { immediate: true },
)

watch([() => app.highlightedLocationIds, () => app.highlightedSpeciesCode], () => {
  scheduleHighlightLayerSync()
})

watch(
  [() => app.popupLocation, () => app.isMobileLayout],
  () => {
    renderPopup()
  }
)

watch(
  () => app.mapStyle,
  (nextStyle) => {
    if (mapInstance.value && nextStyle) {
      mapInstance.value.setStyle(getMountedMapStyle(nextStyle))
    }
  }
)

watch(
  () => app.mapStyleKey,
  () => {
    styleSwitcherControl?.syncActive?.()
  }
)

watch(
  () => app.isMobileLayout,
  () => {
    if (!mapInstance.value || !mapReady.value) {
      return
    }

    syncTextCountLayers()
  }
)

watch(
  () => app.fitRequest,
  () => {
    if (mapReady.value && app.fitRequest !== lastFitRequest.value) {
      lastFitRequest.value = app.fitRequest
      fitToFeatures()
    }
  }
)

watch(
  () => [app.isMobileLayout, app.sidebarOpen],
  async () => {
    if (shouldDeferMapInitialization()) {
      scheduleMapboxPreload()
      app.setMapVisibleLocationIds(null)
      return
    }

    cancelMapboxPreload()

    if (!mapInstance.value) {
      await initializeMap()
      return
    }

    await nextTick()
    resizeMap()
  }
)

onMounted(() => {
  if (shouldDeferMapInitialization()) {
    scheduleMapboxPreload()
    return
  }

  void initializeMap()
})

onBeforeUnmount(() => {
  cancelMapboxPreload()
  if (highlightFrameId !== null) {
    cancelAnimationFrame(highlightFrameId)
    highlightFrameId = null
  }
  removePopup()
  removeMyLocationMarker()
  resizeObserver?.disconnect()
  resizeObserver = null
  styleSwitcherControl = null
  mapInstance.value?.remove()
  mapInstance.value = null
})
</script>
