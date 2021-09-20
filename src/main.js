import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue } from 'bootstrap-vue'
Vue.use(BootstrapVue)

import axios from 'axios';
Vue.prototype.$http = axios

//Vue.config.productionTip = false


import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

import Multiselect from 'vue-multiselect'
Vue.component('multiselect', Multiselect)
    
new Vue({
    el: '#app',
    template: '<App/>',
    components: { App },
})
