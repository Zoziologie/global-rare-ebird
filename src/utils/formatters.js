export function formatDaysAgo(daysAgo) {
  if (daysAgo === 0) {
    return "Today"
  }

  if (daysAgo === 1) {
    return "Yesterday"
  }

  return `${daysAgo} days ago`
}

export function formatObservationTime(isoDate) {
  return new Date(isoDate).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatDistanceKm(distanceKm) {
  const value = Number(distanceKm)
  if (!Number.isFinite(value)) {
    return ""
  }

  return value < 10 ? `${value.toFixed(1)} km` : `${Math.round(value)} km`
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
