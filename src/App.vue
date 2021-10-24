<template>
<b-container fluid class="h-100 d-flex flex-column">
  
  <b-row class="flex-grow-1">
    
    <l-map :bounds="bounds" @update:bounds="boundsUpdated" :options="{zoomControl: false}" ref="map">
      <l-control-layers position="topright"></l-control-layers>
      <l-control position="topleft" >
        <b-button v-b-toggle.sidebar-1>Toggle Sidebar</b-button>
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
        <v-marker-cluster>
          <l-marker ref="markers" :name="obs.speciesCode+obs.subId" v-for="obs in observationsFiltered" :key="obs.speciesCode+obs.subId" :lat-lng="obs.latLng">
            <l-icon
              :popup-anchor="[0, -19]"
              :icon-anchor="[15, 19]"
              :icon-url="obs.locationPrivate ? assets.iconPersonal : assets.iconHotspot"
            />
            <l-popup>
              <b-card>
              <b-card-title>{{obs.howMany}} {{obs.comName}}</b-card-title>
              <b-card-sub-title class="mb-2">{{obs.sciName}}</b-card-sub-title>
              <b-card-text>
                <a v-bind:href="'https://ebird.org/checklist/'+obs.subId+'#'+obs.speciesCode" target="_blank">{{obs.locName}}</a>

                  <span v-if="obs.hasRichMedia==0">
                        <b-icon-camera-fill></b-icon-camera-fill>
                  </span>
                  <span v-if="obs.hasComments==0">
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
    </l-map>
    
    <b-sidebar id="sidebar-1" title="Global Rare eBird" visible shadow>
      <b-overlay :show="showOverlay" rounded="sm" >
      <div class="px-3 py-2">
        
          <b-input-group >
            <template #prepend>
              <b-input-group-text >
                <b-icon-globe></b-icon-globe>
              </b-input-group-text>
            </template>
           <multiselect v-model="regionSelected" :options="regionSearch" :multiple="true" label="name" track-by="name" 
        placeholder="Select a region " :select-label="''" :deselect-label="''" 
        @remove="removeRegion" @select="AddRegion" style="border-top-left-radius: 0;
    border-bottom-left-radius: 0;flex: 1 1;">
        </multiselect>
  </b-input-group>



         <label class="mt-2">Filter:</label>
        <b-form inline class="justify-content-between">
        <b-input-group append="days ago" class="mb-2 mr-sm-2 mb-sm-0">
        <b-form-input v-model="dateSelected" type="number" min="0" :max=backTime step="1"></b-form-input>
        </b-input-group>

        <!--b-form-checkbox v-model="mediaSelected"> only with media</b-form-checkbox>-->

  <b-input-group>
    <b-input-group-prepend is-text>
      <b-form-checkbox switch class="mr-n2" v-model="mapSelected">
        <span class="sr-only">Switch for following text input</span>
      </b-form-checkbox>
    </b-input-group-prepend>
                 <b-input-group-text >
                Sync with vie<b-icon-map class="cursor-pointer"></b-icon-map>
              </b-input-group-text>
    
  </b-input-group>

        <!--<multiselect v-model="speciesSelected" :options="speciesSearch" :multiple="true"
        placeholder="Select species" :select-label="''" :deselect-label="''"></multiselect>-->
        <b-input-group class="w-100" >
        <b-form-input v-model="filterSearch" type="search" placeholder="Search..."></b-form-input>
        <template #append>
        <b-dropdown>
          <template #button-content>
            <b-icon-gear></b-icon-gear>
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
                    <a v-bind:href="'https://ebird.org/checklist/'+obs.subId+'#'+obs.speciesCode" target="_blank">{{obs.locName}}</a>
                    <!--<b-icon-clock-history></b-icon-clock-history>{{obs.howMany}}<b-icon-geo-alt></b-icon-geo-alt>  -->
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
                  </div>
                  <span v-if="obs.hasRichMedia==0">
                        <b-icon-camera-fill></b-icon-camera-fill>
                  </span>
                  <span v-if="obs.hasComments==0">
                        <b-icon-chat-square-text-fill></b-icon-chat-square-text-fill>
                  </span>
                </b-list-group-item>
              </b-list-group>
            </b-collapse>
          </b-card>
        </div>
      </div>

    </b-overlay>
          <template #footer>
       <div class="d-flex bg-dark text-light align-items-center px-3 py-2">
       <a v-b-modal.modal-instruction> <b-icon-info></b-icon-info></a>
       <a href="https://github.com/Zoziologie/global-rare-ebird/" target="_blank"> <b-icon-github></b-icon-github></a>
       <a href="https://documenter.getpostman.com/view/664302/S1ENwy59" target="_blank"> <b-img :src=assets.ebird style="height: 16px;"></b-img></a>
       <a href="https://zoziologie.raphaelnussbaumer.com/" target="_blank"> made by <b-img :src=assets.logo style="height: 16px;"></b-img></a>
       </div>
      </template>
    </b-sidebar>
  </b-row>
  <b-modal id="modal-instruction" title="How to use the app?">
    <p class="my-4">Hello from modal!</p>
    <p>Query rare sightings per countries (or states for US and CA). Filter per date, location and species name.</p>
    How is it made?

    Report and issue?

    Get in touch?

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
import { LMap, LTileLayer, LControlLayers, LControl, LControlZoom, LMarker, LPopup, LIcon } from "vue2-leaflet";
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
    'v-marker-cluster': Vue2LeafletMarkerCluster
  },
  data() {
    return {
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
      regionSearch: [], 
      regionSelected: [],
      observations: [],
      speciesSelected:[],
      dateSelected: 5,
      mapSelected:true,
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
        logo: require('./assets/logo.png'),
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
    AddRegion(selectedOption){
      this.showOverlay=true;
      this.$http.get('https://api.ebird.org/v2/data/obs/'+selectedOption.code+'/recent/notable?detail=full&key=vcs68p4j67pt&back='+this.backTime)
      .then(response => {
        var observations = response.data
        var id = observations.map(item => item.obsId);
        observations = observations.filter( (val,index) => id.indexOf(val.obsId) === index )

        this.observations.push(...observations.map(e => {
          e.regionCode=selectedOption.code 
          e.daysAgo = moment().startOf('day').diff(moment(e.obsDt).startOf('day'), 'days');
          e.latLng = latLng(e.lat, e.lng)
          return e
          }));
        if (this.observations.length>0){
          this.$refs.map.mapObject.fitBounds(this.observations.map(m=>([m.lat, m.lng])))
        }
        this.showOverlay=false
        
        })
    },
    removeRegion(removedOption){
      this.observations = this.observations.filter(e => e.regionCode!=removedOption.code )
      if (this.observations.length>0){
          this.$refs.map.mapObject.fitBounds(this.observations.map(m=>([m.lat, m.lng])))
        }
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
    }
  },
  computed: {
    observationsFiltered : function(){
      var obsfiltered = this.observations
      /*if (this.speciesSearch.length>0){
        obsfiltered = obsfiltered.filter(x=> this.speciesSearch.includes(x.comName) )
      }*/
      obsfiltered = obsfiltered.filter(x=> x.daysAgo <= this.dateSelected)
      /*if (this.mediaSelected){
        obsfiltered = obsfiltered.filter(x=> x.hasRichMedia)
      }*/
      if (this.mapSelected){
        obsfiltered = obsfiltered.filter(x => this.bounds.contains(x.latLng))
      }
      obsfiltered =  obsfiltered.filter(o => this.filterSearchOptionsSelected.some(k => o[k].toLowerCase().includes(this.filterSearch.toLowerCase())));
      return obsfiltered.sort((a, b) => (a.comName > b.comName) ? 1 : -1);
    },
    /*speciesSearch : function(){
      return [...new Set(this.observations.map(x=>x.comName))].sort()
    },*/
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
    this.$http.get('https://api.ebird.org/v2/ref/region/list/country/world?key=vcs68p4j67pt')
      .then(response => {
        response.data = response.data.filter(function( obj ) {
          return !["US","CA"].includes(obj.code)
        });
        this.regionSearch = [...this.regionSearch,...response.data ].sort((a, b) => (a.name > b.name) ? 1 : -1);
        })

    this.$http.get('https://api.ebird.org/v2/ref/region/list/subnational1/US?key=vcs68p4j67pt')
      .then(response => {
        this.regionSearch = [...this.regionSearch,...response.data ].sort((a, b) => (a.name > b.name) ? 1 : -1);
      })
    this.$http.get('https://api.ebird.org/v2/ref/region/list/subnational1/CA?key=vcs68p4j67pt')
      .then(response => {
        this.regionSearch = [...this.regionSearch,...response.data ].sort((a, b) => (a.name > b.name) ? 1 : -1);
      })
  },
  created() {
    //do we support geolocation
    if("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(pos => {
        this.location = pos;
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
</style>
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
