import { createApp } from "vue"

import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import "mapbox-gl/dist/mapbox-gl.css"

import "./style.scss"
import App from "./App.vue"

const app = createApp(App)

app.mount("#app")

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  const swUrl = `${import.meta.env.BASE_URL}sw.js`

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}
