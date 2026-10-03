// Only request region codes; IP coordinates are unsuitable for nearby searches.
export async function lookupDefaultRegion(regions, signal) {
  try {
    const response = await fetch("https://ipwho.is/?fields=success,country_code,region_code", {
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return null;
    const result = await response.json();
    if (!result.success) return null;
    const country = regions.get(result.country_code);
    if (["US", "CA"].includes(result.country_code)) {
      return regions.get(`${result.country_code}-${result.region_code}`) || country || null;
    }
    return country || null;
  } catch {
    return null;
  }
}
