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
    ).catch((error) => {
      taxonomyLookupPromise = null;
      throw error;
    });
  }

  return taxonomyLookupPromise;
}

export async function loadRegionTaxonomyLookup(system) {
  if (!system) {
    return null;
  }

  if (!regionLookupPromises.has(system.id)) {
    regionLookupPromises.set(system.id, system.loadLookup().catch((error) => {
      regionLookupPromises.delete(system.id);
      throw error;
    }));
  }

  return regionLookupPromises.get(system.id);
}

export async function loadRegionTaxonomyLookups(regionCodes = []) {
  const regionTaxonomyLookups = Object.create(null);

  await Promise.all(getRegionTaxonomySystems(regionCodes).map(async (system) => {
    regionTaxonomyLookups[system.id] = await loadRegionTaxonomyLookup(system);
  }));

  return regionTaxonomyLookups;
}

export async function loadTaxonomyResources(regionCodes = []) {
  const [taxonomyLookup, regionTaxonomyLookups] = await Promise.all([
    loadTaxonomyLookup(),
    loadRegionTaxonomyLookups(regionCodes),
  ]);
  return { taxonomyLookup, regionTaxonomyLookups };
}

export { regionTaxonomySystems };
