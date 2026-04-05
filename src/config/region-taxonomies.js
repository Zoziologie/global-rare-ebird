const ABA_CHECKLIST_URL = "https://www.aba.org/aba-checklist/"

function createAbaStatusOptions() {
  return [
    { value: 1, label: "ABA-1" },
    { value: 2, label: "ABA-2" },
    { value: 3, label: "ABA-3" },
    { value: 4, label: "ABA-4" },
    { value: 5, label: "ABA-5" },
    { value: 6, label: "ABA-6" },
  ]
}

function createSwissStatusOptions() {
  return [
    { value: 1, label: "Regular" },
    { value: 2, label: "Irregular" },
    { value: 3, label: "Accidental" },
    { value: 4, label: "Rare" },
  ]
}

function normalizeRegionCode(value) {
  return String(value || "").trim().toUpperCase()
}

function matchesCountryOrSubregion(code, countryCode) {
  const normalized = normalizeRegionCode(code)
  return normalized === countryCode || normalized.startsWith(`${countryCode}-`)
}

export const regionTaxonomySystems = [
  {
    id: "aba",
    codeLabel: "ABA code",
    shortLabel: "ABA",
    defaultStatus: 1,
    minStatus: 1,
    maxStatus: 6,
    statusOptions: createAbaStatusOptions(),
    filterable: true,
    showBadge: true,
    helpUrl: ABA_CHECKLIST_URL,
    helpText: "What is the ABA checklist?",
    matchesRegionCode(code) {
      const normalized = normalizeRegionCode(code)
      return normalized === "US" || normalized === "CA" || normalized.startsWith("US-") || normalized.startsWith("CA-")
    },
    loadLookup() {
      return import("../../data/aba-taxonomy.json").then(({ default: taxonomy }) => taxonomy)
    },
    formatBadge(statusCode) {
      const code = Number(statusCode)
      return code >= 2 && code <= 6 ? `ABA-${code}` : ""
    },
    badgeClass(statusCode) {
      const code = Number(statusCode)
      return code >= 1 && code <= 6 ? `status-badge--aba-${code}` : "bg-secondary-subtle text-body"
    },
    describeStatus(statusCode) {
      const code = Number(statusCode)

      if (!Number.isFinite(code) || code < 1) {
        return ""
      }

      const descriptions = {
        1: "Regularly occurring ABA Area avifauna. Includes regular breeding species and visitors.",
        2: "Regularly occurring ABA Area avifauna. More restricted, lower-density, or harder-to-detect species.",
        3: "Rare species that occur in very low numbers, but annually, in the ABA Area.",
        4: "Casual species with some pattern of occurrence but not recorded annually.",
        5: "Accidental species recorded five or fewer times in the ABA Area, or fewer than three records in the past 30 years.",
        6: "Species that cannot be found in the ABA Area, including extinct, extirpated, or captive-only cases.",
      }

      return `ABA-${code}: ${descriptions[code] || "ABA checklist code."}`
    },
  },
  {
    id: "fr",
    codeLabel: "French code",
    shortLabel: "France",
    defaultStatus: 0,
    minStatus: 0,
    maxStatus: 1,
    filterable: false,
    showBadge: true,
    helpUrl: null,
    helpText: null,
    matchesRegionCode(code) {
      return normalizeRegionCode(code) === "FR"
    },
    loadLookup() {
      return import("../../data/french-rarity-taxonomy.json").then(({ default: taxonomy }) => taxonomy)
    },
    formatBadge(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "rare" : ""
    },
    badgeClass(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "status-badge--rare" : ""
    },
    describeStatus(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "This species is marked rare in France." : ""
    },
  },
  {
    id: "de",
    codeLabel: "German checklist",
    shortLabel: "Germany",
    defaultStatus: 0,
    minStatus: 0,
    maxStatus: 1,
    filterable: false,
    showBadge: true,
    helpUrl: null,
    helpText: null,
    matchesRegionCode(code) {
      return matchesCountryOrSubregion(code, "DE")
    },
    loadLookup() {
      return import("../../data/german-taxonomy.json").then(({ default: taxonomy }) => taxonomy)
    },
    formatBadge(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "rare" : ""
    },
    badgeClass(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "status-badge--rare" : ""
    },
    describeStatus(statusCode) {
      const code = Number(statusCode)
      return code > 0 ? "This species is listed in the German checklist." : ""
    },
  },
  {
    id: "ch",
    codeLabel: "Swiss code",
    shortLabel: "Switzerland",
    defaultStatus: 1,
    minStatus: 1,
    maxStatus: 5,
    statusOptions: createSwissStatusOptions(),
    filterable: true,
    showBadge: true,
    helpUrl: null,
    helpText: null,
    matchesRegionCode(code) {
      return matchesCountryOrSubregion(code, "CH")
    },
    loadLookup() {
      return import("../../data/swiss-taxonomy.json").then(({ default: taxonomy }) => taxonomy)
    },
    formatBadge(statusCode) {
      const code = Number(statusCode)
      switch (code) {
        case 2:
          return "irregular"
        case 3:
          return "accidental"
        case 4:
          return "rare"
        default:
          return ""
      }
    },
    badgeClass(statusCode) {
      const code = Number(statusCode)
      switch (code) {
        case 2:
          return "status-badge--irregular"
        case 3:
          return "status-badge--accidental"
        case 4:
          return "status-badge--rare"
        default:
          return ""
      }
    },
    describeStatus(statusCode) {
      const code = Number(statusCode)

      switch (code) {
        case 1:
          return "Swiss status 1, Regular: species recorded in at least 9 years out of 10 between 2005 and 2014."
        case 2:
          return "Swiss status 2, Irregular: species recorded more than 10 times and in more than 5 years between 1965 and 2014, but in fewer than 9 years out of 10 between 2005 and 2014."
        case 3:
          return "Swiss status 3, Accidental: species recorded 1-10 times or in 1-5 years between 1965 and 2014, or for the first time after 2014."
        case 4:
          return "Swiss status 4: species recorded at least once but not since 1965."
        default:
          return ""
      }
    },
  },
]

export function getRegionTaxonomySystem(regionCode) {
  return regionTaxonomySystems.find((system) => system.matchesRegionCode(regionCode)) || null
}

export function getRegionTaxonomySystems(regionCodes = []) {
  const systems = []
  const seen = new Set()

  for (const regionCode of regionCodes) {
    const system = getRegionTaxonomySystem(regionCode)
    if (!system || seen.has(system.id)) {
      continue
    }

    seen.add(system.id)
    systems.push(system)
  }

  return systems
}

export function getUniformRegionTaxonomySystem(regionCodes = []) {
  const systems = getRegionTaxonomySystems(regionCodes)
  return systems.length === 1 ? systems[0] : null
}

export function getRegionTaxonomySystemById(id) {
  return regionTaxonomySystems.find((system) => system.id === id) || null
}
