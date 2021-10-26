<template>
<b-container fluid class="h-100 d-flex flex-column">
  
  <b-row class="flex-grow-1">
    
    <l-map :bounds="bounds" @update:bounds="boundsUpdated" :options="{zoomControl: false}" ref="map">
      <l-control-layers position="topright"></l-control-layers>
      <l-control position="topleft" >
        <b-button v-b-toggle.sidebar-1><b-icon-layout-sidebar-inset></b-icon-layout-sidebar-inset> Sidebar</b-button>
      </l-control>
      <l-tile-layer
        v-for="tileProvider in tileProviders"
        :key="tileProvider.name"
        :name="tileProvider.name"
        :visible="tileProvider.visible"
        :url="tileProvider.url"
        :attribution="tileProvider.attribution"
        layer-type="base"/>
        <l-control-zoom position="bottomright"></l-control-zoom>
        <v-marker-cluster :options="{showCoverageOnHover: false, maxClusterRadius: 50}">
          <l-marker ref="markers" :name="obs.speciesCode+obs.subId" v-for="obs in observationsFiltered" :key="obs.speciesCode+obs.subId" :lat-lng="obs.latLng">
            <l-icon
              :popup-anchor="[0, -19]"
              :icon-anchor="[15, 19]"
              :icon-size="[22, 30]"
              :icon-url="obs.locationPrivate ? assets.iconPersonal : assets.iconHotspot"
            />
            <l-popup>
              <b-card>
              
              <b-card-title>{{obs.howMany}} {{obs.comName}}</b-card-title>
              <b-card-sub-title class="mb-2">{{obs.sciName}}</b-card-sub-title>
              <b-card-text>
                <a v-bind:href="'https://ebird.org/checklist/'+obs.subId+'#'+obs.speciesCode" target="_blank">{{obs.locName}}</a>

                  <span v-if="obs.hasRichMedia">
                        <b-icon-camera-fill></b-icon-camera-fill>
                  </span>
                  <span v-if="obs.hasComments">
                        <b-icon-chat-square-text-fill></b-icon-chat-square-text-fill>
                  </span>
                  by {{obs.userDisplayName}}

                </b-card-text>

                <template #footer>
        <small>
                      <span v-if="obs.daysAgo==0">
                        today 
                      </span>
                      <span v-else-if="obs.daysAgo==1">
                        yesterday
                      </span>
                      <span v-else-if="obs.daysAgo<6">
                        {{obs.daysAgo}} days ago
                      </span>
                      <span v-else>
                        {{obs.obsDt}} days ago
                      </span>
                    </small>
      </template>
</b-card>
            </l-popup>
          </l-marker>
        </v-marker-cluster>
        
        <l-circle v-if="isMylocation"
          :lat-lng="[location.latitude, location.longitude]"
          :radius="distSelected*1000"
          color="#4ca800"
          :fillOpacity=0

        />
        <l-circle-marker v-if="isMylocation"
          :lat-lng="[location.latitude, location.longitude]"
          :radius=8
          color="white"
          fillColor="#4ca800"
          :fillOpacity=1
        />
    </l-map>
    










    <b-sidebar id="sidebar-1" title="Global Rare eBird" visible shadow>
      <b-overlay :show="showOverlay" rounded="sm" >
      <div class="px-3 py-2">
        

        <b-form>
          <b-form-group>
          <b-input-group >
            <template #prepend>
        <b-dropdown class="bg-green">
          <template #button-content>
            <b-icon-globe font-scale="1" v-if="!isMylocation"></b-icon-globe>
            <b-icon-geo-alt font-scale="1" v-if="isMylocation"></b-icon-geo-alt>
          </template>
          <b-dropdown-item @click="isMylocation = false"><b-icon-globe class="mr-2"></b-icon-globe> Countries</b-dropdown-item>
          <b-dropdown-divider></b-dropdown-divider>
          <b-dropdown-item @click="myLocation();"><b-icon-geo-alt class="mr-2"></b-icon-geo-alt> My location</b-dropdown-item>
        </b-dropdown>
        </template>

           <multiselect v-model="regionSelected" :options="regionSearch" :multiple="true" label="name" track-by="name" 
        placeholder="Select a region " :select-label="''" :deselect-label="''" 
        @remove="removeRegion" @select="AddRegion" style="flex: 1 1;" v-if="!isMylocation">
        <template slot="option" slot-scope="props">
          {{ props.option.name }} <small>{{ props.option.code }}</small>
        </template>
        </multiselect>
        <b-form-input v-model="distSelected" type="number" min="0" :max=distDist step="1" v-if="isMylocation"></b-form-input>
        <b-input-group-append is-text v-if="isMylocation">
            km away
          </b-input-group-append>
        </b-input-group>
          </b-form-group>

<b-form-group>
        <b-input-group append="days ago">
          <b-input-group-prepend is-text>
            <b-icon-calendar-date class="mx-2"></b-icon-calendar-date>
          </b-input-group-prepend>
          <b-form-input v-model="dateSelected" type="number" min="0" :max=backTime step="1"></b-form-input>
        </b-input-group>
</b-form-group>

<b-form-group>
        <b-input-group>
        <b-form-input v-model="filterSearch" type="search" placeholder="Search..."></b-form-input>
        <template #prepend>
        <b-dropdown class="bg-green">
          <template #button-content>
            <b-icon-filter font-scale="1"></b-icon-filter>
          </template>
            <b-form-group label="Search by:" v-slot="{ ariaDescribedby }" class="p-1 py-0">
              <b-form-checkbox-group
                v-model="filterSearchOptionsSelected"
                :options="filterSearchOptions"
                :aria-describedby="ariaDescribedby"
              ></b-form-checkbox-group>
            </b-form-group>
        </b-dropdown>
        </template>
        </b-input-group>
</b-form-group>
        </b-form>
        <label class="mt-2">Sightings:</label>
        <div class="accordion" role="tablist">
          <b-card no-body class="mb-1" v-for="spe in speciesFiltered" :key="spe.speciesCode">
            <b-card-header  header-tag="header" role="tab" v-b-toggle="'accordion-'+spe.speciesCode" class="p-1 d-flex justify-content-between align-items-center cursor-pointer" @mouseover="mouseOverListHeader(spe.speciesCode)" @mouseout="mouseOutList">
              {{spe.comName}}
              <b-badge pill style="background-color: #343a40;">{{spe.count}}</b-badge>
            </b-card-header>
            <b-collapse v-bind:id="'accordion-'+spe.speciesCode" accordion="my-accordion" role="tabpanel">
              <!--<b-card-body>
                <b-card-text>I start opened because <code>visible</code> is <code>true</code></b-card-text>
              </b-card-body>-->
              <b-list-group>
                <b-list-group-item v-for="obs in spe.obs" :key="spe.speciesCode+obs.subId" class="py-2 px-2 hover-darken" @mouseover="mouseOverListItem(spe.speciesCode+obs.subId)" @mouseout="mouseOutList">
                  <div class="d-flex w-100 justify-content-between">
                  <a v-bind:href="'https://ebird.org/hotspot/'+obs.locId" target="_blank" title="eBird hotspot" v-if="!obs.locationPrivate">{{obs.locName}}</a>
                  <span v-else>{{ obs.locName }}</span>
                  <span style="flex: none;">
                    <a v-bind:href="'https://ebird.org/checklist/'+obs.subId+'#'+obs.speciesCode" target="_blank" title="eBird checklist" class="mr-1">
                      <font-awesome-icon icon="clone" />
                    </a>
                    <a v-bind:href="'https://www.google.com/maps?saddr=My+Location&daddr='+obs.lat+','+obs.lng" target="_blank" title="direction on google map">
                    <font-awesome-icon icon="directions" />
                    </a>
                  </span>
                    
                  
                  </div>
                  <div class="d-flex w-100 justify-content-between">
                    <small>{{obs.daysAgoFmt}}</small>
                    <small>Count: {{obs.howMany}}</small>
                    <span v-if="obs.hasRichMedia|obs.hasComments">
                      <span v-if="obs.hasRichMedia">
                          <small><b-icon-camera-fill class="mr-1"></b-icon-camera-fill></small>
                    </span>
                    <span v-if="obs.hasComments">
                          <small><b-icon-chat-square-text-fill></b-icon-chat-square-text-fill></small>
                    </span>
                  </span>
                    
                  </div>

                </b-list-group-item>
              </b-list-group>
            </b-collapse>
          </b-card>
        </div>
      </div>

    </b-overlay>
          <template #footer>
       <div class="d-flex bg-dark text-light align-items-center px-3 py-2 w-100 justify-content-between">
       <a v-b-modal.modal-instruction title="instruction/setting"> <b-icon-gear-fill></b-icon-gear-fill></a>
       <a href="https://github.com/Zoziologie/global-rare-ebird/" target="_blank" title="github"> <b-icon-github style="color:white;"></b-icon-github></a>
       <!--<a href="https://documenter.getpostman.com/view/664302/S1ENwy59" target="_blank"> <b-img :src=assets.ebird style="height: 16px;"></b-img></a>-->
       <a href="https://zoziologie.raphaelnussbaumer.com/" target="_blank" title="zoziologie.com"><b-img :src=assets.logo style="height: 16px;"></b-img></a>
       </div>
      </template>
    </b-sidebar>
  </b-row>
  <b-modal id="modal-instruction">
    <h2>Instruction</h2>
    <p>Query rare sightings per countries (or states for US and CA). Filter per date, location and species name.</p>
    How is it made?

    Report and issue?


<h2>Bookmark</h2>
You can create a bookmark and share a link using the following URL
?r=CH&back=4&mylocation=1&dist=20

<h2>Setting</h2>
<p>The following settings can affect the performance of the website.</p>
<b-form-checkbox v-model="mapSelected"> sync observations list with map view</b-form-checkbox>

 <b-form-checkbox v-model="mediaSelected"> only with media</b-form-checkbox>

 <b-form-checkbox v-model="hotspot"> only at hotspot</b-form-checkbox>

 <b-form-input v-model="distDist" type="number" min="0" max="50" step="1"></b-form-input>

 <b-form-input v-model="backTime" type="number" min="0" max="30" step="1"></b-form-input>



  </b-modal>
</b-container>
</template>

<script>

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { latLngBounds, latLng } from "leaflet";
import { LMap, LTileLayer, LControlLayers, LControl, LControlZoom, LMarker, LPopup, LIcon, LCircle, LCircleMarker } from "vue2-leaflet";
import moment from 'moment';
import Vue2LeafletMarkerCluster from 'vue2-leaflet-markercluster'

import 'leaflet-defaulticon-compatibility/';

export default {
  components: {
    LMap,
    LTileLayer,
    LControlLayers,
    LControl,
    LControlZoom,
    LMarker,
    LPopup,
    LIcon,
    LCircle,
    LCircleMarker,
    'v-marker-cluster': Vue2LeafletMarkerCluster
  },
  data() {
    return {
      isMylocation : false,
      location:null,
      bounds:latLngBounds([
        [90, 180],
        [-90,-180]
      ]),
      tileProviders: [
        {
          name: 'Mapbox.Streets',
          visible: true,
          url: 'https://api.mapbox.com/styles/v1/mapbox/streets-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoicmFmbnVzcyIsImEiOiIzMVE1dnc0In0.3FNMKIlQ_afYktqki-6m0g',
          attribution: '',
        },
        {
          name: 'Mapbox.Satellite',
          visible: false,
          url: 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoicmFmbnVzcyIsImEiOiIzMVE1dnc0In0.3FNMKIlQ_afYktqki-6m0g',
          attribution: '',
        },
        {
          name: 'OpenStreetMap',
          visible: false,
          attribution:'&copy; <a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        },
        {
          name: 'Esri.WorldImagery',
          visible: false,
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        }
      ],
      backTime:10,
      distDist:20,
      hotspot:false,
      regionSearch: [], 
      regionSelected: [],
      observationsRegion: [],
      observationsMylocation:[],
      speciesSelected:[],
      dateSelected: 5,
      distSelected:10,
      mapSelected:true,
      mediaSelected:false,
      filterSearch:"",
      filterSearchOptions:[
        {text:'Common Name',value:'comName'},
        {text:'Latin Name',value:'sciName'},
        {text:'Region Code',value:'regionCode'},
        {text:'Location Name',value:'locName'},
        {text:'Observer Name',value:'userDisplayName'},
        ],
      filterSearchOptionsSelected:['comName'],
      showOverlay:false,
      assets:{
        logo: require('./assets/logo.svg'),
        ebird: require('./assets/ebird.svg'),
        iconPersonal: require('./assets/hotspot-icon_perso_small.png'),
        iconHotspot: require('./assets/hotspot-icon-hotspot.png'),
      }
    };
  },
  methods: {
    boundsUpdated (bounds) {
      this.bounds = bounds;
    },
    myLocation(){
      if (this.observationsMylocation.length>0){
        this.isMylocation = true; 
        return
      }
      if (this.location =="User denied Geolocation"){
        alert("Your location is not enabled in your broweser")
        return
      }
      if (this.location == null){
        var r = confirm("Issue with location. Try again?")
        if (r == true) {
          
          setTimeout(() => { this.myLocation(); }, 1000);
        }
        return
      }
        console.log(this.location)
        this.isMylocation = true; 
      this.showOverlay=true;
      this.$http.get('https://api.ebird.org/v2/data/obs/geo/recent/notable?lat='+this.location.latitude+'&lng='+this.location.longitude+'&detail=full&key=vcs68p4j67pt&back='+this.backTime+'&dist='+this.distDist+'&hotspot='+this.hotspot)
      .then(response => {
        this.observationsMylocation.push(...this.processObs(response.data));
        if (this.observationsMylocation.length>0){
          this.$refs.map.mapObject.fitBounds(this.observationsMylocation.map(m=>([m.lat, m.lng])))
        }
        this.showOverlay=false
        })
      
    },
    AddRegion(selectedOption){
      this.showOverlay=true;
      this.$http.get('https://api.ebird.org/v2/data/obs/'+selectedOption.code+'/recent/notable?detail=full&key=vcs68p4j67pt&back='+this.backTime+'&hotspot='+this.hotspot)
      .then(response => {
        this.observationsRegion.push(...this.processObs(response.data));
        if (this.observationsRegion.length>0){
          this.$refs.map.mapObject.fitBounds(this.observationsRegion.map(m=>([m.lat, m.lng])))
        }
        this.showOverlay=false
        
        })
    },
    removeRegion(removedOption){
      this.observationsRegion = this.observationsRegion.filter(e => (e.countryCode!=removedOption.code & e.subnational1Code!=removedOption.code) )
      if (this.observationsRegion.length>0){
          this.$refs.map.mapObject.fitBounds(this.observationsRegion.map(m=>([m.lat, m.lng])))
        }
    },
    processObs(obs){
        var id = obs.map(item => item.obsId);
        return obs.filter( (val,index) => id.indexOf(val.obsId) === index ).map(e => {
          if (this.location){
            e.distToMe = this.calcCrow(e.lat, e.lng, this.location.latitude, this.location.longitude)
          }
          e.daysAgo = moment().startOf('day').diff(moment(e.obsDt).startOf('day'), 'days');
          e.daysAgoFmt = e.daysAgo==0 ? "today" : (e.daysAgo==1 ? "yesterday" : e.daysAgo+" days ago")
          e.latLng = latLng(e.lat, e.lng)
          return e
          })
    },
    mouseOverListItem(markerID){
      this.$refs.markers.forEach(function(m){
        if (m.name==markerID){
          m.setVisible(true)   
        } else {
          m.setVisible(false)   
        }
      })
    },
    mouseOverListHeader(markerID){
      this.$refs.markers.forEach(function(m){
        if (m.name.includes(markerID)){
          m.setVisible(true)
        } else {
          m.setVisible(false)   
        }
      })
    },
    mouseOutList(){
      this.$refs.markers.forEach(function(m){
        m.setVisible(true)   
      })
    },
     calcCrow(lat1, lon1, lat2, lon2) {
       //This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
      var R = 6371; // km
      var dLat = this.toRad(lat2-lat1);
      var dLon = this.toRad(lon2-lon1);
      var lat1rad = this.toRad(lat1);
      var lat2rad = this.toRad(lat2);

      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1rad) * Math.cos(lat2rad); 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c;
      return d;
    },
    toRad(Value) {
      // Converts numeric degrees to radians
      return Value * Math.PI / 180;
    }
  },
  computed: {
    observationsFiltered : function(){
      var obsfiltered = this.isMylocation ? this.observationsMylocation : this.observationsRegion
      obsfiltered = obsfiltered.filter(x=> x.daysAgo <= this.dateSelected)
      if (this.isMylocation){
        obsfiltered = obsfiltered.filter(x=> x.distToMe<=this.distSelected)
      }
      if (this.mediaSelected){
        obsfiltered = obsfiltered.filter(x=> x.hasRichMedia)
      }
      if (this.hotspot){
        obsfiltered = obsfiltered.filter(x => !x.locationPrivate)
      }
      if (this.mapSelected){
        obsfiltered = obsfiltered.filter(x => this.bounds.contains(x.latLng))
      }
      obsfiltered =  obsfiltered.filter(o => this.filterSearchOptionsSelected.some(k => o[k].toLowerCase().includes(this.filterSearch.toLowerCase())));
      return obsfiltered.sort((a, b) => (a.daysAgo < b.daysAgo) ? 1 : -1).sort((a, b) => (a.comName > b.comName) ? 1 : -1);
    },
    speciesFiltered : function(){
      return this.observationsFiltered.reduce(function(r, i) {
        r[i.speciesCode] = r[i.speciesCode] || { obs:[], count:0, comName:i.comName, speciesCode:i.speciesCode};
        r[i.speciesCode].obs.push(i);
        r[i.speciesCode].count =r[i.speciesCode].count+1
        return r;
        }, {});
    },
  },
  mounted() {
    let uri = window.location.search.substring(1); 
    let params = new URLSearchParams(uri);
    this.dateSelected = params.get('back');
    this.distSelected = params.get('dist')
    this.$http.get('https://api.ebird.org/v2/ref/region/list/country/world?key=vcs68p4j67pt')
      .then(response => {
        response.data = response.data.filter(function( obj ) {
          return !["US","CA"].includes(obj.code)
        });
        this.regionSearch = [...this.regionSearch,...response.data ]
        this.$http.get('https://api.ebird.org/v2/ref/region/list/subnational1/US?key=vcs68p4j67pt')
          .then(response => {
        this.regionSearch = [...this.regionSearch,...response.data ];
            this.$http.get('https://api.ebird.org/v2/ref/region/list/subnational1/CA?key=vcs68p4j67pt')
      .then(response => {
        this.regionSearch = [...this.regionSearch,...response.data ].sort((a, b) => (a.name > b.name) ? 1 : -1);
        
              if (params.get('mylocation')){
      this.myLocation();
    } else {
            var temp = this.regionSearch.filter(x=>params.get('r')==x.code);
        if (temp.length>0){
          this.regionSelected=temp[0];
          this.AddRegion(temp[0]);

          }
        }
      })
          })
        })



  },
  created() {
    //do we support geolocation
    if("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(pos => {
        this.location = pos.coords;
      }, err => {
        this.location = err.message;
      })
    }
  }
};
</script>

<style lang="scss">
html, body{
  height: 100%;
  margin:0;
}
.cursor-pointer{
  cursor: pointer;
}
.hover-darken:hover{
  background-color:rgba(95, 95, 95, 0.1); 
}
.multiselect__tags{
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}
.multiselect__tag, .multiselect__option--highlight{
  background: #4ca800 !important;
}
/*.b-sidebar-footer{
  background-color: #212121;
}
*/
.bg-green > .btn{
  background-color: #4ca800 !important;
  border-color: #4ca800 !important;
}
</style>
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
