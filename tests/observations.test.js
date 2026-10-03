import { describe, expect, it } from "vitest";
import { filterObservations, groupObservations, normalizeObservationRows } from "../src/utils/observations.js";

const rows = [
  { speciesCode: "amewig", comName: "American Wigeon", sciName: "Mareca americana", locId: "L1", locName: "Lake", subId: "S1", obsId: "O1", obsDt: "2026-10-03 09:00", lat: 46.8, lng: 8.2, hasRichMedia: true },
  { speciesCode: "amewig", comName: "American Wigeon", sciName: "Mareca americana", locId: "L2", locName: "Park", subId: "S2", obsId: "O2", obsDt: "2026-10-01 10:00", lat: 47.8, lng: 8.2, locationPrivate: true },
  { speciesCode: "mallar3", comName: "Mallard", sciName: "Anas platyrhynchos", locId: "L1", locName: "Lake", subId: "S1", obsId: "O3", obsDt: "2026-10-03 09:00", lat: 46.8, lng: 8.2 },
];
const options = {
  regionCode: "US", taxonomyLookup: { amewig: { tax: 1 }, mallar3: { tax: 2 } },
  regionTaxonomyLookups: { aba: { amewig: 4, mallar3: 1 } },
  referenceDate: new Date("2026-10-03T12:00:00"), location: { latitude: 46.8, longitude: 8.2 },
};
const filters = {
  isMylocation: false, backSelected: 3, distSelected: 50, statusLimit: 1,
  statusSystemId: "aba", mapSelected: false, mediaSelected: false, hotspotSelected: false,
  filterSearch: "", filterSearchOptionsSelected: ["comName", "sciName", "locName"], sortKey: "tax",
};

describe("observation processing", () => {
  it("removes duplicate checklist/species pairs while retaining other species on the checklist", () => {
    const observations = normalizeObservationRows([...rows, rows[0]], options);
    expect(observations).toHaveLength(3);
    expect(observations.map(obs => obs.daysAgo)).toEqual([0, 2, 0]);
    expect(observations[0].distToMe).toBeCloseTo(0);
    expect(observations[1].distToMe).toBeGreaterThan(100);
    expect(observations[0].statusBadge).toBe("ABA-4");
  });

  it("combines date, distance, rarity, media, hotspot, viewport, and text filters", () => {
    const observations = normalizeObservationRows(rows, options);
    expect(filterObservations(observations, {
      ...filters, isMylocation: true, backSelected: 1, statusLimit: 4,
      mediaSelected: true, hotspotSelected: true, mapSelected: true, visibleLocationIds: ["L1"],
      filterSearch: " MARECA ",
    }).map(obs => obs.obsId)).toEqual(["O1"]);
    expect(filterObservations(observations, { ...filters, mapSelected: true, visibleLocationIds: [] })).toEqual([]);
  });

  it("groups location counts across species without assigning a mixed rarity badge", () => {
    const grouped = groupObservations(normalizeObservationRows(rows, options));
    expect(grouped.species.map(species => species.speciesCode)).toEqual(["amewig", "mallar3"]);
    expect(grouped.species[0].obs.map(obs => obs.obsId)).toEqual(["O2", "O1"]);
    expect(grouped.locations.find(location => location.locId === "L1")).toMatchObject({ count: 2, speciesCount: 2, statusBadge: "" });
  });

  it("orders species by their latest sighting and by distance", () => {
    const observations = normalizeObservationRows([rows[1], rows[2]], options);
    expect(groupObservations(observations, "daysAgo").species[0].speciesCode).toBe("mallar3");
    expect(groupObservations(observations, "distToMe").species[0].speciesCode).toBe("mallar3");
  });
});
