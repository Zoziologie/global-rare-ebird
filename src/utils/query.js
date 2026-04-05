function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parseShareState(search) {
  const query = new URLSearchParams(search)
  const mode = query.get("mode")
  const isMylocation = mode === "n" ? true : false
  const regionCodes = query.get("r") ? query.get("r").split("_").filter(Boolean) : []

  return {
    isMylocation,
    regionCodes,
    distSelected: Math.max(0, Math.min(50, toInteger(query.get("d"), 50))),
    backSelected: Math.max(0, Math.min(30, toInteger(query.get("t"), 1))),
    detailSelected: query.get("c") === "1",
    sppLocale: query.get("l") || "en",
  }
}

export function serializeShareState(state) {
  const query = new URLSearchParams()

  query.set("mode", state.isMylocation ? "n" : "r")

  if (state.isMylocation) {
    if (Number.isFinite(Number(state.distSelected))) {
      query.set("d", String(state.distSelected))
    }
  } else if (state.regionSelected?.length) {
    query.set(
      "r",
      state.regionSelected
        .map((region) => region.code)
        .filter(Boolean)
        .join("_")
    )
  }

  if (Number.isFinite(Number(state.backSelected))) {
    query.set("t", String(state.backSelected))
  }

  if (state.detailSelected) {
    query.set("c", "1")
  }

  if (state.sppLocale && state.sppLocale !== "en") {
    query.set("l", state.sppLocale)
  }

  return query.toString()
}
