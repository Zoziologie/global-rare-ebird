import { buildTaxonomyLookup } from "./taxonomy";
import {
  getRegionTaxonomySystems,
  regionTaxonomySystems,
} from "../config/region-taxonomies.js";

let taxonomyLookupPromise;
const regionLookupPromises = new Map();

export async function loadTaxonomyLookup() {
  if (!taxonomyLookupPromise) {
    taxonomyLookupPromise = import("../../data/taxo.json").then(({ default: taxo }) =>
      buildTaxonomyLookup(taxo),
    );
  }

  return taxonomyLookupPromise;
}

export async function loadRegionTaxonomyLookup(system) {
  if (!system) {
    return null;
  }

  if (!regionLookupPromises.has(system.id)) {
    regionLookupPromises.set(system.id, system.loadLookup());
  }

  return regionLookupPromises.get(system.id);
}

export async function loadRegionTaxonomyLookups(regionCodes = []) {
  const regionTaxonomyLookups = Object.create(null);

  for (const system of getRegionTaxonomySystems(regionCodes)) {
    regionTaxonomyLookups[system.id] = await loadRegionTaxonomyLookup(system);
  }

  return regionTaxonomyLookups;
}

export async function loadTaxonomyResources(regionCodes = []) {
  const taxonomyLookup = await loadTaxonomyLookup();
  const resources = {
    taxonomyLookup,
    regionTaxonomyLookups: Object.create(null),
  };

  for (const system of getRegionTaxonomySystems(regionCodes)) {
    resources.regionTaxonomyLookups[system.id] = await loadRegionTaxonomyLookup(system);
  }

  return resources;
}

export { regionTaxonomySystems };
