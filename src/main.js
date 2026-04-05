import { createApp } from "vue"

import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import "mapbox-gl/dist/mapbox-gl.css"

import "./style.css"
import App from "./App.vue"

const app = createApp(App)

app.mount("#app")
