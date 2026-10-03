import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";

import { ebirdApiKey, ebirdBaseUrl, mapboxStyles } from "../config/index.js";
import { getUniformRegionTaxonomySystem } from "../config/region-taxonomies.js";
import {
  applyDistanceToObservations,
  combineSharedObservations,
  dedupeObservations,
  filterObservations,
  groupLocationPopups,
  groupObservations,
  normalizeObservationRows,
} from "../utils/observations";
import { lookupDefaultRegion } from "../utils/default-region.js";
import { parseShareState, serializeShareState } from "../utils/query";
import { loadTaxonomyResources } from "../utils/taxonomy-resources";
import { createGeolocationController } from "./geolocationController.js";
import { createSortOptionLabels, filterSearchOptions } from "./globalRareBirdOptions.js";
import { trackEvent } from "../utils/analytics.js";
import regionCatalog from "../../data/region-catalog.json";

export const birdAppKey = Symbol("bird-app");
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 900px)";

const MEDIA_BASE_URL = "https://tripreport.raphaelnussbaumer.com/obsservice/media";

function normalizeRegion(region) {
  return {
    code: region.code,
    name: region.name,
  };
}

async function fetchJson(url, options = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const abort = () => controller.abort(options.signal.reason);
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(new DOMException("Sightings request timed out", "TimeoutError")), 20000);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (controller.signal.reason?.name === "TimeoutError") {
        if (attempt === 0) continue;
        throw controller.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  }
}

export const searchPreferenceKey = "global-rare-ebird.last-search";

export function useGlobalRareBird() {
  const searchParams = new URLSearchParams(window.location.search);
  const hasSharedSearch = ["mode", "r", "d", "t", "c", "l"].some(key => searchParams.has(key));
  let savedSearch;
  try {
    savedSearch = JSON.parse(window.localStorage.getItem(searchPreferenceKey));
  } catch { /* Storage may be unavailable or cleared by the browser. */ }
  const restoreSearch = !hasSharedSearch && Boolean(savedSearch);
  const initialState = parseShareState(hasSharedSearch ? window.location.search : savedSearch?.search || "");
  if (restoreSearch && initialState.isMylocation) initialState.regionCodes = savedSearch.regionCodes;
  const estimatedRegionCode = ref(restoreSearch ? savedSearch.estimatedRegionCode : "");
  const regionFallbackFeedback = ref("");
  let rememberSearch = Boolean(hasSharedSearch || savedSearch);
  let defaultRegionController;
  const regionCatalogLookup = new Map(regionCatalog.map((region) => [region.code, normalizeRegion(region)]));
  const initialMobileLayout =
    typeof window !== "undefined" ? window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches : false;

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
  const regionSearch = ref(regionCatalog.map(normalizeRegion));
  const regionSelected = ref(
    initialState.regionCodes
      .map((code) => regionCatalogLookup.get(code))
      .filter(Boolean)
      .map(normalizeRegion),
  );
  const observationsMylocation = ref([]);
  const observationsRegionByCode = reactive({});
  const observationError = ref("");
  const regionCache = new Map();
  const mediaRequests = new Map();
  const checklistCache = new Map();
  const checklistRequests = new Map();
  const observationDetails = reactive({});
  let observationController = null;
  const popupLocationId = ref(null);
  const highlightedLocationIds = ref([]);
  const highlightedSpeciesCode = ref(null);
  const mediaRevision = ref(0);
  const detailRevision = ref(0);
  const statusBadgeModalSystemId = ref(null);
  const showInstruction = ref(false);
  const sidebarOpen = ref(true);
  const isMobileLayout = ref(initialMobileLayout);
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
    dedupeObservations(selectedRegionCodes.value.flatMap((code) => observationsRegionByCode[code] || [])),
  );

  const allObservations = computed(() =>
    combineSharedObservations(isMylocation.value ? observationsMylocation.value : regionObservations.value),
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
    activeMapVisibleLocationIds.value === null
      ? candidateGroupedObservations.value
      : groupObservations(filteredObservations.value, filterSortOptionsSelected.value),
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
    if (rememberSearch) {
      try {
        window.localStorage.setItem(searchPreferenceKey, JSON.stringify({
          search: linkUrl.value, regionCodes: selectedRegionCodes.value, estimatedRegionCode: estimatedRegionCode.value,
        }));
      } catch { /* Searches still work when browser storage is unavailable. */ }
    }
  }

  watch([linkUrl, estimatedRegionCode], syncUrl);
  watch(isMylocation, () => {
    observationController?.abort();
    observationError.value = "";
    clearMapVisibleLocationIds();
  }, { flush: "sync" });
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
      if (key !== mapStyleKey.value) trackEvent("map_layer_change", { layer: key });
      mapStyleKey.value = key;
    }
  }

  function setSpeciesLocale(locale) {
    if (!locale || locale === sppLocale.value) {
      return;
    }

    trackSetting("species_language", locale);
    sppLocale.value = locale;

    if (typeof window !== "undefined") {
      window.location.replace(shareUrl.value);
    }
  }

  function trackSetting(name, value) {
    trackEvent("setting_change", { setting_name: name, setting_value: Array.isArray(value) ? value.join(",") : String(value) });
  }

  function updateBackMax(nextValue) {
    backMax.value = Math.max(1, Math.min(30, Number(nextValue)));
    backSelected.value = Math.min(backSelected.value, backMax.value);
  }

  function applyRegionSelection(region) {
    defaultRegionController?.abort();
    if (estimatedRegionCode.value && region.code !== estimatedRegionCode.value) {
      regionSelected.value = regionSelected.value.filter(entry => entry.code !== estimatedRegionCode.value);
      clearRegionObservations();
    }
    estimatedRegionCode.value = "";
    rememberSearch = true;
    if (regionSelected.value.some((entry) => entry.code === region.code)) {
      return;
    }

    regionSelected.value = [...regionSelected.value, normalizeRegion(region)];
  }

  function removeRegion(region) {
    defaultRegionController?.abort();
    estimatedRegionCode.value = "";
    rememberSearch = true;
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

  function beginObservationRequest() {
    rememberSearch = true;
    syncUrl();
    defaultRegionController?.abort();
    observationController?.abort();
    observationController = new AbortController();
    observationError.value = "";
    return observationController;
  }

  async function chooseDefaultRegion() {
    defaultRegionController = new AbortController();
    const controller = defaultRegionController;
    const region = await withLoading("Finding your region…", () => lookupDefaultRegion(regionCatalogLookup, controller.signal));
    if (controller.signal.aborted) return false;
    if (region) {
      regionSelected.value = [region];
      estimatedRegionCode.value = region.code;
    }
    return true;
  }

  async function fallbackToRegions(signal) {
    if (!regionSelected.value.length) await chooseDefaultRegion();
    if (signal.aborted) return;
    regionFallbackFeedback.value = locationFeedback.value || "Location access is unavailable. Choose a region or try Around me again.";
    await loadRegionObservations();
  }

  async function loadNearbyObservations() {
    regionFallbackFeedback.value = "";
    if (!isMylocation.value) trackEvent("mode_change", { mode: "around" });
    isMylocation.value = true;
    const controller = beginObservationRequest();

    try {
      await withLoading("Loading sightings…", async () => {
        const coords = locationCoords.value || (await requestGeolocation().catch(() => null));
        controller.signal.throwIfAborted();
        if (!coords) {
          trackEvent("data_load", { mode: "around", outcome: "failure", source: "network" });
          await fallbackToRegions(controller.signal);
          return;
        }
        controller.signal.throwIfAborted();

        const { taxonomyLookup } = await loadTaxonomyResources([]);
        controller.signal.throwIfAborted();
        const params = new URLSearchParams({
          lat: coords.latitude,
          lng: coords.longitude,
          detail: "full",
          back: backMax.value,
          dist: distMax.value,
          sppLocale: sppLocale.value,
        });
        const json = await fetchJson(`${ebirdBaseUrl}/data/obs/geo/recent/notable?${params}`, {
          signal: controller.signal,
          headers: { "X-eBirdApiToken": ebirdApiKey },
        });
        controller.signal.throwIfAborted();
        observationsMylocation.value = normalizeObservationRows(json, {
          regionCode: "mylocation",
          taxonomyLookup,
          location: coords,
        });
        trackEvent("data_load", { mode: "around", outcome: "success", source: "network" });
        clearMapVisibleLocationIds();
        fitRequest.value += 1;
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      observationError.value = "Unable to load sightings. Please try again.";
      trackEvent("data_load", { mode: "around", outcome: "failure", source: "network" });
      console.error("Unable to load nearby observations", error);
    }
  }

  async function loadRegionObservations(regionCodes = selectedRegionCodes.value) {
    if (isMylocation.value) trackEvent("mode_change", { mode: "region" });
    isMylocation.value = false;
    const controller = beginObservationRequest();
    if (!regionCodes.length) {
      clearRegionObservations();
      return;
    }
    const cacheKey = `${backMax.value}:${sppLocale.value}`;
    const cachedCodes = regionCodes.filter((code) => regionCache.get(code)?.key === cacheKey);
    const params = new URLSearchParams({ detail: "full", back: backMax.value, sppLocale: sppLocale.value });

    try {
      await withLoading("Loading sightings…", async () => {
        const { taxonomyLookup, regionTaxonomyLookups } = await loadTaxonomyResources(regionCodes);
        controller.signal.throwIfAborted();
        const results = await Promise.allSettled(regionCodes.map(async (code) => {
          if (regionCache.get(code)?.key === cacheKey) return regionCache.get(code).observations;
          const json = await fetchJson(`${ebirdBaseUrl}/data/obs/${encodeURIComponent(code)}/recent/notable?${params}`, {
            signal: controller.signal,
            headers: { "X-eBirdApiToken": ebirdApiKey },
          });
          controller.signal.throwIfAborted();
          const observations = normalizeObservationRows(json, {
            regionCode: code,
            taxonomyLookup,
            regionTaxonomyLookups,
            location: locationCoords.value,
          });
          regionCache.set(code, { key: cacheKey, observations });
          return observations;
        }));
        controller.signal.throwIfAborted();
        clearRegionObservations();

        results.forEach((result, index) => {
          trackEvent("data_load", { region_code: regionCodes[index], mode: "region", outcome: result.status === "fulfilled" ? "success" : "failure", source: cachedCodes.includes(regionCodes[index]) ? "cache" : "network" });
          if (result.status === "fulfilled") {
            observationsRegionByCode[regionCodes[index]] = result.value;
            applyDistanceToObservations(result.value, locationCoords.value);
          } else {
            observationError.value = result.reason?.name === "TimeoutError"
              ? "Sightings took too long to load after an automatic retry. Please try again."
              : "Some sightings could not be loaded. Please try again.";
            console.error(`Unable to load sightings for ${regionCodes[index]}`, result.reason);
          }
        });
        clearMapVisibleLocationIds();
        fitRequest.value += 1;
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      observationError.value = "Unable to load sightings. Please try again.";
      for (const code of regionCodes) trackEvent("data_load", { region_code: code, mode: "region", outcome: "failure", source: "network" });
      console.error("Unable to load region observations", error);
    }
  }

  async function reload(newBackMax = backMax.value) {
    updateBackMax(newBackMax);
    distMax.value = Math.max(1, Math.min(50, Number(distMax.value)));
    distSelected.value = Math.min(distSelected.value, distMax.value);
    regionCache.clear();
    if (isMylocation.value) {
      await loadNearbyObservations();
      return;
    }
    await loadRegionObservations();
  }

  async function selectRegion(region) {
    applyRegionSelection(region);

    await loadRegionObservations();
  }

  async function myLocation() {
    await loadNearbyObservations();
  }

  async function loadMedia(obsId) {
    const observations = [...observationsMylocation.value, ...regionObservations.value].filter(
      (entry) => entry.obsId === obsId,
    );
    if (!observations.length || observations.every((entry) => entry.media)) return;

    if (!mediaRequests.has(obsId)) {
      mediaRequests.set(obsId, fetchJson(`${MEDIA_BASE_URL}?${new URLSearchParams({ obsId })}`));
    }
    try {
      const json = await mediaRequests.get(obsId);
      for (const observation of observations) observation.media = json.map((item) => item.assetId);
      mediaRevision.value += 1;
    } catch (error) {
      console.error("Unable to load media", error);
    } finally {
      mediaRequests.delete(obsId);
    }
  }

  async function toggleObservationDetails(obsId) {
    const observations = [...observationsMylocation.value, ...regionObservations.value];
    const observation = observations.find((entry) => entry.obsId === obsId);
    if (!observation) return;

    const current = observationDetails[obsId];
    if (current?.status === "loaded") {
      current.isOpen = !current.isOpen;
      detailRevision.value += 1;
      return;
    }
    if (current?.status === "loading") return;

    observationDetails[obsId] = { status: "loading", isOpen: true };
    detailRevision.value += 1;
    try {
      let checklist = checklistCache.get(observation.subId);
      if (!checklistRequests.has(observation.subId) && !checklist) {
        checklistRequests.set(observation.subId, fetchJson(
          `${ebirdBaseUrl}/product/checklist/view/${encodeURIComponent(observation.subId)}`,
          { headers: { "X-eBirdApiToken": ebirdApiKey } },
        ));
      }
      if (!checklist) {
        checklist = await checklistRequests.get(observation.subId);
        checklistCache.set(observation.subId, checklist);
      }
      const details = checklist.obs.find((entry) => entry.obsId === obsId) ||
        checklist.obs.find((entry) => entry.speciesCode === observation.speciesCode);
      observationDetails[obsId] = {
        status: "loaded",
        isOpen: true,
        comments: details?.comments || "",
        mediaCounts: details?.mediaCounts || {},
      };
    } catch (error) {
      observationDetails[obsId] = { status: "error", isOpen: true };
      console.error("Unable to load observation details", error);
    } finally {
      checklistRequests.delete(observation.subId);
      detailRevision.value += 1;
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
        trackEvent("share", { method: "native", outcome: "completed" });
        return;
      } catch (error) {
        if (error?.name !== "AbortError") {
          trackEvent("share", { method: "native", outcome: "failed" });
          console.warn("Native share failed, falling back to clipboard", error);
        } else {
          trackEvent("share", { method: "native", outcome: "cancelled" });
          return;
        }
      }
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }

      await navigator.clipboard.writeText(shareUrl.value);
      trackEvent("share", { method: "clipboard", outcome: "copied" });
    } catch (error) {
      trackEvent("share", { method: "clipboard", outcome: "failed" });
      console.warn("Unable to copy share link", error);
    }
  }

  function removeRegionAndRefresh(region) {
    removeRegion(region);
    if (!isMylocation.value) {
      void loadRegionObservations();
    }
  }

  function updateRegionSelectionFromPicker(region) {
    void selectRegion(region);
  }

  const api = {
    isMylocation,
    estimatedRegionCode,
    regionFallbackFeedback,
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
    observationDetails,
    detailRevision,
    statusBadgeModalSystemId,
    showInstruction,
    sidebarOpen,
    isMobileLayout,
    fitRequest,
    isLoading,
    loadingLabel,
    observationError,
    activeStatusSystem,
    statusOptions,
    linkUrl,
    shareUrl,
    requestGeolocation,
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
    trackSetting,
    setHighlightLocationIds,
    setHighlightSpeciesCode,
    clearHighlight,
    openStatusBadgeModal,
    closeStatusBadgeModal,
    toggleInstruction,
    setSidebarOpen,
    toggleSidebar,
    loadMedia,
    toggleObservationDetails,
    openLocationPopup,
    closeLocationPopup,
    shareLink,
    myLocation,
  };

  onMounted(async () => {
    mobileMediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    syncSidebarMode = (event) => {
      const compact = event.matches;
      isMobileLayout.value = compact;

      if (!compact) {
        sidebarOpen.value = true;
      }
    };
    syncSidebarMode(mobileMediaQuery);
    mobileMediaQuery.addEventListener("change", syncSidebarMode);
    shouldSyncUrl.value = true;
    syncUrl();

    if (!initialState.isMylocation) {
      void primeGeolocationForDisplay();
    }

    if (initialState.isMylocation) {
      if (restoreSearch) {
        const controller = beginObservationRequest();
        await primeGeolocationForDisplay();
        if (controller.signal.aborted) return;
        if (!locationCoords.value) {
          await fallbackToRegions(controller.signal);
          return;
        }
      }
      await myLocation();
    } else {
      if (!hasSharedSearch && !savedSearch && !await chooseDefaultRegion()) return;
      if (regionSelected.value.length > 0) await loadRegionObservations();
    }
  });

  onBeforeUnmount(() => {
    defaultRegionController?.abort();
    observationController?.abort();
    if (mobileMediaQuery && syncSidebarMode) {
      mobileMediaQuery.removeEventListener("change", syncSidebarMode);
    }
  });

  return reactive(api);
}
