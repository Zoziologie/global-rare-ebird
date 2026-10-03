// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAnalytics, consentKey, measurementId } from "../src/utils/analytics.js";

let browser;
let tagHost;
beforeEach(() => {
  document.head.innerHTML = "";
  localStorage.clear();
  tagHost = document.createElement("head");
  browser = { document: { createElement: (tag) => document.createElement(tag), head: tagHost, get cookie() { return document.cookie; }, set cookie(value) { document.cookie = value; } }, localStorage, location: { hostname: "localhost", pathname: "/global-rare-ebird/", reload: vi.fn() } };
});
const commands = () => browser.dataLayer.map((args) => Array.from(args));

describe("basic analytics consent", () => {
  it("does not load or queue analytics before consent or after rejection and reload", () => {
    const analytics = createAnalytics(browser);
    analytics.start();
    analytics.track("share", { method: "native", outcome: "completed" });
    expect(browser.dataLayer).toBeUndefined();
    expect(tagHost.querySelector("script")).toBeNull();
    analytics.choose("rejected");
    createAnalytics(browser).start();
    expect(tagHost.querySelector("script")).toBeNull();
    expect(browser.dataLayer).toBeUndefined();
    expect(localStorage.getItem(consentKey)).toBe("rejected");
  });
  it("loads once after acceptance, keeps ads denied and sanitises automatic page context", () => {
    const analytics = createAnalytics(browser);
    analytics.choose("accepted");
    analytics.choose("accepted");
    expect(tagHost.querySelectorAll("#analytics-tag")).toHaveLength(1);
    expect(commands()[0]).toEqual(["consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }]);
    expect(commands()[1][2]).toMatchObject({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    expect(commands()[3][2]).toMatchObject({ send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, page_referrer: "", page_location: "https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/" });
    expect(commands().filter((command) => command[1] === "page_view")).toHaveLength(1);
  });
  it("restores acceptance on a fresh page", () => {
    localStorage.setItem(consentKey, "accepted");
    createAnalytics(browser).start();
    expect(tagHost.querySelector("#analytics-tag")).not.toBeNull();
  });
  it("disables collection, clears app cookies and reloads on withdrawal", () => {
    const analytics = createAnalytics(browser);
    analytics.choose("accepted");
    document.cookie = "_ga=visitor; path=/";
    document.cookie = "_ga_0B2T8GT7JC=session; path=/";
    document.cookie = "functional=keep; path=/";
    const length = commands().length;
    analytics.choose("rejected");
    analytics.track("share", { method: "native", outcome: "completed" });
    expect(browser[`ga-disable-${measurementId}`]).toBe(true);
    expect(commands()).toHaveLength(length);
    expect(browser.location.reload).toHaveBeenCalledOnce();
    expect(document.cookie).not.toContain("_ga");
    expect(document.cookie).toContain("functional=keep");
  });
  it("discards sensitive fields and rejects unexpected values and events", () => {
    const analytics = createAnalytics(browser);
    analytics.choose("accepted");
    analytics.track("data_load", { region_code: "CH", mode: "region", outcome: "success", source: "cache", latitude: 46, token: "secret", url: "https://private.example/?token=secret" });
    expect(commands().at(-1)[2]).toEqual({ region_code: "CH", mode: "region", outcome: "success", source: "cache", page_location: "https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/", page_referrer: "", page_title: "Global Rare eBird" });
    const length = commands().length;
    analytics.track("link_click", { link_category: "https://private.example" });
    analytics.track("setting_change", { setting_name: "search_text", setting_value: "secret" });
    analytics.track("unknown", { token: "secret" });
    expect(commands()).toHaveLength(length);
  });
});
