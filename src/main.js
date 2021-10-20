import Vue from 'vue'
import App from './App.vue'
import { BootstrapVue , BootstrapVueIcons} from 'bootstrap-vue'




Vue.use(BootstrapVue)
Vue.use(BootstrapVueIcons)

import axios from 'axios';
Vue.prototype.$http = axios

//Vue.config.productionTip = false


import Multiselect from 'vue-multiselect'
Vue.component('multiselect', Multiselect)
    
new Vue({
    el: '#app',
    template: '<App/>',
    components: { App },
})
