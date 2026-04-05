import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { ebirdApiKey, ebirdBaseUrl, mapboxStyles } from "../config/index.js";
import { getUniformRegionTaxonomySystem } from "../config/region-taxonomies.js";
import {
  applyDistanceToObservations,
  filterObservations,
  groupLocationPopups,
  groupObservations,
  normalizeObservationRows,
} from "../utils/observations";
import { parseShareState, serializeShareState } from "../utils/query";
import { loadTaxonomyResources } from "../utils/taxonomy-resources";
import { createGeolocationController } from "./geolocationController.js";
import { createSortOptionLabels, filterSearchOptions } from "./globalRareBirdOptions.js";

export const birdAppKey = Symbol("bird-app");

const MEDIA_BASE_URL = `${
  typeof window !== "undefined" ? window.location.protocol : "https:"
}//tripreport.raphaelnussbaumer.com/obsservice/media`;

function normalizeRegion(region) {
  return {
    code: region.code,
    name: region.name,
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export function useGlobalRareBird() {
  const initialState = parseShareState(window.location.search);

  const isMylocation = ref(initialState.isMylocation);
  const locationCoords = ref(null);
  const locationPermission = ref("unknown");
  const locationFeedback = ref("");

  const backMax = ref(Math.max(3, initialState.backSelected));
  const backSelected = ref(initialState.backSelected);
  const distMax = ref(Math.max(50, initialState.distSelected));
  const distSelected = ref(initialState.distSelected);
  const sppLocale = ref(initialState.sppLocale);
  const mapSelected = ref(true);
  const mediaSelected = ref(false);
  const hotspotSelected = ref(false);
  const detailSelected = ref(initialState.detailSelected);
  const filterSearch = ref("");
  const filterSearchOptionsSelected = ref(["comName", "sciName", "locName"]);
  const hasLocationCoords = computed(() => Boolean(locationCoords.value));
  const filterSortOptions = computed(() => createSortOptionLabels(hasLocationCoords.value));
  const filterSortOptionsSelected = ref("tax");
  const statusLimit = ref(1);
  const speIndexMax = ref(50);
  const mapStyleKey = ref(mapboxStyles[0].key);
  const mapVisibleLocationIds = ref(null);
  const mapVisibleLocationIdsSnapshot = ref(null);
  const regionSearch = ref([]);
  const regionSelected = ref([]);
  const observationsMylocation = ref([]);
  const observationsRegionByCode = reactive({});
  const popupLocationId = ref(null);
  const highlightedLocationIds = ref([]);
  const highlightedSpeciesCode = ref(null);
  const mediaRevision = ref(0);
  const statusBadgeModalSystemId = ref(null);
  const showInstruction = ref(false);
  const sidebarOpen = ref(true);
  const isMobileLayout = ref(false);
  const fitRequest = ref(0);
  let mobileMediaQuery = null;
  let syncSidebarMode = null;

  const loadingStack = ref([]);
  const isLoading = computed(() => loadingStack.value.length > 0);
  const loadingLabel = computed(() => loadingStack.value[loadingStack.value.length - 1] || "");

  const mapStyle = computed(
    () => mapboxStyles.find((style) => style.key === mapStyleKey.value)?.url || mapboxStyles[0].url,
  );

  const selectedRegionCodes = computed(() => regionSelected.value.map((region) => region.code));
  const activeStatusSystem = computed(() => getUniformRegionTaxonomySystem(selectedRegionCodes.value));
  const activeStatusFilterSystem = computed(() =>
    activeStatusSystem.value?.filterable ? activeStatusSystem.value : null,
  );
  const statusOptions = computed(() => activeStatusFilterSystem.value?.statusOptions || []);

  const regionObservations = computed(() =>
    selectedRegionCodes.value.flatMap((code) => observationsRegionByCode[code] || []),
  );

  const allObservations = computed(() =>
    isMylocation.value ? observationsMylocation.value : regionObservations.value,
  );

  const candidateObservations = computed(() =>
    filterObservations(allObservations.value, {
      isMylocation: isMylocation.value,
      backSelected: backSelected.value,
      distSelected: distSelected.value,
      statusLimit: statusLimit.value,
      statusSystemId: activeStatusFilterSystem.value?.id ?? null,
      mapSelected: false,
      mediaSelected: mediaSelected.value,
      hotspotSelected: hotspotSelected.value,
      filterSearch: filterSearch.value,
      filterSearchOptionsSelected: filterSearchOptionsSelected.value,
      sortKey: filterSortOptionsSelected.value,
    }),
  );
  const hasCandidateObservations = computed(() => candidateObservations.value.length > 0);
  const candidateGroupedObservations = computed(() =>
    groupObservations(candidateObservations.value, filterSortOptionsSelected.value),
  );

  const activeMapVisibleLocationIds = computed(() => {
    if (!mapSelected.value) {
      return null;
    }

    if (mapVisibleLocationIds.value !== null) {
      return mapVisibleLocationIds.value;
    }

    if (isMobileLayout.value && sidebarOpen.value) {
      return mapVisibleLocationIdsSnapshot.value;
    }

    return null;
  });

  const filteredObservations = computed(() => {
    if (!activeMapVisibleLocationIds.value) {
      return candidateObservations.value;
    }

    const visibleSet = new Set(activeMapVisibleLocationIds.value);
    return candidateObservations.value.filter((obs) => visibleSet.has(obs.locId));
  });

  const groupedObservations = computed(() =>
    groupObservations(filteredObservations.value, filterSortOptionsSelected.value),
  );

  const speciesFiltered = computed(() => groupedObservations.value.species);
  const locationFeatures = computed(() => groupedObservations.value.locations);
  const mapLocationCandidates = computed(() => candidateGroupedObservations.value.locations);
  const mapViewportHiddenCount = computed(() => {
    if (!activeMapVisibleLocationIds.value) {
      return 0;
    }

    const totalCount = mapLocationCandidates.value.length;
    const visibleCount = locationFeatures.value.length;

    return totalCount > visibleCount ? totalCount - visibleCount : 0;
  });
  const popupLocation = computed(() => {
    mediaRevision.value;
    const location = locationFeatures.value.find((entry) => entry.locId === popupLocationId.value);
    if (!location) {
      return null;
    }

    return {
      ...location,
      sp: groupLocationPopups(location),
    };
  });

  const linkUrl = computed(() =>
    serializeShareState({
      isMylocation: isMylocation.value,
      regionSelected: regionSelected.value,
      distSelected: distSelected.value,
      backSelected: backSelected.value,
      detailSelected: detailSelected.value,
      sppLocale: sppLocale.value,
    }),
  );
  const shareUrl = computed(() => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    return `${baseUrl}?${linkUrl.value}`;
  });

  const pendingRegionCodes = ref(initialState.regionCodes);
  const shouldSyncUrl = ref(false);
  const { requestGeolocation, primeGeolocationForDisplay } = createGeolocationController({
    locationCoords,
    locationPermission,
    locationFeedback,
    observationsMylocation,
    observationsRegionByCode,
    fitRequest,
    applyDistanceToObservations,
  });

  function setLoading(label, active) {
    if (active) {
      loadingStack.value.push(label);
      return;
    }

    const index = loadingStack.value.lastIndexOf(label);
    if (index > -1) {
      loadingStack.value.splice(index, 1);
    }
  }

  async function withLoading(label, task) {
    setLoading(label, true);
    try {
      return await task();
    } finally {
      setLoading(label, false);
    }
  }

  function syncUrl() {
    if (!shouldSyncUrl.value) {
      return;
    }

    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
    const nextUrl = linkUrl.value ? `${baseUrl}?${linkUrl.value}` : baseUrl;
    history.replaceState(null, "", nextUrl);
  }

  watch(linkUrl, syncUrl);
  watch(
    activeStatusSystem,
    (system) => {
      statusLimit.value = system?.defaultStatus ?? 1;
    },
    { immediate: true },
  );

  watch(
    hasLocationCoords,
    (available) => {
      if (!available && filterSortOptionsSelected.value === "distToMe") {
        filterSortOptionsSelected.value = "tax";
      }
    },
    { immediate: true },
  );

  watch(locationCoords, (coords) => {
    if (!coords) {
      return;
    }

    applyDistanceToObservations(observationsMylocation.value, coords);
    for (const observations of Object.values(observationsRegionByCode)) {
      applyDistanceToObservations(observations, coords);
    }
  });

  function setMapVisibleLocationIds(ids) {
    if (ids) {
      const nextIds = Array.from(new Set(ids));
      mapVisibleLocationIds.value = nextIds;
      mapVisibleLocationIdsSnapshot.value = nextIds;
      return;
    }

    mapVisibleLocationIds.value = null;
  }

  function clearMapVisibleLocationIds() {
    mapVisibleLocationIds.value = null;
    mapVisibleLocationIdsSnapshot.value = null;
  }

  function setHighlightLocationIds(ids) {
    highlightedSpeciesCode.value = null;
    highlightedLocationIds.value = Array.from(new Set(ids));
  }

  function setHighlightSpeciesCode(code) {
    highlightedLocationIds.value = [];
    highlightedSpeciesCode.value = code || null;
  }

  function clearHighlight() {
    highlightedLocationIds.value = [];
    highlightedSpeciesCode.value = null;
  }

  function openStatusBadgeModal(systemId) {
    if (!systemId) {
      return;
    }

    statusBadgeModalSystemId.value = systemId;
  }

  function closeStatusBadgeModal() {
    statusBadgeModalSystemId.value = null;
  }

  function fitToAllSightings() {
    clearMapVisibleLocationIds();
    fitRequest.value += 1;
  }

  function toggleInstruction(visible) {
    showInstruction.value = typeof visible === "boolean" ? visible : !showInstruction.value;
  }

  function setSidebarOpen(open) {
    sidebarOpen.value = Boolean(open);
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function setMapStyleKey(key) {
    if (mapboxStyles.some((style) => style.key === key)) {
      mapStyleKey.value = key;
    }
  }

  function setSpeciesLocale(locale) {
    if (!locale || locale === sppLocale.value) {
      return;
    }

    sppLocale.value = locale;

    if (typeof window !== "undefined") {
      window.location.replace(shareUrl.value);
    }
  }

  function updateBackMax(nextValue) {
    backMax.value = nextValue;
    backSelected.value = Math.min(backSelected.value, backMax.value);
  }

  function applyRegionSelection(region) {
    if (regionSelected.value.some((entry) => entry.code === region.code)) {
      return;
    }

    regionSelected.value = [...regionSelected.value, normalizeRegion(region)];
  }

  function removeRegion(region) {
    regionSelected.value = regionSelected.value.filter((entry) => entry.code !== region.code);
    delete observationsRegionByCode[region.code];

    if (popupLocation.value && region.code === popupLocation.value.regionCode) {
      popupLocationId.value = null;
    }
  }

  function clearRegionObservations() {
    for (const key of Object.keys(observationsRegionByCode)) {
      delete observationsRegionByCode[key];
    }
  }

  async function loadRegionCatalog() {
    try {
      await withLoading("Loading regions…", async () => {
        const [countries, usStates, caStates] = await Promise.all([
          fetchJson(`${ebirdBaseUrl}/ref/region/list/country/world?key=${ebirdApiKey}`),
          fetchJson(`${ebirdBaseUrl}/ref/region/list/subnational1/US?key=${ebirdApiKey}`),
          fetchJson(`${ebirdBaseUrl}/ref/region/list/subnational1/CA?key=${ebirdApiKey}`),
        ]);

        regionSearch.value = [...countries, ...usStates, ...caStates]
          .map(normalizeRegion)
          .sort((left, right) => left.name.localeCompare(right.name));

        const regionIndex = new Map(regionSearch.value.map((region) => [region.code, region]));
        regionSelected.value = pendingRegionCodes.value
          .map((code) => regionIndex.get(code))
          .filter(Boolean);

        isMylocation.value = initialState.isMylocation;
        shouldSyncUrl.value = true;
        syncUrl();
      });
    } catch (error) {
      console.error("Unable to load regions", error);
    }
  }

  async function loadNearbyObservations() {
    isMylocation.value = true;

    const coords = locationCoords.value || (await requestGeolocation().catch(() => null));
    if (!coords) {
      return;
    }

    fitRequest.value += 1;

    try {
      await withLoading("Loading sightings…", async () => {
        const { taxonomyLookup: loadedTaxonomyLookup } = await loadTaxonomyResources([]);
        const params = new URLSearchParams({
          lat: coords.latitude,
          lng: coords.longitude,
          key: ebirdApiKey,
          detail: "full",
          back: backMax.value,
          dist: distMax.value,
          hotspot: hotspotSelected.value ? "true" : "false",
          sppLocale: sppLocale.value,
        });

        const json = await fetchJson(
          `${ebirdBaseUrl}/data/obs/geo/recent/notable?${params.toString()}`,
        );

        observationsMylocation.value = normalizeObservationRows(json, {
          regionCode: "mylocation",
          taxonomyLookup: loadedTaxonomyLookup,
          location: coords,
        });
        applyDistanceToObservations(observationsMylocation.value, coords);
      });
    } catch (error) {
      console.error("Unable to load nearby observations", error);
    } finally {
      fitRequest.value += 1;
    }
  }

  async function loadRegionObservations(regionCodes = selectedRegionCodes.value) {
    if (!regionCodes.length) {
      clearRegionObservations();
      return;
    }

    isMylocation.value = false;

    try {
      await withLoading("Loading sightings…", async () => {
        const {
          taxonomyLookup: loadedTaxonomyLookup,
          regionTaxonomyLookups: loadedRegionTaxonomyLookups,
        } = await loadTaxonomyResources(regionCodes);

        const results = await Promise.all(
          regionCodes.map(async (code) => {
            const params = new URLSearchParams({
              key: ebirdApiKey,
              detail: "full",
              back: backMax.value,
              hotspot: hotspotSelected.value ? "true" : "false",
              sppLocale: sppLocale.value,
            });

            const json = await fetchJson(
              `${ebirdBaseUrl}/data/obs/${code}/recent/notable?${params}`,
            );
            return {
              code,
              observations: normalizeObservationRows(json, {
                regionCode: code,
                taxonomyLookup: loadedTaxonomyLookup,
                regionTaxonomyLookups: loadedRegionTaxonomyLookups,
                location: locationCoords.value || null,
              }),
            };
          }),
        );

        clearRegionObservations();

        for (const result of results) {
          observationsRegionByCode[result.code] = result.observations;
          applyDistanceToObservations(result.observations, locationCoords.value);
        }

        if (regionObservations.value.length > 0) {
          fitRequest.value += 1;
        }
      });
    } catch (error) {
      console.error("Unable to load region observations", error);
    }
  }

  async function reload(newBackMax) {
    updateBackMax(newBackMax);

    if (isMylocation.value) {
      await loadNearbyObservations();
      return;
    }

    await loadRegionObservations();
  }

  async function selectRegion(region) {
    applyRegionSelection(region);

    if (isMylocation.value) {
      isMylocation.value = false;
    }

    await loadRegionObservations();
  }

  async function myLocation() {
    isMylocation.value = true;
    await loadNearbyObservations();
  }

  async function loadMedia(obsId) {
    const observation = [...observationsMylocation.value, ...regionObservations.value].find(
      (entry) => entry.obsId === obsId,
    );

    if (!observation || observation.media) {
      return;
    }

    try {
      const json = await fetchJson(`${MEDIA_BASE_URL}?obsId=${obsId}`);
      observation.media = json.map((item) => item.assetId);
      mediaRevision.value += 1;
    } catch (error) {
      console.error("Unable to load media", error);
    }
  }

  function openLocationPopup(locationId) {
    popupLocationId.value = locationId;
  }

  function closeLocationPopup() {
    popupLocationId.value = null;
  }

  async function shareLink() {
    const sharePayload = {
      title: "Global Rare eBird",
      text: "Global Rare eBird",
      url: shareUrl.value,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Native share failed, falling back to clipboard", error);
        } else {
          return;
        }
      }
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(shareUrl.value);
    } catch {}
  }

  function removeRegionAndRefresh(region) {
    removeRegion(region);
    if (!isMylocation.value) {
      void loadRegionObservations();
    }
  }

  function updateRegionSelectionFromPicker(region) {
    if (isMylocation.value) {
      isMylocation.value = false;
    }

    void selectRegion(region);
  }

  const api = {
    isMylocation,
    locationCoords,
    locationPermission,
    locationFeedback,
    backMax,
    backSelected,
    distMax,
    distSelected,
    sppLocale,
    mapSelected,
    mediaSelected,
    hotspotSelected,
    detailSelected,
    filterSearch,
    filterSearchOptions,
    filterSearchOptionsSelected,
    filterSortOptions,
    filterSortOptionsSelected,
    statusLimit,
    speIndexMax,
    mapVisibleLocationIds,
    mapStyleKey,
    mapStyles: mapboxStyles,
    mapStyle,
    regionSearch,
    regionSelected,
    observationsMylocation,
    observationsRegionByCode,
    candidateObservations,
    hasCandidateObservations,
    hasLocationCoords,
    allObservations,
    filteredObservations,
    speciesFiltered,
    locationFeatures,
    mapLocationCandidates,
    mapViewportHiddenCount,
    clearMapVisibleLocationIds,
    popupLocation,
    highlightedLocationIds,
    highlightedSpeciesCode,
    statusBadgeModalSystemId,
    showInstruction,
    sidebarOpen,
    isMobileLayout,
    fitRequest,
    isLoading,
    loadingLabel,
    activeStatusSystem,
    statusOptions,
    linkUrl,
    shareUrl,
    requestGeolocation,
    loadRegionCatalog,
    loadNearbyObservations,
    loadRegionObservations,
    reload,
    selectRegion: updateRegionSelectionFromPicker,
    removeRegion: removeRegionAndRefresh,
    applyRegionSelection,
    updateBackMax,
    setMapVisibleLocationIds,
    fitToAllSightings,
    setMapStyleKey,
    setSpeciesLocale,
    setHighlightLocationIds,
    setHighlightSpeciesCode,
    clearHighlight,
    openStatusBadgeModal,
    closeStatusBadgeModal,
    toggleInstruction,
    setSidebarOpen,
    toggleSidebar,
    loadMedia,
    openLocationPopup,
    closeLocationPopup,
    shareLink,
    myLocation,
  };

  onMounted(async () => {
    mobileMediaQuery = window.matchMedia("(max-width: 900px)");
    syncSidebarMode = (event) => {
      const compact = event.matches;
      isMobileLayout.value = compact;

      if (!compact) {
        sidebarOpen.value = true;
      }
    };
    syncSidebarMode(mobileMediaQuery);
    mobileMediaQuery.addEventListener("change", syncSidebarMode);

    await loadRegionCatalog();

    if (!initialState.isMylocation) {
      void primeGeolocationForDisplay();
    }

    if (initialState.isMylocation) {
      await myLocation();
    } else if (regionSelected.value.length > 0) {
      await loadRegionObservations();
    }
  });

  onBeforeUnmount(() => {
    if (mobileMediaQuery && syncSidebarMode) {
      mobileMediaQuery.removeEventListener("change", syncSidebarMode);
    }
  });

  return reactive(api);
}
