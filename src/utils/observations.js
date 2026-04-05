import {
  getRegionTaxonomySystem,
  getRegionTaxonomySystemById,
} from "../config/region-taxonomies.js"

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function toObservationTimestamp(value) {
  const timestamp = Date.parse(value)
  if (Number.isFinite(timestamp)) {
    return timestamp
  }

  return startOfDay(value)
}

function sortByObservationDateAscending(observations) {
  return [...observations].sort((left, right) => {
    const leftDate = toObservationTimestamp(left.obsDt)
    const rightDate = toObservationTimestamp(right.obsDt)

    if (leftDate !== rightDate) {
      return leftDate - rightDate
    }

    const leftId = String(left.subId || left.obsId || "")
    const rightId = String(right.subId || right.obsId || "")
    return leftId.localeCompare(rightId)
  })
}

function getLatestObservationTimestamp(observations) {
  const lastObservation = observations[observations.length - 1]
  return lastObservation ? toObservationTimestamp(lastObservation.obsDt) : -Infinity
}

function getClosestObservationDistance(observations) {
  let closest = Number.POSITIVE_INFINITY

  for (const obs of observations) {
    const dist = Number(obs.distToMe)
    if (Number.isFinite(dist) && dist < closest) {
      closest = dist
    }
  }

  return closest
}

export function dedupeObservations(rows) {
  const seen = new Set()

  return rows.filter((row) => {
    const key = `${row.speciesCode}::${row.subId}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function normalizeStatusCode(system, rawStatus, fallbackStatus) {
  const fallback = fallbackStatus ?? system?.defaultStatus ?? null

  if (rawStatus === undefined || rawStatus === null || rawStatus === "") {
    return fallback
  }

  const numericStatus = Number(rawStatus)
  if (Number.isFinite(numericStatus)) {
    return numericStatus
  }

  return fallback
}

function createStatusSummary() {
  return {
    statuses: new Map(),
  }
}

function addStatusToSummary(summary, obs) {
  if (!obs.statusSystemId || obs.statusCode === null || obs.statusCode === undefined) {
    return summary
  }

  const code = Number(obs.statusCode)
  if (!Number.isFinite(code)) {
    return summary
  }

  const key = `${obs.statusSystemId}:${code}`
  if (!summary.statuses.has(key)) {
    summary.statuses.set(key, {
      statusSystemId: obs.statusSystemId,
      statusCode: code,
    })
  }

  return summary
}

function finalizeStatusSummary(summary) {
  if (!summary.statuses || summary.statuses.size !== 1) {
    return {
      statusSystemId: null,
      statusCode: null,
      statusBadge: "",
      statusBadgeClass: "",
      statusTooltip: "",
    }
  }

  const [{ statusSystemId, statusCode }] = summary.statuses.values()
  const system = getRegionTaxonomySystemById(statusSystemId)
  const statusBadge = system?.showBadge ? system.formatBadge(statusCode) : ""
  const statusBadgeClass = system?.showBadge ? system.badgeClass(statusCode) : ""
  const statusTooltip = system?.describeStatus ? system.describeStatus(statusCode) || "" : ""

  return {
    statusSystemId,
    statusCode,
    statusBadge,
    statusBadgeClass,
    statusTooltip,
  }
}

export function normalizeObservationRows(rows, options) {
  const {
    regionCode,
    taxonomyLookup,
    regionTaxonomyLookups = {},
    referenceDate = new Date(),
    location = null,
    nonAbaScore = 10,
  } = options

  const startOfReferenceDay = startOfDay(referenceDate)
  const statusSystem = getRegionTaxonomySystem(regionCode)
  const statusLookup = statusSystem ? regionTaxonomyLookups[statusSystem.id] : null
  const defaultStatus = statusSystem?.defaultStatus ?? nonAbaScore

  return dedupeObservations(rows).map((raw) => {
    const statusCode = statusSystem
      ? normalizeStatusCode(statusSystem, statusLookup?.[raw.speciesCode], defaultStatus)
      : nonAbaScore

    const obs = {
      regionCode,
      comName: raw.comName,
      sciName: raw.sciName,
      speciesCode: raw.speciesCode,
      howMany: raw.howMany ?? "x",
      locId: raw.locId,
      subId: raw.subId,
      locName: raw.locName,
      locationPrivate: Boolean(raw.locationPrivate),
      obsDt: raw.obsDt,
      daysAgo: Math.round((startOfReferenceDay - startOfDay(raw.obsDt)) / DAY_MS),
      latLng: {
        lat: Number(raw.lat),
        lng: Number(raw.lng),
      },
      obsId: raw.obsId,
      userDisplayName: raw.userDisplayName || "",
      hasComments: Boolean(raw.hasComments),
      hasRichMedia: Boolean(raw.hasRichMedia),
      statusSystemId: statusSystem?.id ?? null,
      statusCode,
      statusBadge: statusSystem?.showBadge ? statusSystem.formatBadge(statusCode) : "",
      statusBadgeClass: statusSystem?.showBadge ? statusSystem.badgeClass(statusCode) : "",
      statusTooltip: statusSystem?.describeStatus ? statusSystem.describeStatus(statusCode) || "" : "",
    }

    if (location?.latitude !== undefined && location?.longitude !== undefined) {
      obs.distToMe = calcCrow(
        obs.latLng.lat,
        obs.latLng.lng,
        Number(location.latitude),
        Number(location.longitude)
      )
    }

    const taxon = taxonomyLookup[obs.speciesCode]

    if (taxon) {
      obs.category = taxon.category || "species"
      obs.tax = Number(taxon.tax || 9999)
      obs.aba = statusSystem?.id === "aba" ? statusCode : nonAbaScore
      obs.frenchRarity = statusSystem?.id === "fr" ? statusCode > 0 : false
      obs.germanListStatus = statusSystem?.id === "de" ? statusCode : null
      obs.swissStatus = statusSystem?.id === "ch" ? statusCode : null
    } else {
      obs.category = "unknown"
      obs.tax = 9999
      obs.aba = statusSystem?.id === "aba" ? statusCode : nonAbaScore
      obs.frenchRarity = statusSystem?.id === "fr" ? statusCode > 0 : false
      obs.germanListStatus = statusSystem?.id === "de" ? statusCode : null
      obs.swissStatus = statusSystem?.id === "ch" ? statusCode : null
    }

    return obs
  })
}

export function applyDistanceToObservations(observations, location) {
  if (location?.latitude === undefined || location?.longitude === undefined) {
    return observations
  }

  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return observations
  }

  for (const obs of observations || []) {
    if (!obs?.latLng) {
      continue
    }

    obs.distToMe = calcCrow(
      Number(obs.latLng.lat),
      Number(obs.latLng.lng),
      latitude,
      longitude,
    )
  }

  return observations
}

export function sortObservations(observations, sortKey) {
  const sorted = [...observations]

  sorted.sort((left, right) => {
    if (sortKey === "daysAgo") {
      return right.daysAgo - left.daysAgo
    }

    const leftValue = left[sortKey]
    const rightValue = right[sortKey]

    if (leftValue === rightValue) {
      return right.daysAgo - left.daysAgo
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue
    }

    return String(leftValue).localeCompare(String(rightValue))
  })

  return sorted
}

export function filterObservations(observations, options) {
  const {
    isMylocation,
    backSelected,
    distSelected,
    statusLimit,
    statusSystemId = null,
    abaLimit,
    mapSelected,
    visibleLocationIds = null,
    mediaSelected,
    hotspotSelected,
    filterSearch,
    filterSearchOptionsSelected,
    sortKey,
  } = options

  const search = filterSearch.trim().toLowerCase()
  const effectiveStatusLimit = Number.isFinite(Number(statusLimit))
    ? Number(statusLimit)
    : Number(abaLimit)

  let filtered = observations.filter((obs) => obs.daysAgo <= Number(backSelected))

  if (isMylocation) {
    filtered = filtered.filter((obs) => Number(obs.distToMe) <= Number(distSelected))
  }

  if (statusSystemId) {
    filtered = filtered.filter((obs) =>
      obs.statusSystemId === statusSystemId
        ? Number(obs.statusCode) >= effectiveStatusLimit
        : true,
    )
  } else if (Number.isFinite(effectiveStatusLimit)) {
    filtered = filtered.filter((obs) => Number(obs.aba) >= effectiveStatusLimit)
  }

  if (mediaSelected) {
    filtered = filtered.filter((obs) => obs.hasRichMedia)
  }

  if (hotspotSelected) {
    filtered = filtered.filter((obs) => !obs.locationPrivate)
  }

  if (mapSelected && visibleLocationIds) {
    const visibleSet =
      visibleLocationIds instanceof Set ? visibleLocationIds : new Set(visibleLocationIds)

    filtered = filtered.filter((obs) => visibleSet.has(obs.locId))
  }

  if (search && filterSearchOptionsSelected.length) {
    filtered = filtered.filter((obs) =>
      filterSearchOptionsSelected.some((key) =>
        String(obs[key] ?? "")
          .toLowerCase()
          .includes(search)
      )
    )
  }

  return sortObservations(filtered, sortKey)
}

function sortSpeciesEntries(entries, sortKey) {
  const sorted = [...entries]

  sorted.sort((left, right) => {
    if (sortKey === "daysAgo") {
      const leftLatest = getLatestObservationTimestamp(left.obs)
      const rightLatest = getLatestObservationTimestamp(right.obs)

      if (leftLatest !== rightLatest) {
        return rightLatest - leftLatest
      }

      return left.comName.localeCompare(right.comName)
    }

    if (sortKey === "distToMe") {
      const leftDistance = getClosestObservationDistance(left.obs)
      const rightDistance = getClosestObservationDistance(right.obs)

      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }

      const leftLatest = getLatestObservationTimestamp(left.obs)
      const rightLatest = getLatestObservationTimestamp(right.obs)

      if (leftLatest !== rightLatest) {
        return rightLatest - leftLatest
      }

      return left.comName.localeCompare(right.comName)
    }

    const leftValue =
      sortKey === "tax" ? Number(left.tax ?? Number.POSITIVE_INFINITY) : left[sortKey]
    const rightValue =
      sortKey === "tax" ? Number(right.tax ?? Number.POSITIVE_INFINITY) : right[sortKey]

    if (leftValue === rightValue) {
      return left.comName.localeCompare(right.comName)
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue
    }

    return String(leftValue).localeCompare(String(rightValue))
  })

  return sorted
}

export function groupObservations(observations, sortKey = "tax") {
  const speciesMap = new Map()
  const locationMap = new Map()

  for (const obs of observations) {
    let species = speciesMap.get(obs.speciesCode)
    if (!species) {
      species = {
        obs: [],
        count: 0,
        comName: obs.comName,
        speciesCode: obs.speciesCode,
        tax: obs.tax,
        statusSystemId: obs.statusSystemId,
        statusCode: obs.statusCode,
        statusBadge: obs.statusBadge,
        statusBadgeClass: obs.statusBadgeClass,
        statusTooltip: obs.statusTooltip,
        aba: obs.aba,
        frenchRarity: obs.frenchRarity,
        germanListStatus: obs.germanListStatus,
        swissStatus: obs.swissStatus,
        _statusSummary: createStatusSummary(),
        _locationMap: new Map(),
      }
      speciesMap.set(obs.speciesCode, species)
    }

    species.obs.push(obs)
    species.count += 1
    addStatusToSummary(species._statusSummary, obs)

    let speciesLocation = species._locationMap.get(obs.locId)
    if (!speciesLocation) {
      speciesLocation = {
        obs: [],
        locName: obs.locName,
        locationPrivate: obs.locationPrivate,
        regionCode: obs.regionCode,
        latLng: obs.latLng,
        locId: obs.locId,
        count: 0,
        _speciesCodes: new Set(),
        _statusSummary: createStatusSummary(),
      }
      species._locationMap.set(obs.locId, speciesLocation)
    }

    speciesLocation.obs.push(obs)
    speciesLocation.count += 1
    speciesLocation._speciesCodes.add(obs.speciesCode)
    addStatusToSummary(speciesLocation._statusSummary, obs)

    let location = locationMap.get(obs.locId)
    if (!location) {
      location = {
        obs: [],
        count: 0,
        locName: obs.locName,
        locationPrivate: obs.locationPrivate,
        regionCode: obs.regionCode,
        latLng: obs.latLng,
        locId: obs.locId,
        _speciesCodes: new Set(),
        _statusSummary: createStatusSummary(),
      }
      locationMap.set(obs.locId, location)
    }

    location.obs.push(obs)
    location.count += 1
    location._speciesCodes.add(obs.speciesCode)
    addStatusToSummary(location._statusSummary, obs)
  }

  const species = sortSpeciesEntries(
    Array.from(speciesMap.values()).map((entry) => {
    const { _locationMap, _statusSummary, ...speciesEntry } = entry
    const status = finalizeStatusSummary(_statusSummary)
    speciesEntry.obs = sortByObservationDateAscending(speciesEntry.obs)
    speciesEntry.loc = Array.from(_locationMap.values()).map((locationEntry) => {
      const { _speciesCodes, _statusSummary: locationStatusSummary, ...safeLocationEntry } =
        locationEntry
      const locationStatus = finalizeStatusSummary(locationStatusSummary)
      const speciesCodes = Array.from(_speciesCodes.values()).sort()

      return {
        ...safeLocationEntry,
        obs: sortByObservationDateAscending(safeLocationEntry.obs),
        speciesCount: speciesCodes.length,
        speciesCodes,
        statusSystemId: locationStatus.statusSystemId,
        statusCode: locationStatus.statusCode,
        statusBadge: locationStatus.statusBadge,
        statusBadgeClass: locationStatus.statusBadgeClass,
        statusTooltip: locationStatus.statusTooltip,
      }
    })
    speciesEntry.statusSystemId = status.statusSystemId
    speciesEntry.statusCode = status.statusCode
    speciesEntry.statusBadge = status.statusBadge
    speciesEntry.statusBadgeClass = status.statusBadgeClass
    speciesEntry.statusTooltip = status.statusTooltip
    speciesEntry.aba = status.statusSystemId === "aba" ? status.statusCode : 10
    speciesEntry.frenchRarity = status.statusSystemId === "fr" ? status.statusCode > 0 : false
    speciesEntry.germanListStatus = status.statusSystemId === "de" ? status.statusCode : null
    speciesEntry.swissStatus = status.statusSystemId === "ch" ? status.statusCode : null
    return speciesEntry
  }),
    sortKey,
  )

  const locations = Array.from(locationMap.values()).map((entry) => {
    const { _speciesCodes, _statusSummary, ...locationEntry } = entry
    const status = finalizeStatusSummary(_statusSummary)
    const speciesCodes = Array.from(_speciesCodes.values()).sort()
    locationEntry.obs = sortByObservationDateAscending(locationEntry.obs)
    locationEntry.statusSystemId = status.statusSystemId
    locationEntry.statusCode = status.statusCode
    locationEntry.statusBadge = status.statusBadge
    locationEntry.statusBadgeClass = status.statusBadgeClass
    locationEntry.statusTooltip = status.statusTooltip
    locationEntry.speciesCount = speciesCodes.length
    locationEntry.speciesCodes = speciesCodes
    return locationEntry
  })

  return { species, locations }
}

export function groupLocationPopups(location) {
  const grouped = new Map()

  for (const obs of location?.obs || []) {
    let species = grouped.get(obs.speciesCode)
    if (!species) {
      species = {
        obs: [],
        comName: obs.comName,
        speciesCode: obs.speciesCode,
        _statusSummary: createStatusSummary(),
        _speciesCodes: new Set([obs.speciesCode]),
        statusSystemId: obs.statusSystemId,
        statusCode: obs.statusCode,
        statusBadge: obs.statusBadge,
        statusBadgeClass: obs.statusBadgeClass,
        statusTooltip: obs.statusTooltip,
        aba: obs.aba,
        frenchRarity: obs.frenchRarity,
        germanListStatus: obs.germanListStatus,
        swissStatus: obs.swissStatus,
      }
      grouped.set(obs.speciesCode, species)
    }

    species.obs.push(obs)
    addStatusToSummary(species._statusSummary, obs)
  }

  return sortSpeciesEntries(
    Array.from(grouped.values()).map((species) => {
    const { _speciesCodes, _statusSummary, ...speciesEntry } = species
    const status = finalizeStatusSummary(_statusSummary)

    return {
      ...speciesEntry,
      obs: sortByObservationDateAscending(speciesEntry.obs),
      speciesCount: _speciesCodes ? _speciesCodes.size : 1,
      speciesCodes: _speciesCodes ? Array.from(_speciesCodes.values()).sort() : [species.speciesCode],
      statusSystemId: status.statusSystemId,
      statusCode: status.statusCode,
      statusBadge: status.statusBadge,
      statusBadgeClass: status.statusBadgeClass,
      statusTooltip: status.statusTooltip,
      aba: status.statusSystemId === "aba" ? status.statusCode : 10,
      frenchRarity: status.statusSystemId === "fr" ? status.statusCode > 0 : false,
      germanListStatus: status.statusSystemId === "de" ? status.statusCode : null,
      swissStatus: status.statusSystemId === "ch" ? status.statusCode : null,
    }
  }),
    "daysAgo",
  )
}

export function calcCrow(lat1, lon1, lat2, lon2) {
  const radius = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const lat1Rad = toRad(lat1)
  const lat2Rad = toRad(lat2)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return radius * c
}

export function toRad(value) {
  return (value * Math.PI) / 180
}
