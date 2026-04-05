export const filterSearchOptions = [
  { text: "Common name", value: "comName" },
  { text: "Scientific name", value: "sciName" },
  { text: "Location name", value: "locName" },
]

export function createSortOptionLabels(hasLocationCoords = false) {
  return [
    { text: "Taxonomic order", value: "tax" },
    ...(hasLocationCoords ? [{ text: "Distance to me", value: "distToMe" }] : []),
    { text: "Date", value: "daysAgo" },
  ]
}
