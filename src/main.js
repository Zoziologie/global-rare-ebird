import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue } from 'bootstrap-vue'

//Vue.config.productionTip = false

Vue.use(BootstrapVue)

import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'
    
new Vue({
    el: '#app',
    template: '<App/>',
    components: { App },
})
