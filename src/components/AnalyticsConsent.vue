<template>
  <section v-if="!analytics.state.choice || analytics.state.open" class="analytics-banner" aria-labelledby="analytics-title" @keydown.esc="closePreferences">
    <h2 id="analytics-title">Better tools, more birding</h2>
    <p>Help us understand what works and what needs fixing? Optional analytics cookies show us how this tool is used. No ads, no precise locations—just better birding.</p>
    <p>Your choice. Change it anytime in Settings → “Privacy &amp; cookies”.</p>
    <details>
      <summary>Privacy and cookie notice</summary>
      <p>Google Analytics collects usage and device information, recognises returning browsers using cookies, and processes IP addresses to derive approximate location. We do not send precise coordinates, searches, or shared URLs. Advertising features are disabled. Your choice is saved on this device. Analytics cookies last up to one year. Google Analytics is configured to retain event data for two months and user data for fourteen months. Aggregated reports have separate retention; see the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a> for Google's processing and retention. Rejecting keeps this app usable without analytics. Withdrawing stops future collection and removes this app's Analytics cookies; it does not delete data already collected. Functional preferences and services such as eBird and Mapbox are separate from analytics consent.</p>
    </details>
    <div class="analytics-banner__actions">
      <button ref="acceptButton" type="button" class="btn btn-brand-outline" @click="choose('accepted')">Accept analytics</button>
      <button type="button" class="btn btn-brand-outline" @click="choose('rejected')">Reject analytics</button>
    </div>
  </section>
</template>

<script setup>
import { nextTick, ref } from "vue"
import { getAnalytics } from "../utils/analytics.js"
const analytics = getAnalytics()
defineExpose({ openPreferences })
const acceptButton = ref(null)
let opener
async function openPreferences(event) {
  opener = event.currentTarget
  analytics.state.open = true
  await nextTick()
  acceptButton.value.focus()
}
function closePreferences() {
  analytics.state.open = false
  opener?.focus()
}
function choose(choice) {
  analytics.choose(choice)
  opener?.focus()
}
</script>
