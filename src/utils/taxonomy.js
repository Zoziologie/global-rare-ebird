function decodeTaxonomyEntry(cod, value) {
  if (Array.isArray(value)) {
    const [tax = 9999, second] = value

    return {
      cod,
      tax: Number(tax) || 9999,
      category: typeof second === "string" ? second : "species",
    }
  }

  if (value && typeof value === "object") {
    return {
      cod,
      tax: Number(value.tax) || 9999,
      category: value.category || value.cat || "species",
    }
  }

  return {
    cod,
    tax: 9999,
    category: "species",
  }
}

export function buildTaxonomyLookup(rows) {
  const lookup = Object.create(null)

  if (Array.isArray(rows)) {
    for (const row of rows) {
      lookup[row.cod] = row
    }
    return lookup
  }

  for (const [cod, value] of Object.entries(rows || {})) {
    lookup[cod] = decodeTaxonomyEntry(cod, value)
  }

  return lookup
}
