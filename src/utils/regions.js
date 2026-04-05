export function filterRegions(regions, query, selectedCodes = []) {
  const normalizedQuery = query.trim().toLowerCase()
  const selected = new Set(selectedCodes)

  return regions.filter((region) => {
    if (selected.has(region.code)) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return Object.values(region).some((value) =>
      String(value).toLowerCase().includes(normalizedQuery)
    )
  })
}
