<template>
  <b-container fluid class="h-100 d-flex flex-column">
    <b-row class="flex-grow-1">
      <l-map
        :bounds="bounds"
        @update:bounds="boundsUpdated"
        :options="{ zoomControl: false, preferCanvas: true }"
        ref="map"
      >
        <l-control-layers position="topright"></l-control-layers>
        <l-control position="topleft">
          <b-button v-b-toggle.sidebar-1
            ><b-icon-layout-sidebar-inset></b-icon-layout-sidebar-inset
          ></b-button>
        </l-control>
        <l-tile-layer
          v-for="tileProvider in tileProviders"
          :key="tileProvider.name"
          :name="tileProvider.name"
          :visible="tileProvider.visible"
          :url="tileProvider.url"
          :attribution="tileProvider.attribution"
          layer-type="base"
        />
        <l-control-zoom position="bottomright"></l-control-zoom>
        <v-marker-cluster
          :options="{
            showCoverageOnHover: false,
            maxClusterRadius: 50,
            iconCreateFunction: iconCreateFunction,
          }"
        >
          <l-marker
            ref="markers"
            :options="{ count: loc.obs.length }"
            :name="loc.locId + loc.obs.map((x) => x.speciesCode).join('_')"
            v-for="loc in locationFiltered"
            :key="loc.locId"
            :lat-lng="loc.latLng"
            @click="clickMarker(loc)"
            :icon="getIcon(loc)"
          >
          </l-marker>
        </v-marker-cluster>

        <l-marker ref="marker" v-if="popup != false" :lat-lng="popup.latLng">
          <l-icon
            :popup-anchor="[0, -34]"
            :icon-anchor="[12.5, 34]"
            :icon-size="[25, 34]"
            :icon-url="hotspotIconEmpty"
          />
          <l-popup :options="{ width: 600 }">
            <div class="mb-2 d-flex justify-content-between align-items-center">
              <span>
                <a
                  v-bind:href="'https://ebird.org/hotspot/' + popup.locId"
                  target="_blank"
                  title="eBird hotspot"
                  v-if="!popup.locationPrivate"
                  >{{ popup.locName }}</a
                >
                <span v-else>{{ popup.locName }}</span>
              </span>
              <span>
                <a
                  v-bind:href="
                    'https://www.google.com/maps/search/?api=1&query=' +
                    popup.latLng.lat +
                    ',' +
                    popup.latLng.lng
                  "
                  target="_blank"
                  title="direction on google map"
                >
                  <font-awesome-icon icon="directions" class="ml-2" />
                </a>
              </span>
            </div>
            <div>
              <b-card
                no-body
                v-for="spe in popup.sp"
                :key="spe.speciesCode"
                class="mx-0 mb-1"
              >
                <b-card-header
                  class="p-1 d-flex justify-content-between align-items-center"
                >
                  <span>
                    {{ spe.comName }}
                    <b-badge
                      v-if="(spe.aba >= 3) & (spe.aba <= 6)"
                      :class="'ml-2 font-weight-normal bg-aba-' + spe.aba"
                      >ABA-{{ spe.aba }}</b-badge
                    >
                  </span>
                  <b-badge pill style="background-color: #343a40">{{
                    spe.obs.length
                  }}</b-badge>
                </b-card-header>
                <b-list-group flush class="mh-240">
                  <b-list-group-item
                    v-for="obs in spe.obs"
                    :key="obs.subId"
                    class="py-1 px-0 hover-darken"
                  >
                    <b-col class="d-flex w-100 justify-content-between">
                      <small>
                        <a
                          v-bind:href="
                            'https://ebird.org/checklist/' +
                            obs.subId +
                            '#' +
                            spe.speciesCode
                          "
                          target="_blank"
                        >
                          {{ daysAgoFmt(obs.daysAgo) }}
                          {{
                            new Date(obs.obsDt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          }}, {{ obs.howMany }} ind.
                        </a>
                      </small>
                      <span v-if="obs.hasRichMedia | obs.hasComments">
                        <span v-if="obs.hasRichMedia">
                          <small
                            ><b-icon-camera-fill
                              class="mr-1"
                              @click="addMedia(obs.obsId)"
                            ></b-icon-camera-fill
                          ></small>
                        </span>
                        <span v-if="obs.hasComments">
                          <small
                            ><b-icon-chat-square-text-fill></b-icon-chat-square-text-fill
                          ></small>
                        </span>
                      </span>
                    </b-col>
                  </b-list-group-item>
                </b-list-group>
              </b-card>
            </div>
          </l-popup>
        </l-marker>

        <l-circle
          v-if="isMylocation & (location != null)"
          :lat-lng="[location.latitude, location.longitude]"
          :radius="distSelected * 1000"
          color="#4ca800"
          :fillOpacity="0"
        />
        <l-circle-marker
          v-if="isMylocation & (location != null)"
          :lat-lng="[location.latitude, location.longitude]"
          :radius="8"
          color="white"
          fillColor="#4ca800"
          :fillOpacity="1"
        />
      </l-map>

      <b-sidebar id="sidebar-1" title="Global Rare eBird" visible shadow>
        <b-overlay :show="showOverlay" rounded="sm">
          <div class="px-3 py-2">
            <b-form>
              <b-form-group>
                <b-input-group>
                  <template #prepend>
                    <b-dropdown class="bg-green">
                      <template #button-content>
                        <b-icon-globe
                          font-scale="1"
                          v-if="!isMylocation"
                        ></b-icon-globe>
                        <b-icon-geo-alt
                          font-scale="1"
                          v-if="isMylocation"
                        ></b-icon-geo-alt>
                      </template>
                      <b-dropdown-item @click="isMylocation = false"
                        ><b-icon-globe class="mr-2"></b-icon-globe>
                        Countries</b-dropdown-item
                      >
                      <b-dropdown-divider></b-dropdown-divider>
                      <b-dropdown-item @click="myLocation()"
                        ><b-icon-geo-alt class="mr-2"></b-icon-geo-alt> My
                        location</b-dropdown-item
                      >
                    </b-dropdown>
                  </template>

                  <multiselect
                    v-model="regionSelected"
                    :options="regionSearchFiltered"
                    :multiple="true"
                    :custom-label="customLabel"
                    @search-change="asyncFind"
                    :internal-search="false"
                    track-by="name"
                    placeholder="Select a region "
                    :select-label="''"
                    :deselect-label="''"
                    @remove="removeRegion"
                    @select="addRegion"
                    style="flex: 1 1"
                    v-if="!isMylocation"
                  >
                    <template slot="option" slot-scope="props">
                      {{ props.option.name }}
                      <small>{{ props.option.code }}</small>
                    </template>
                  </multiselect>
                  <b-form-input
                    v-model="distSelected"
                    type="number"
                    min="0"
                    :max="distMax"
                    step="1"
                    v-if="isMylocation"
                    :debounce="debounce_time"
                    :state="
                      (distSelected <= distMax) & (distSelected >= 0)
                        ? null
                        : false
                    "
                  ></b-form-input>
                  <b-input-group-append is-text v-if="isMylocation">
                    km away
                  </b-input-group-append>
                </b-input-group>
              </b-form-group>

              <b-form-group>
                <b-input-group append="days ago">
                  <!--<b-input-group :append="backSelected == 0 ? 'today' : backSelected == 1 ? 'yesterday' : 'days ago'">-->
                  <b-input-group-prepend is-text>
                    <b-icon-calendar-date class="mx-2"></b-icon-calendar-date>
                  </b-input-group-prepend>
                  <b-form-input
                    v-model="backSelected"
                    type="number"
                    min="0"
                    :max="backMax"
                    step="1"
                    :debounce="debounce_time"
                    :state="
                      (parseInt(backSelected) <= parseInt(backMax)) &
                      (parseInt(backSelected) >= 0)
                        ? null
                        : false
                    "
                    aria-describedby="input-backSelected"
                  ></b-form-input>
                </b-input-group>
                <p
                  class="text-danger mb-0"
                  v-if="
                    (parseInt(backSelected) > parseInt(backMax)) &
                    (parseInt(backMax) != 30)
                  "
                >
                  <small
                    @click="reload(Math.min(backSelected, 30))"
                    style="cursor: pointer"
                    >Update max duration to
                    {{ Math.min(backSelected, 30) }}</small
                  >
                </p>
              </b-form-group>

              <b-form-group>
                <b-input-group>
                  <template #prepend>
                    <b-dropdown class="bg-green">
                      <template #button-content>
                        <b-icon-filter font-scale="1"></b-icon-filter>
                      </template>
                      <b-form-group
                        label="Search by:"
                        v-slot="{ ariaDescribedby }"
                        class="px-2 mb-0 small"
                      >
                        <b-form-checkbox-group
                          v-model="filterSearchOptionsSelected"
                          :options="filterSearchOptions"
                          :aria-describedby="ariaDescribedby"
                        ></b-form-checkbox-group>
                      </b-form-group>
                      <b-form-group
                        label="Sort by:"
                        v-slot="{ ariaDescribedby }"
                        class="px-2 mb-0 small"
                      >
                        <b-form-radio
                          v-model="filterSortOptionsSelected"
                          :aria-describedby="ariaDescribedby"
                          v-for="opt in filterSortOptions"
                          :key="opt.name"
                          :value="opt.value"
                        >
                          {{ opt.text }}
                        </b-form-radio>
                      </b-form-group>
                    </b-dropdown>
                  </template>
                  <b-form-input
                    v-model="filterSearch"
                    type="search"
                    placeholder="Search..."
                    :debounce="debounce_time"
                  ></b-form-input>
                  <template #append v-if="isaba">
                    <b-dropdown>
                      <template #button-content>
                        <small>ABA-{{ aba_limit }}</small>
                      </template>
                      <b-dropdown-text>
                        <b-form-spinbutton
                          v-model="aba_limit"
                          inline
                          size="sm"
                          min="1"
                          max="6"
                        ></b-form-spinbutton>
                      </b-dropdown-text>
                    </b-dropdown>
                  </template>
                </b-input-group>
              </b-form-group>
            </b-form>
            <label class="mt-2" v-if="speciesFiltered.length > 0"
              >Sightings:</label
            >
            <div class="accordion" role="tablist">
              <template v-for="(spe, spe_index) in speciesFiltered">
                <b-card
                  no-body
                  class="mb-1"
                  v-if="spe_index <= spe_index_max"
                  :key="spe.speciesCode"
                >
                  <b-card-header
                    header-tag="header"
                    role="tab"
                    v-b-toggle="'accordion-' + spe.speciesCode"
                    class="p-1 d-flex justify-content-between align-items-center cursor-pointer"
                    @mouseover="mouseHoverList(spe.speciesCode)"
                    @mouseout="mouseOutList"
                  >
                    <span>
                      {{ spe.comName }}

                      <b-badge
                        v-if="(spe.aba >= 3) & (spe.aba <= 6)"
                        :class="'mr-1 font-weight-normal bg-aba-' + spe.aba"
                        >ABA-{{ spe.aba }}</b-badge
                      >
                    </span>
                    <b-badge pill style="background-color: #343a40">{{
                      spe.count
                    }}</b-badge>
                  </b-card-header>
                  <b-collapse
                    v-bind:id="'accordion-' + spe.speciesCode"
                    accordion="my-accordion"
                    role="tabpanel"
                  >
                    <!--<b-card-body>
                <b-card-text>I start opened because <code>visible</code> is <code>true</code></b-card-text>
              </b-card-body>-->
                    <b-list-group>
                      <b-list-group-item
                        v-for="loc in spe.loc"
                        :key="spe.speciesCode + loc.locId"
                        class="py-2 px-2 hover-darken"
                        @mouseover="mouseHoverList(loc.locId)"
                        @mouseout="mouseOutList"
                      >
                        <div class="d-flex w-100 justify-content-between">
                          <a
                            v-bind:href="
                              'https://ebird.org/hotspot/' + loc.locId
                            "
                            target="_blank"
                            title="eBird hotspot"
                            v-if="!loc.locationPrivate"
                            >{{ loc.locName }}</a
                          >
                          <span v-else>{{ loc.locName }}</span>
                          <span style="flex: none">
                            <a
                              v-bind:href="
                                'https://www.google.com/maps/search/?api=1&query=' +
                                loc.latLng.lat +
                                ',' +
                                loc.latLng.lng
                              "
                              target="_blank"
                              title="direction on google map"
                            >
                              <font-awesome-icon icon="directions" />
                            </a>
                          </span>
                        </div>
                        <div
                          v-for="obs in loc.obs"
                          :key="obs.subId"
                          class="d-flex w-100 justify-content-between"
                        >
                          <a
                            v-bind:href="
                              'https://ebird.org/checklist/' +
                              obs.subId +
                              '#' +
                              obs.speciesCode
                            "
                            target="_blank"
                            title="eBird checklist"
                            class="mr-1"
                          >
                            <small
                              >{{ daysAgoFmt(obs.daysAgo) }}
                              {{
                                new Date(obs.obsDt).toLocaleTimeString(
                                  undefined,
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              }}, {{ obs.howMany }} ind.</small
                            >
                          </a>
                          <span v-if="obs.hasRichMedia | obs.hasComments">
                            <span v-if="obs.hasRichMedia & !obs.media">
                              <small
                                ><b-icon-camera-fill
                                  class="mr-1"
                                  @click="addMedia(obs.obsId)"
                                ></b-icon-camera-fill
                              ></small>
                            </span>
                            <b-img
                              v-if="obs.media"
                              :src="
                                'https://cdn.download.ams.birds.cornell.edu/api/v1/asset/' +
                                obs.media +
                                '/320'
                              "
                            ></b-img>
                            <span v-if="obs.hasComments">
                              <small
                                ><b-icon-chat-square-text-fill></b-icon-chat-square-text-fill
                              ></small>
                            </span>
                          </span>
                        </div>
                      </b-list-group-item>
                    </b-list-group>
                  </b-collapse>
                </b-card>
              </template>
            </div>
            <div v-if="Object.keys(speciesFiltered).length > spe_index_max">
              <b-button @click="spe_index_max = 100000" block variant="light"
                >See
                {{ Object.keys(speciesFiltered).length - spe_index_max }} more
                species</b-button
              >
            </div>
          </div>
        </b-overlay>
        <template #footer>
          <div
            class="d-flex bg-dark text-light align-items-center px-3 py-2 w-100 justify-content-between"
          >
            <a v-b-modal.modal-instruction title="instruction/setting">
              <b-icon-gear-fill></b-icon-gear-fill
            ></a>
            <a
              href="https://github.com/Zoziologie/global-rare-ebird/"
              target="_blank"
              title="github"
            >
              <b-icon-github style="color: white"></b-icon-github
            ></a>
            <b-icon-link
              id="link-btn"
              style="color: white"
              @click="copyLink"
            ></b-icon-link>
            <b-tooltip target="link-btn" triggers="click">{{
              copy_status
            }}</b-tooltip>
            <a
              href="https://documenter.getpostman.com/view/664302/S1ENwy59"
              target="_blank"
            >
              <b-img :src="ebirdLogo" style="height: 16px"></b-img
            ></a>
            <a
              href="https://zoziologie.raphaelnussbaumer.com/"
              target="_blank"
              title="zoziologie.com"
              ><b-img :src="logo" class="zozio"></b-img
            ></a>
          </div>
        </template>
      </b-sidebar>
    </b-row>
    <b-modal id="modal-instruction" size="lg">
      <h2>Instruction</h2>
      <p>
        Query rare sightings per countries (or states for US and CA). Filter per
        date, location and species name.
      </p>
      How is it made? Report and issue?

      <h2>Bookmark</h2>
      You can create a bookmark and share a link using the following URL
      ?r=CH&back=4&mylocation=1&dist=20

      <h2>Setting</h2>
      <b-form-group>
        <b-form-checkbox v-model="mapSelected">
          Syncronize the observation list with the map view.</b-form-checkbox
        >
      </b-form-group>
      <p>
        The following settings affect the query to the eBird API.
        <a
          href="https://documenter.getpostman.com/view/664302/S1ENwy59#397b9b8c-4ab9-4136-baae-3ffa4e5b26e4"
          >See the eBird API documentation for more information</a
        >. You might have to refresh the page/reload the data to be in effect.
        Note that longer distance and duration can affect the performance of the
        website.
      </p>
      <b-form-group>
        <b-form-checkbox v-model="detailSelected">
          fetch information on media and comments</b-form-checkbox
        >
        <b-form-checkbox v-model="mediaSelected">
          fetch only observations with media</b-form-checkbox
        >
        <b-form-checkbox v-model="hotspotSelected">
          fetch only observations made at a hotspot</b-form-checkbox
        >
      </b-form-group>
      <b-form-group
        label="The search radius from your location, in kilometers (max 50)"
      >
        <b-form-input
          v-model="distMax"
          type="number"
          min="0"
          max="50"
          step="1"
        ></b-form-input>
      </b-form-group>
      <b-form-group
        label="The number of days back to fetch observations (max 30)"
      >
        <b-form-input
          v-model="backMax"
          id="backMax"
          type="number"
          min="0"
          max="30"
          step="1"
        ></b-form-input>
      </b-form-group>
    </b-modal>
  </b-container>
</template>

<script>
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue/dist/bootstrap-vue.css";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import "vue-multiselect/dist/vue-multiselect.min.css";

import "./style.scss";

import { latLngBounds, latLng } from "leaflet";
import {
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
} from "vue2-leaflet";
import moment from "moment";
import Vue2LeafletMarkerCluster from "vue2-leaflet-markercluster";

import ebirdLogo from "./assets/ebird_e_w.svg";
import hotspotIconPerso from "./assets/hotspot-icon_perso_small.png";
import hotspotIconHotspot from "./assets/hotspot-icon-hotspot.png";
import hotspotIconEmpty from "./assets/hotspot-icon_empty.png";
import logo from "./assets/logo.svg";

import taxo from "./assets/taxo.json";

import axios from "axios";

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
    "v-marker-cluster": Vue2LeafletMarkerCluster,
  },
  data() {
    return {
      logo: logo,
      ebirdLogo: ebirdLogo,
      hotspotIconHotspot: hotspotIconHotspot,
      hotspotIconPerso: hotspotIconPerso,
      hotspotIconEmpty: hotspotIconEmpty,
      isMylocation: true,
      location: null,
      bounds: latLngBounds([
        [90, 180],
        [-90, -180],
      ]),
      tileProviders: [
        {
          name: "Mapbox.Streets",
          visible: true,
          url: "https://api.mapbox.com/styles/v1/mapbox/streets-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoicmFmbnVzcyIsImEiOiIzMVE1dnc0In0.3FNMKIlQ_afYktqki-6m0g",
          attribution: "",
        },
        {
          name: "Mapbox.Satellite",
          visible: false,
          url: "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoicmFmbnVzcyIsImEiOiIzMVE1dnc0In0.3FNMKIlQ_afYktqki-6m0g",
          attribution: "",
        },
        {
          name: "OpenStreetMap",
          visible: false,
          attribution:
            '&copy; <a target="_blank" href="http://osm.org/copyright">OpenStreetMap</a> contributors',
          url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        },
        {
          name: "Esri.WorldImagery",
          visible: false,
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          attribution:
            "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        },
      ],
      debounce_time: 200,
      backMax: 3,
      distMax: 50,
      regionSearch: [],
      regionSearchFiltered: [],
      regionSelected: [],
      observationsRegion: [],
      observationsMylocation: [],
      speciesSelected: [],
      backSelected: 1,
      distSelected: 50,
      mapSelected: true,
      mediaSelected: false,
      hotspotSelected: false,
      detailSelected: false,
      filterSearch: "",
      filterSearchOptions: [
        { text: "Common name", value: "comName" },
        { text: "Scientific name", value: "sciName" },
        //{ text: "Region Code", value: "regionCode" },
        { text: "Location name", value: "locName" },
        //{ text: "Observer Name", value: "userDisplayName" },
      ],
      filterSearchOptionsSelected: ["comName", "sciName", "locName"],
      filterSortOptions: [
        { text: "Taxonomic order", value: "tax" },
        { text: "Common name", value: "comName" },
        { text: "Date", value: "daysAgo" },
        //{ text: "Scientific name", value: "sciName" },
      ],
      filterSortOptionsSelected: "tax",
      showOverlay: false,
      popup: false,
      aba_limit: 1,
      spe_index_max: 50,
      copy_status: "...",
    };
  },
  methods: {
    boundsUpdated(bounds) {
      this.bounds = bounds;
    },
    myLocation(attempt) {
      if (this.location == "User denied Geolocation") {
        alert("Your location is not enabled in your broweser");
        return;
      } else {
        if (this.location == null) {
          setTimeout(() => {
            console.log("Searching for location... attempt " + attempt);
            this.myLocation(attempt + 1);
          }, 1000 * attempt);

          /*if (this.location == null){
        var r = confirm("Issue with location. Try again?")
        if (r == true) {
          setTimeout(() => { this.myLocation(); }, 1000);
        }
        return
      }*/
          return;
        } else {
          console.log("Location found: " + this.location);
          this.isMylocation = true;
          this.showOverlay = true;
          axios
            .get(
              "https://api.ebird.org/v2/data/obs/geo/recent/notable?lat=" +
                this.location.latitude +
                "&lng=" +
                this.location.longitude +
                "&key=vcs68p4j67pt&detail=" +
                (this.detailSelected ? "full" : "simple") +
                "&back=" +
                this.backMax +
                "&dist=" +
                this.distMax +
                "&hotspot=" +
                this.hotspotSelected
            )
            .then((response) => {
              this.observationsMylocation = [
                ...this.processObs(response.data, "mylocation"),
              ];
              if (this.observationsMylocation.length > 0) {
                this.$refs.map.mapObject.fitBounds(
                  this.observationsMylocation.map((m) => m.latLng)
                );
              }
              this.showOverlay = false;
              this.updateURL();
            });
        }
      }
    },
    addRegion(selectedOption) {
      this.showOverlay = true;
      axios
        .get(
          "https://api.ebird.org/v2/data/obs/" +
            selectedOption.code +
            "/recent/notable?key=vcs68p4j67pt&detail=" +
            (this.detailSelected ? "full" : "simple") +
            "&back=" +
            this.backMax +
            "&hotspot=" +
            this.hotspotSelected
        )
        .then((response) => {
          this.observationsRegion.push(
            ...this.processObs(response.data, selectedOption.code)
          );
          if (this.observationsRegion.length > 0) {
            this.$refs.map.mapObject.fitBounds(
              this.observationsRegion.map((m) => m.latLng)
            );
          }
          this.showOverlay = false;
          this.updateURL();
        });
    },
    removeRegion(removedOption) {
      this.observationsRegion = this.observationsRegion.filter(
        (e) => e.regionCode != removedOption.code
      );
      if (this.observationsRegion.length > 0) {
        this.$refs.map.mapObject.fitBounds(
          this.observationsRegion.map((m) => [m.lat, m.lng])
        );
      }
      this.updateURL();
    },
    processObs(obs, regionCode) {
      // This filtering is due when using detail=full in api. Maybe because of adding comments/media later? Need to check, but it would be then worth filtering more
      var id = obs.map((item) => item.speciesCode + item.subId);
      obs = obs.filter(
        (val, index) => id.indexOf(val.speciesCode + val.subId) === index
      );
      let USCA = regionCode.includes("US") | regionCode.includes("CA");
      this.aba_limit =
        (regionCode == "US") | (regionCode == "CA") ? 3 : this.aba_limit;
      obs = obs.map((e) => {
        let o = {};
        o.regionCode = regionCode;
        o.comName = e.comName;
        o.sciName = e.sciName;
        o.speciesCode = e.speciesCode;
        o.howMany = e.howMany ? e.howMany : "x";
        o.locId = e.locId;
        o.subId = e.subId;
        o.locName = e.locName;
        o.locationPrivate = e.locationPrivate;
        o.obsDt = e.obsDt;
        o.daysAgo = moment()
          .startOf("day")
          .diff(moment(e.obsDt).startOf("day"), "days");
        o.latLng = latLng(e.lat, e.lng);

        // Following only present with detail=full in url but we found a way arround for all of them
        o.obsId = e.obsId;
        //o.userDisplayName = "userDisplayName" in e ? e.userDisplayName : "";
        //o.subnational1Code = e.subnational1Code;
        //o.countryCode = e.countryCode;
        o.hasComments = e.hasComments;
        o.hasRichMedia = e.hasRichMedia;

        if (this.location) {
          o.distToMe = this.calcCrow(
            e.lat,
            e.lng,
            this.location.latitude,
            this.location.longitude
          );
        }
        let tmp = taxo.find((e) => e.cod === o.speciesCode);
        o.aba = tmp ? (USCA ? tmp.aba : 10) : 1;
        o.cat = tmp ? tmp.cat : "unknown";
        o.tax = tmp ? tmp.tax : 9999;

        /*.map((o) => {
          axios
        .get(
          "https://ebird.org/obsservice/comment?obsId=" + o.obsId
        )
        .then((response) => {
          console.log(response.data)
          o.comment = response.data
        });
        return o;
        })*/

        return o;
      });
      return obs;
    },
    reload(newBack) {
      this.backMax = newBack;
      this.back = newBack;
      this.regionSelected.forEach((x) => this.removeRegion(x));
      this.regionSelected.forEach((x) => this.addRegion(x));
    },
    mouseHoverList(markerID) {
      this.$refs.markers.forEach(function (m) {
        if (m.name.includes(markerID)) {
          m.setVisible(true);
        } else {
          m.setVisible(false);
        }
      });
    },
    mouseOutList() {
      this.$refs.markers.forEach(function (m) {
        m.setVisible(true);
      });
    },
    calcCrow(lat1, lon1, lat2, lon2) {
      //This function takes in latitude and longitude of two location and returns the distance between them as the crow flies (in km)
      var R = 6371; // km
      var dLat = this.toRad(lat2 - lat1);
      var dLon = this.toRad(lon2 - lon1);
      var lat1rad = this.toRad(lat1);
      var lat2rad = this.toRad(lat2);

      var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) *
          Math.sin(dLon / 2) *
          Math.cos(lat1rad) *
          Math.cos(lat2rad);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      var d = R * c;
      return d;
    },
    toRad(Value) {
      // Converts numeric degrees to radians
      return (Value * Math.PI) / 180;
    },
    async copyLink() {
      this.copy_status = "...";
      let str =
        "https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/?" +
        this.linkUrl;
      try {
        await navigator.clipboard.writeText(str);
        this.copy_status = "Copied url to clipboard!";
      } catch ($e) {
        this.copy_status = "Cannot copy url to clipboard!";
      }
    },
    clickMarker(loc) {
      loc.sp = loc.obs.reduce(function (r, i) {
        r[i.speciesCode] = r[i.speciesCode] || {
          obs: [],
          comName: i.comName,
          speciesCode: i.speciesCode,
          aba: i.aba,
        };
        r[i.speciesCode].obs.push(i);
        return r;
      }, {});
      this.popup = loc;
      setTimeout(() => this.$refs.marker.mapObject.openPopup(), 100);
    },
    customLabel({ name, code }) {
      if (this.regionSelected.length > 1) {
        return `${code}`;
      } else {
        return `${name}`;
      }
    },
    asyncFind(query) {
      this.regionSearchFiltered = this.regionSearch.filter((o) =>
        Object.keys(o).some((k) =>
          o[k].toLowerCase().includes(query.toLowerCase())
        )
      );
    },
    updateURL() {
      history.replaceState(null, null, "?" + this.linkUrl);
    },
    daysAgoFmt(daysAgo) {
      return daysAgo == 0
        ? "Today"
        : daysAgo == 1
        ? "Yesterday"
        : daysAgo + " days ago";
    },
    addMedia(obsId) {
      const index = this.observationsRegion.findIndex((x) => {
        return x.obsId === obsId;
      });
      axios
        .get("https://ebird.org/obsservice/media?obsId=" + obsId)
        .then((response) => {
          this.observationsRegion[index].media = response.assetId;
        });
    },
    getIcon(loc) {
      return L.divIcon({
        className: "my-custom-icon",
        popupAnchor: [0, -34],
        iconAnchor: [12.5, 34],
        iconSize: [25, 34],
        html: `
        <?xml version="1.0" encoding="UTF-8"?><svg id="Layer_1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24.66 33.31"><defs><style>.cls-1,.cls-2{fill:#fff;}#cls-${
          loc.locId
        }{fill:${
          loc.locationPrivate ? "#5286bf" : "#ED7A25"
        };}.cls-2{font-family:ArialMT, Arial;font-size:14.2px; fill:#fff;}</style></defs><g><path id="cls-${
          loc.locId
        }" d="M12.35,32.81c-.32,0-.8-.11-1.27-.66-2.97-3.44-5.33-6.7-7.21-9.96-1.43-2.49-2.36-4.61-2.91-6.66C.01,12.01,.54,8.71,2.52,5.74,4.22,3.21,6.6,1.55,9.6,.83c.42-.1,.86-.17,1.29-.23,.19-.03,.38-.06,.57-.09h1.67c.27,.03,.46,.06,.65,.09,.43,.06,.87,.13,1.29,.23,3.35,.83,5.92,2.79,7.64,5.83,.84,1.5,1.33,3.18,1.43,5.01,.15,2.57-.65,4.85-1.36,6.55-1.22,2.91-2.94,5.85-5.26,8.98-1.01,1.36-2.09,2.69-3.14,3.98l-.78,.97c-.45,.56-.93,.68-1.25,.68Z"/><path class="cls-1" d="M13.13,1c.61,.1,1.23,.17,1.83,.32,3.25,.8,5.69,2.69,7.32,5.59,.83,1.48,1.27,3.09,1.37,4.79,.13,2.23-.48,4.31-1.32,6.33-1.33,3.19-3.15,6.11-5.2,8.87-1.25,1.68-2.59,3.3-3.91,4.93-.27,.33-.57,.49-.87,.49s-.61-.16-.89-.49c-2.67-3.09-5.11-6.34-7.15-9.88-1.19-2.07-2.24-4.22-2.86-6.54-.9-3.35-.43-6.5,1.5-9.38,1.63-2.44,3.91-4.01,6.78-4.7,.6-.14,1.22-.21,1.83-.32h1.59m.08-1h-1.84c-.19,.05-.37,.07-.56,.1-.43,.07-.88,.13-1.33,.24C6.35,1.1,3.87,2.82,2.11,5.46,.04,8.56-.51,11.99,.48,15.66c.56,2.09,1.5,4.25,2.96,6.78,1.89,3.29,4.27,6.57,7.26,10.03,.6,.69,1.23,.84,1.65,.84,.61,0,1.19-.31,1.64-.86l.79-.97c1.05-1.29,2.13-2.62,3.15-3.99,2.35-3.16,4.09-6.13,5.32-9.08,.73-1.75,1.55-4.1,1.4-6.77-.11-1.9-.61-3.66-1.5-5.22-1.78-3.16-4.46-5.21-7.95-6.07-.45-.11-.9-.18-1.34-.24-.19-.03-.37-.06-.56-.09h-.08Z"/></g><text class="cls-2" transform="translate(${
          loc.obs.length > 9 ? "4.44" : "8.39"
        } 18.5)"><tspan x="0" y="0">${loc.obs.length}</tspan></text></svg>`,
      });
    },
    iconCreateFunction: function (cluster) {
      var childCount = cluster
        .getAllChildMarkers()
        .reduce((acc, x) => acc + x.options.count, 0);
      var c = " marker-cluster-";
      if (childCount < 10) {
        c += "small";
      } else if (childCount < 100) {
        c += "medium";
      } else {
        c += "large";
      }

      return new L.DivIcon({
        html: "<div><span>" + childCount + "</span></div>",
        className: "marker-cluster" + c,
        iconSize: new L.Point(40, 40),
      });
    },
  },
  computed: {
    linkUrl: function () {
      let qp = new URLSearchParams();
      if (this.isMylocation !== "")
        qp.set("mode", this.isMylocation ? "n" : "r");
      if (!this.isMylocation) {
        if (this.regionSelected.length > 0)
          qp.set("r", this.regionSelected.map((x) => x.code).join("_"));
      } else {
        if (this.distSelected !== "") qp.set("d", this.distSelected);
      }
      if (this.backSelected !== "") qp.set("t", this.backSelected);
      if (this.detailSelected) qp.set("c", this.detailSelected ? 1 : 0);
      return qp.toString();
      /* var l = "https://zoziologie.raphaelnussbaumer.com/global-rare-ebird/?";
      l += "mylocation=" + (this.isMylocation ? "1" : "0") + "&";
      if (this.regionSelected.length > 0) {
        l += "r=" + this.regionSelected.map((x) => x.code).join(",") + "&";
      }
      l += "dist=" + this.distSelected + "&";
      l += "back=" + this.backSelected + "&";
      return l;*/
    },
    isaba: function () {
      let regionCode = this.regionSelected.map((e) => e.code);
      if (regionCode.some((x) => x.includes("US") | x.includes("CA"))) {
        return true;
      } else {
        return false;
      }
    },
    observationsFiltered: function () {
      var obsfiltered = this.isMylocation
        ? this.observationsMylocation
        : this.observationsRegion;
      obsfiltered = obsfiltered.filter(
        (x) => x.daysAgo <= parseInt(this.backSelected)
      );
      if (this.isMylocation) {
        obsfiltered = obsfiltered.filter(
          (x) => x.distToMe <= this.distSelected
        );
      }
      obsfiltered = obsfiltered.filter(
        (x) => x.aba >= parseInt(this.aba_limit)
      );
      if (this.mediaSelected) {
        obsfiltered = obsfiltered.filter((x) => x.hasRichMedia);
      }
      if (this.hotspotSelected) {
        obsfiltered = obsfiltered.filter((x) => !x.locationPrivate);
      }
      if (this.mapSelected) {
        obsfiltered = obsfiltered.filter((x) =>
          this.bounds.pad(-0.05).contains(x.latLng)
        );
      }
      obsfiltered = obsfiltered.filter((o) =>
        this.filterSearchOptionsSelected.some((k) =>
          o[k].toLowerCase().includes(this.filterSearch.toLowerCase())
        )
      );
      return obsfiltered
        .sort((a, b) => (a.daysAgo < b.daysAgo ? 1 : -1))
        .sort((a, b) =>
          a[this.filterSortOptionsSelected] > b[this.filterSortOptionsSelected]
            ? 1
            : -1
        );
    },
    speciesFiltered: function () {
      let y = this.observationsFiltered.reduce(function (r, i) {
        r[i.speciesCode] = r[i.speciesCode] || {
          obs: [],
          count: 0,
          comName: i.comName,
          speciesCode: i.speciesCode,
          aba: i.aba,
        };
        r[i.speciesCode].obs.push(i);
        r[i.speciesCode].count = r[i.speciesCode].count + 1;
        return r;
      }, {});
      return Object.values(y).map((x) => {
        x.loc = x.obs.reduce(function (r, i) {
          r[i.locId] = r[i.locId] || {
            obs: [],
            locName: i.locName,
            locationPrivate: i.locationPrivate,
            regionCode: i.regionCode,
            latLng: i.latLng,
            locId: i.locId,
          };
          r[i.locId].obs.push(i);
          return r;
        }, {});
        return x;
      });
    },
    locationFiltered: function () {
      return this.observationsFiltered.reduce(function (r, i) {
        r[i.locId] = r[i.locId] || {
          obs: [],
          count: 0,
          locName: i.locName,
          locationPrivate: i.locationPrivate,
          regionCode: i.regionCode,
          latLng: i.latLng,
          locId: i.locId,
        };
        r[i.locId].obs.push(i);
        r[i.locId].count = r[i.locId].count + 1;
        return r;
      }, {});
    },
  },
  mounted() {
    let qp = new URLSearchParams(window.location.search);
    if (qp.get("t")) {
      this.backSelected = Math.min(qp.get("t"), 30);
      if (this.backSelected > this.backMax) {
        this.backMax = this.backSelected;
      }
    }
    if (qp.get("d")) {
      this.distSelected = Math.min(qp.get("d"), 50);
      if (this.distSelected > this.distMax) {
        this.distMax = this.distSelected;
      }
    }
    if (qp.get("c")) {
      this.detailSelected = qp.get("c") == 1 ? true : false;
    }
    axios
      .get(
        "https://api.ebird.org/v2/ref/region/list/country/world?key=vcs68p4j67pt"
      )
      .then((response) => {
        /*response.data = response.data.filter(function (obj) {
          return !["US", "CA"].includes(obj.code);
        });*/
        this.regionSearch = [...this.regionSearch, ...response.data];
        axios
          .get(
            "https://api.ebird.org/v2/ref/region/list/subnational1/US?key=vcs68p4j67pt"
          )
          .then((response) => {
            this.regionSearch = [...this.regionSearch, ...response.data];
            axios
              .get(
                "https://api.ebird.org/v2/ref/region/list/subnational1/CA?key=vcs68p4j67pt"
              )
              .then((response) => {
                this.regionSearch = [
                  ...this.regionSearch,
                  ...response.data,
                ].sort((a, b) => (a.name > b.name ? 1 : -1));
                if (qp.get("mode") == "n") {
                  this.myLocation(1);
                } else {
                  this.isMylocation = false;
                  if (qp.get("r")) {
                    var temp = this.regionSearch.filter(
                      (x) => qp.get("r").split("_").indexOf(x.code) > -1
                    );
                    temp.forEach((x) => {
                      this.regionSelected.push(x);
                      this.addRegion(x);
                    });
                  }
                }
                this.regionSearchFiltered = this.regionSearch;
              });
          });
      });
  },
  created() {
    //do we support geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.location = pos.coords;
        },
        (err) => {
          this.location = err.message;
        }
      );
    }
  },
  watch: {
    isMylocation() {
      this.updateURL();
    },
    backSelected() {
      this.updateURL();
    },
    distSelected() {
      this.updateURL();
    },
    detailSelected() {
      this.updateURL();
    },
  },
};
</script>
