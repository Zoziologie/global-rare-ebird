import { createApp } from "vue"

import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

import "./style.css"
import App from "./App.vue"

import { getAnalytics, trackLinkClick } from "./utils/analytics.js"

getAnalytics().start()
document.addEventListener("click", trackLinkClick, true)

const app = createApp(App)

app.mount("#app")
