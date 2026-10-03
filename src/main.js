import { createApp } from "vue"

import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

import "./style.css"
import App from "./App.vue"

import { consentKey, getAnalytics, trackLinkClick } from "./utils/analytics.js"

getAnalytics().start()
document.addEventListener("click", trackLinkClick, true)
window.addEventListener("storage", (event) => {
  if (event.key === consentKey && ["accepted", "rejected"].includes(event.newValue)) {
    getAnalytics().choose(event.newValue)
  }
})

const app = createApp(App)

app.mount("#app")
