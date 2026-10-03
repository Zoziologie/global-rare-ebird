import { reactive } from "vue";

export const measurementId = "G-0B2T8GT7JC";
export const consentKey = "global-rare-ebird.analytics-consent";
const pageLocation = "https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/";
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const allowedValues = {
  region_code: /^[A-Z]{2}(?:-[A-Z0-9]+){0,2}$/,
  mode: /^(region|around)$/,
  outcome: /^(success|failure|completed|cancelled|failed|copied)$/,
  source: /^(cache|network)$/,
  link_category: /^(directions|ebird_hotspot|ebird_checklist|support|github|zoziologie)$/,
  method: /^(native|clipboard)$/,
  layer: /^(streets|satellite)$/,
  setting_name: /^(species_language|radius_filter|days_filter|search_fields|sort|rarity|days_fetched|radius_fetched|map_filter|media_filter|hotspot_filter)$/,
  setting_value: /^(|true|false|[0-9]+|[a-z]{2,3}(?:_[A-Z]{2,3})?|tax|daysAgo|distToMe|comName|sciName|locName|(?:comName|sciName|locName)(?:,(?:comName|sciName|locName))*)$/,
};
const eventFields = {
  data_load: ["region_code", "mode", "outcome", "source"],
  link_click: ["link_category"],
  share: ["method", "outcome"],
  map_layer_change: ["layer"],
  mode_change: ["mode"],
  setting_change: ["setting_name", "setting_value"],
};

export function createAnalytics(browser = window) {
  const state = reactive({ choice: browser.localStorage.getItem(consentKey), open: false });
  let loaded = false;

  function start() {
    if (state.choice !== "accepted" || loaded) return;
    loaded = true;
    browser[`ga-disable-${measurementId}`] = false;
    browser.dataLayer = [];
    browser.gtag = function () { browser.dataLayer.push(arguments); };
    browser.gtag("consent", "default", denied);
    browser.gtag("consent", "update", { ...denied, analytics_storage: "granted" });
    browser.gtag("js", new Date());
    browser.gtag("config", measurementId, {
      send_page_view: false,
      page_location: pageLocation,
      page_referrer: "",
      page_title: "Global Rare eBird",
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: 60 * 60 * 24 * 365,
      cookie_update: false,
    });
    browser.gtag("event", "page_view", { page_location: pageLocation, page_referrer: "", page_title: "Global Rare eBird" });
    const script = browser.document.createElement("script");
    script.id = "analytics-tag";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    browser.document.head.append(script);
  }

  function choose(choice) {
    state.choice = choice;
    browser.localStorage.setItem(consentKey, choice);
    state.open = false;
    if (choice === "accepted") {
      start();
      return;
    }
    // Disable before clearing cookies; reload unloads the tag and its automatic timers.
    browser[`ga-disable-${measurementId}`] = true;
    for (const cookie of browser.document.cookie.split(";")) {
      const name = cookie.trim().split("=")[0];
      if (name !== "_ga" && name !== `_ga_${measurementId.slice(2).replaceAll("-", "")}`) continue;
      const domains = browser.location.hostname.split(".");
      for (let index = 0; index < domains.length; index += 1) {
        for (const domain of ["", `; domain=${domains.slice(index).join(".")}`]) {
          const paths = browser.location.pathname.split("/");
          for (let depth = 1; depth <= paths.length; depth += 1) {
            browser.document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${paths.slice(0, depth).join("/") || "/"}${domain}`;
          }
        }
      }
    }
    if (loaded) browser.location.reload();
  }

  function track(name, properties) {
    if (state.choice !== "accepted" || !loaded || !eventFields[name]) return;
    if (eventFields[name].some((field) => field in properties && !allowedValues[field].test(String(properties[field])))) return;
    const payload = Object.fromEntries(eventFields[name].filter((field) => field in properties).map((field) => [field, properties[field]]));
    browser.gtag("event", name, { ...payload, page_location: pageLocation, page_referrer: "", page_title: "Global Rare eBird" });
  }

  return { state, start, choose, track };
}

let analytics;
export function getAnalytics() {
  analytics ||= createAnalytics();
  return analytics;
}
export function trackEvent(name, properties) {
  getAnalytics().track(name, properties);
}
export function trackLinkClick(event) {
  const category = event.target.closest?.("a[data-analytics-link]")?.dataset.analyticsLink;
  if (["directions", "ebird_hotspot", "ebird_checklist", "support", "github", "zoziologie"].includes(category)) {
    trackEvent("link_click", { link_category: category });
  }
}
