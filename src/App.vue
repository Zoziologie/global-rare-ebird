<template>
<b-container fluid class="h-100 d-flex flex-column">
  <b-row id="map-div" class="flex-grow-1">
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
          <l-marker v-for="obs in observationsFiltered" :key="obs.speciesCode+obs.subId" :lat-lng="obs.latLng" ></l-marker>
        </v-marker-cluster>
    </l-map>
    <b-sidebar id="sidebar-1" title="Global Rare eBird" shadow>
      <div class="px-3 py-2">
        <p>
          Query rare sightings per countries (or states for US and CA). Filter per date, location and species name.</p>

        
        <label>Select countries or states:</label>
        <multiselect v-model="regionSelected" :options="regionSearch" :multiple="true" label="name" track-by="name" 
        placeholder="Select a region" :select-label="''" :deselect-label="''" 
        @remove="removeRegion" @select="AddRegion"></multiselect>


         <label class="mt-2">Filter:</label>

        <b-input-group append="days ago" class="mb-2 mr-sm-2 mb-sm-0">
        <b-form-input v-model="dateSelected" type="number" min="0" max="15" step="1"></b-form-input>
        </b-input-group>

        <!--b-form-checkbox v-model="mediaSelected"> only with media</b-form-checkbox>-->

        <b-form-group class="m-2">
          <b-form-checkbox-group>
          <b-form-checkbox switch v-model="mapSelected"> only on map</b-form-checkbox>
          </b-form-checkbox-group>
        </b-form-group>

        <!--<multiselect v-model="speciesSelected" :options="speciesSearch" :multiple="true"
        placeholder="Select species" :select-label="''" :deselect-label="''"></multiselect>-->
        <b-input-group>
        <b-form-input v-model="filterSearch" type="search" placeholder="Filter by species, locations, observers"></b-form-input>
<template #append>
        <b-dropdown>
          <template #button-content>
            <b-icon-gear></b-icon-gear>
          </template>
            <b-form-group label="Using options array:" v-slot="{ ariaDescribedby }">
              <b-form-checkbox-group
                v-model="filterSearchOptionsSelected"
                :options="filterSearchOptions"
                :aria-describedby="ariaDescribedby"
              ></b-form-checkbox-group>
            </b-form-group>
        </b-dropdown>
        </template>
        </b-input-group>

        <div class="accordion" role="tablist">
          <b-card no-body class="mb-1" v-for="spe in speciesFiltered" :key="spe.speciesCode" >
            <b-card-header header-tag="header" role="tab" v-b-toggle="'accordion-'+spe.speciesCode" class="p-1 d-flex justify-content-between align-items-center">
              {{spe.comName}}
              <b-badge pill style="background-color: #343a40;">{{spe.count}}</b-badge>
            </b-card-header>
            <b-collapse v-bind:id="'accordion-'+spe.speciesCode" accordion="my-accordion" role="tabpanel">
              <!--<b-card-body>
                <b-card-text>I start opened because <code>visible</code> is <code>true</code></b-card-text>
              </b-card-body>-->
              <b-list-group>
                <b-list-group-item v-for="obs in spe.obs" :key="obs.subId">
                  <b-icon-clock-history></b-icon-clock-history>{{obs.howMany}}
                  
                  
                  <b-icon-clock-history></b-icon-clock-history> 
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
                  <br>
                  <b-icon-geo-alt></b-icon-geo-alt>  <a v-bind:href="'https://ebird.org/checklist/'+obs.subId+'#'+obs.speciesCode" target="_blank">{{obs.locName}}</a>
                </b-list-group-item>
              </b-list-group>
            </b-collapse>
          </b-card>
        </div>
      </div>
    </b-sidebar>
  </b-row>
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
import { LMap, LTileLayer, LControlLayers, LControl, LControlZoom, LMarker } from "vue2-leaflet";
import moment from 'moment';
import Vue2LeafletMarkerCluster from 'vue2-leaflet-markercluster'

import 'leaflet-defaulticon-compatibility';

export default {
  components: {
    LMap,
    LTileLayer,
    LControlLayers,
    LControl,
    LControlZoom,
    LMarker,
    'v-marker-cluster': Vue2LeafletMarkerCluster
  },
  data() {
    return {
      bounds:latLngBounds([
        [0, 10],
        [0,20]
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
      regionSearch: [], 
      regionSelected:[],
      observations:[],
      speciesSelected:[],
      dateSelected: 5,
      mediaSelected: false,
      mapSelected:true,
      filterSearch:"",
      filterSearchOptions:[
        {text:'Common Name',value:'comName'},
        {text:'Latin Name',value:'sciName'},
        {text:'Region Code',value:'regionCode'},
        {text:'Location Name',value:'locName'},
        ],
      filterSearchOptionsSelected:['comName']
    };
  },
  methods: {
    boundsUpdated (bounds) {
      this.bounds = bounds;
    },
    AddRegion(selectedOption){
      this.$http.get('https://api.ebird.org/v2/data/obs/'+selectedOption.code+'/recent/notable?key=vcs68p4j67pt')
      .then(response => {
        this.observations.push(...response.data.map(e => {
          e.regionCode=selectedOption.code 
          e.daysAgo = moment().startOf('day').diff(moment(e.obsDt).startOf('day'), 'days');
          e.latLng = latLng(e.lat, e.lng)
          return e
          }));
        this.$refs.map.mapObject.fitBounds(this.observations.map(m=>([m.lat, m.lng])))
        })
    },
    removeRegion(removedOption){
      this.observations = this.observations.filter(e => e.regionCode!=removedOption.code )
      this.$refs.map.mapObject.fitBounds(this.observations.map(m=>([m.lat, m.lng])))
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
      

      
      return obsfiltered
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
  }
};
</script>

<style lang="scss">
html, body{
  height: 100%;
  margin:0;
}
</style>
<style src="vue-multiselect/dist/vue-multiselect.min.css"></style>
