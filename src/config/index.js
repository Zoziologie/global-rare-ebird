export const ebirdBaseUrl = "https://api.ebird.org/v2";
export const ebirdApiKey = import.meta.env.EBIRD_API_KEY || "";

export const mapboxStyles = [
  {
    key: "streets",
    label: "Streets",
    url: "mapbox://styles/mapbox/streets-v12",
  },
  {
    key: "satellite",
    label: "Satellite",
    url: "mapbox://styles/mapbox/satellite-streets-v12",
  },
];

export const mapboxAccessToken = import.meta.env.MAPBOX_ACCESS_TOKEN || "";
