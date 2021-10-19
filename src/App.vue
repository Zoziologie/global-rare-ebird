<template>
<b-container fluid class="h-100 d-flex flex-column">
  
  <b-row id="map-div" class="flex-grow-1">
    <l-map :bounds="bounds" :options="{zoomControl: false}">
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
    </l-map>
    <b-sidebar id="sidebar-1" title="Global Rare eBird" shadow>
      <div class="px-3 py-2">
        <p>
          Cras mattis consectetur purus sit amet fermentum. Cras justo odio, dapibus ac facilisis
          in, egestas eget quam. Morbi leo risus, porta ac consectetur ac, vestibulum at eros.
        </p>
        <multiselect v-model="regionSelected" :options="regionSearch" :multiple="true" label="name" track-by="name" 
        placeholder="Select a region" :select-label="''" :deselect-label="''" 
        @remove="removeRegion" @select="AddRegion"></multiselect>
      </div>
    </b-sidebar>
  </b-row>
</b-container>
</template>

<script>
import { latLngBounds } from "leaflet";
import { LMap, LTileLayer, LControlLayers, LControl, LControlZoom } from "vue2-leaflet";
export default {
  components: {
    LMap,
    LTileLayer,
    LControlLayers,
    LControl,
    LControlZoom,
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
    };
  },
  methods: {
    AddRegion(selectedOption){
      this.$http.get('https://api.ebird.org/v2/data/obs/'+selectedOption.code+'/recent/notable?key=vcs68p4j67pt')
      .then(response => {
        this.observations.push(...response.data.map(e => {
          e.regionCode=selectedOption.code 
          return e
          }));
        })
    },
    removeRegion(removedOption){
      console.log(removedOption.code )
      console.log(this.observations.filter(e => e.regionCode!=removedOption.code ))
      this.observations = this.observations.filter(e => e.regionCode!=removedOption.code )
    }
  },
  computed: {
    observationsFiltered : function(){
      return this.observations
    }
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
