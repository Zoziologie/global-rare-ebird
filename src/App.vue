<template>
<b-container fluid class="h-100 d-flex flex-column">
  
  <b-row id="map-div" class="flex-grow-1">
    <l-map :bounds="boundsImg">
      <l-control-layers position="topright"></l-control-layers>
      <l-control position="topright" >
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
    </l-map>
    <b-sidebar id="sidebar-1" title="Global Rare eBird" shadow>
      <div class="px-3 py-2">
        <p>
          Cras mattis consectetur purus sit amet fermentum. Cras justo odio, dapibus ac facilisis
          in, egestas eget quam. Morbi leo risus, porta ac consectetur ac, vestibulum at eros.
        </p>
        
      </div>
    </b-sidebar>
  </b-row>
</b-container>
</template>

<script>
import { latLng } from "leaflet";
import { LMap, LTileLayer, LControlLayers } from "vue2-leaflet";
export default {
  components: {
    LMap,
    LTileLayer,
    LControlLayers
  },
  data() {
    return {
      zoom: 0,
      center: latLng(0, 0),
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
    };
  },
  methods: {
  },
  computed: {
  }
};
</script>

<style>
html, body{
  height: 100%;
  margin:0;
}
</style>