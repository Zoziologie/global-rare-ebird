import Vue from "vue";
import App from "./App.vue";

import { BootstrapVue, BootstrapVueIcons } from "bootstrap-vue";
Vue.use(BootstrapVue);
Vue.use(BootstrapVueIcons);

import axios from "axios";
Vue.prototype.$http = axios;

//Vue.config.productionTip = false

import Multiselect from "vue-multiselect";
Vue.component("multiselect", Multiselect);

import { library } from "@fortawesome/fontawesome-svg-core";
import { faDirections, faClone } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
library.add(faDirections, faClone);
Vue.component("font-awesome-icon", FontAwesomeIcon);

import VueCookie from "vue-cookie";
Vue.use(VueCookie);

new Vue({
  render: (h) => h(App),
}).$mount("#app");
