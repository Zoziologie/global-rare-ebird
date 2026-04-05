<template>
  <aside class="sidebar-panel">
    <header class="sidebar-panel__header">
      <button
        v-if="app.isMobileLayout"
        type="button"
        class="icon-button sidebar-panel__mobile-toggle"
        @click="app.toggleSidebar()"
      >
        <i class="bi bi-map"></i>
        <span>Map</span>
      </button>
      <h1 class="sidebar-panel__title">Global Rare eBird</h1>
      <button type="button" class="icon-button" @click="app.toggleInstruction(true)">
        <i class="bi bi-gear-fill"></i>
      </button>
    </header>

    <div class="sidebar-panel__body">
      <section class="query-block">
        <div class="mode-toggle btn-group" role="group" aria-label="Search mode">
          <button
            type="button"
            class="btn"
            :class="app.isMylocation ? 'btn-brand-outline' : 'btn-brand'"
            @click="app.isMylocation = false"
          >
            <i class="bi bi-globe2 me-1"></i>
            Regions
          </button>
          <button
            type="button"
            class="btn"
            :class="app.isMylocation ? 'btn-brand' : 'btn-brand-outline'"
            @click="app.myLocation()"
          >
            <i class="bi bi-geo-alt me-1"></i>
            Around me
          </button>
        </div>

        <div v-if="!app.isMylocation" class="query-block__picker">
          <RegionPicker
            :regions="app.regionSearch"
            :selected-regions="app.regionSelected"
            @add-region="app.selectRegion"
            @remove-region="app.removeRegion"
          />
        </div>

        <div v-else class="query-block__distance">
          <p
            v-if="app.locationPermission !== 'unknown' && app.locationPermission !== 'granted'"
            class="alert alert-danger py-2 px-3 mb-2 query-block__location-feedback"
            role="alert"
          >
            <i class="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>
            <span>
              {{ app.locationFeedback || "Location access is not available in this browser." }}
            </span>
          </p>
          <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-geo-alt"></i>
            </span>
            <input
              class="form-control"
              type="number"
              min="0"
              :max="app.distMax"
              step="1"
              v-model.number="app.distSelected"
            />
            <span class="input-group-text">km</span>
          </div>
        </div>

        <div class="query-block__days">
          <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-calendar-date"></i>
            </span>
            <input
              class="form-control"
              type="number"
              min="0"
              :max="app.backMax"
              step="1"
              v-model.number="app.backSelected"
            />
            <span class="input-group-text query-block__label-prefix">days ago</span>
          </div>
          <button
            v-if="app.backSelected > app.backMax && app.backMax !== 30"
            type="button"
            class="link-button mt-2"
            @click="app.reload(Math.min(app.backSelected, 30))"
          >
            Update max duration to {{ Math.min(app.backSelected, 30) }}
          </button>
        </div>

        <div class="filter-panel">
          <div class="input-group">
            <span class="input-group-text">
              <i class="bi bi-search"></i>
            </span>
            <input
              v-model="app.filterSearch"
              class="form-control"
              type="search"
              placeholder="Search species..."
            />
            <button
              type="button"
              class="btn btn-secondary filter-panel__toggle"
              :aria-expanded="showFilterOptions"
              aria-controls="search-and-sort-options"
              :aria-label="
                showFilterOptions ? 'Hide search and sort options' : 'Show search and sort options'
              "
              :title="
                showFilterOptions ? 'Hide search and sort options' : 'Show search and sort options'
              "
              @click="showFilterOptions = !showFilterOptions"
            >
              <i class="bi bi-funnel"></i>
              <span>Filter</span>
              <i :class="showFilterOptions ? 'bi bi-chevron-up' : 'bi bi-chevron-down'"></i>
            </button>
          </div>

          <div v-if="showFilterOptions" id="search-and-sort-options" class="filter-panel__content">
            <div class="filter-panel__grid">
              <div class="filter-panel__group">
                <label class="form-label mb-2">Search by</label>
                <div class="filter-checklist">
                  <label
                    v-for="option in app.filterSearchOptions"
                    :key="option.value"
                    class="form-check"
                  >
                    <input
                      v-model="app.filterSearchOptionsSelected"
                      class="form-check-input"
                      type="checkbox"
                      :value="option.value"
                    />
                    <span class="form-check-label">{{ option.text }}</span>
                  </label>
                </div>
              </div>

              <div class="filter-panel__group">
                <label class="form-label mb-2">Sort by</label>
                <div class="filter-checklist">
                  <label
                    v-for="option in app.filterSortOptions"
                    :key="option.value"
                    class="form-check"
                  >
                    <input
                      v-model="app.filterSortOptionsSelected"
                      class="form-check-input"
                      type="radio"
                      :value="option.value"
                    />
                    <span class="form-check-label">{{ option.text }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div v-if="app.activeStatusSystem?.filterable" class="status-panel">
              <div class="status-panel__row">
                <span class="status-panel__title">Filter minimal rarity status:</span>
                <select v-model.number="app.statusLimit" class="form-select status-panel__select">
                  <option
                    v-for="option in app.statusOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <button
                  type="button"
                  class="icon-button status-panel__info"
                  :aria-label="`Open badge guide for ${app.activeStatusSystem.shortLabel}`"
                  title="Open badge guide"
                  @click="app.openStatusBadgeModal(app.activeStatusSystem.id)"
                >
                  <i class="bi bi-info-circle"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="accordion accordion-flush species-accordion-shell">
        <div v-if="app.isLoading" class="species-accordion-shell__loading">
          <div class="spinner-border text-success" role="status" aria-hidden="true"></div>
          <p>{{ app.loadingLabel }}</p>
        </div>

        <p
          v-if="!app.hasCandidateObservations && !app.isLoading"
          class="species-accordion-shell__empty"
        >
          No observations to show yet.
        </p>

        <template v-for="(species, index) in app.speciesFiltered" :key="species.speciesCode">
          <div v-if="index <= app.speIndexMax" class="accordion-item">
            <h2 class="accordion-header" :id="`species-heading-${species.speciesCode}`">
              <button
                type="button"
                class="accordion-button py-2 ps-3 pe-2 shadow-none"
                :class="{ collapsed: openSpeciesCode !== species.speciesCode }"
                :aria-expanded="openSpeciesCode === species.speciesCode"
                :aria-controls="`species-collapse-${species.speciesCode}`"
                @click="toggleSpecies(species.speciesCode)"
                @pointerenter="app.setHighlightSpeciesCode(species.speciesCode)"
                @pointerleave="app.clearHighlight"
              >
                <span class="species-accordion-shell__species-head d-flex align-items-center gap-2">
                  <span
                    class="species-accordion-shell__species-name"
                    :title="species.comName"
                    :aria-label="species.comName"
                  >
                    {{ species.comName }}
                  </span>
                  <span
                    v-if="species.statusBadge"
                    class="badge rounded-pill status-badge status-badge--interactive"
                    :class="[species.statusBadgeClass || 'bg-secondary-subtle text-body']"
                    role="button"
                    tabindex="0"
                    :aria-label="`Open details for ${species.statusBadge}`"
                    @click.stop.prevent="app.openStatusBadgeModal(species.statusSystemId)"
                    @keydown.enter.stop.prevent="app.openStatusBadgeModal(species.statusSystemId)"
                    @keydown.space.stop.prevent="app.openStatusBadgeModal(species.statusSystemId)"
                  >
                    {{ species.statusBadge }}
                  </span>
                </span>
                <span class="badge rounded-pill bg-dark ms-auto species-accordion-shell__count">{{
                  species.obs.length
                }}</span>
              </button>
            </h2>

            <div
              :ref="setSpeciesCollapseRef(species.speciesCode)"
              :id="`species-collapse-${species.speciesCode}`"
              class="accordion-collapse collapse species-collapse"
              :aria-labelledby="`species-heading-${species.speciesCode}`"
            >
              <div class="accordion-body p-0">
                <div class="card border-0 rounded-0 shadow-none">
                  <div class="list-group list-group-flush">
                    <div
                      v-for="location in species.loc"
                      :key="`${species.speciesCode}-${location.locId}`"
                      class="list-group-item py-1 px-2 species-location"
                      @pointerenter="app.setHighlightLocationIds([location.locId])"
                      @pointerleave="app.clearHighlight"
                    >
                      <div
                        class="species-location__head d-flex align-items-center justify-content-between gap-2"
                      >
                        <span
                          class="species-location__title-group d-flex align-items-center gap-2 min-w-0 flex-grow-1"
                        >
                          <a
                            v-if="!location.locationPrivate"
                            :href="`https://ebird.org/hotspot/${location.locId}`"
                            target="_blank"
                            rel="noreferrer"
                            class="species-location__title species-location__title--link fw-semibold text-body"
                            :title="location.locName"
                          >
                            {{ location.locName }}
                          </a>
                          <span
                            v-else
                            class="species-location__title species-location__title--static fw-semibold text-body"
                            :title="location.locName"
                          >
                            {{ location.locName }}
                          </span>
                        </span>
                        <a
                          :href="`https://www.google.com/maps/dir/?api=1&destination=${location.latLng.lat},${location.latLng.lng}&dir_action=navigate`"
                          target="_blank"
                          rel="noreferrer"
                          class="species-location__direction text-body-secondary flex-shrink-0"
                          title="Directions"
                          aria-label="Directions"
                        >
                          <i class="bi bi-sign-turn-right-fill"></i>
                        </a>
                      </div>

                      <div class="d-grid gap-0">
                        <div
                          v-for="obs in location.obs"
                          :key="obs.subId"
                          class="species-location__obs d-flex align-items-center justify-content-between gap-2"
                        >
                          <small
                            class="species-location__meta text-body-secondary d-flex flex-nowrap align-items-center gap-1 flex-grow-1 min-w-0"
                          >
                            <a
                              :href="`https://ebird.org/checklist/${obs.subId}#${obs.speciesCode}`"
                              target="_blank"
                              rel="noreferrer"
                              class="species-location__obs-link text-decoration-none text-body"
                            >
                              <span class="species-location__obs-date">
                                {{ formatDaysAgo(obs.daysAgo) }}
                                {{ formatObservationTime(obs.obsDt) }}
                              </span>
                            </a>
                            <span class="species-location__obs-separator">•</span>
                            <span class="species-location__obs-count">{{ obs.howMany }} ind.</span>
                            <template v-if="Number.isFinite(obs.distToMe)">
                              <span class="species-location__obs-separator">•</span>
                              <span class="species-location__obs-distance">
                                {{ formatDistanceKm(obs.distToMe) }}
                              </span>
                            </template>
                            <span class="species-location__obs-separator">•</span>
                            <span class="species-location__user">{{ obs.userDisplayName }}</span>
                          </small>

                          <span
                            v-if="obs.hasRichMedia || obs.hasComments"
                            class="species-location__flags"
                          >
                            <span
                              v-if="obs.hasRichMedia"
                              class="species-location__flag species-location__flag--media"
                              title="Has media"
                              aria-label="Has media"
                            >
                              <i class="bi bi-camera-fill"></i>
                            </span>
                            <span
                              v-if="obs.hasComments"
                              class="species-location__flag species-location__flag--comments"
                              title="Has comments"
                              aria-label="Has comments"
                            >
                              <i class="bi bi-chat-square-text-fill"></i>
                            </span>
                          </span>
                        </div>
                      </div>

                      <div
                        v-if="location.obs.some((obs) => obs.media?.length)"
                        class="species-location__media-row row g-1 pt-1"
                      >
                        <template
                          v-for="obs in location.obs.filter((item) => item.media?.length)"
                          :key="obs.obsId"
                        >
                          <img
                            v-for="mediaId in obs.media"
                            :key="mediaId"
                            class="col-4 col-sm-3 rounded object-fit-cover"
                            :src="`https://cdn.download.ams.birds.cornell.edu/api/v1/asset/${mediaId}/320`"
                            alt=""
                          />
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-if="app.speciesFiltered.length > app.speIndexMax">
          <button
            type="button"
            class="btn btn-brand-outline btn-sm w-100 species-accordion-shell__more-button"
            @click="app.speIndexMax = 100000"
          >
            See {{ app.speciesFiltered.length - app.speIndexMax }} more species
          </button>
        </div>

        <div v-if="app.mapViewportHiddenCount" class="species-accordion-shell__hint">
          <button
            type="button"
            class="link-button species-accordion-shell__hint-action"
            @click="app.fitToAllSightings"
          >
            <i class="bi bi-arrows-angle-expand"></i>
            <span>Zoom to all sightings</span>
          </button>
        </div>
      </section>
    </div>

    <footer class="sidebar-panel__footer">
      <div class="sidebar-panel__footer-group">
        <button
          type="button"
          class="sidebar-panel__footer-action"
          aria-label="Share"
          title="Share"
          @click="app.shareLink"
        >
          <i class="bi bi-share"></i>
          <span>Share</span>
        </button>
        <a
          class="sidebar-panel__footer-action"
          href="https://github.com/sponsors/Zoziologie"
          target="_blank"
          rel="noreferrer"
          aria-label="Support Zoziologie"
          title="Support Zoziologie"
        >
          <i class="bi bi-heart-fill"></i>
          <span>Support</span>
        </a>
      </div>
      <div class="sidebar-panel__footer-group sidebar-panel__footer-group--right">
        <a
          class="sidebar-panel__footer-action"
          href="https://github.com/Zoziologie/global-rare-ebird/"
          target="_blank"
          rel="noreferrer"
          aria-label="Project repository"
          title="Project repository"
        >
          <i class="bi bi-github"></i>
          <span>GitHub</span>
        </a>
        <a
          href="https://zoziologie.raphaelnussbaumer.com/"
          target="_blank"
          rel="noreferrer"
          class="sidebar-panel__footer-action sidebar-panel__footer-action--logo"
          aria-label="Made by Zoziologie"
          title="Made by Zoziologie"
        >
          <img :src="logo" alt="" class="sidebar-panel__logo" />
          <span>Made by</span>
        </a>
      </div>
    </footer>
  </aside>
</template>

<script setup>
import { nextTick, inject, ref, watch } from "vue";
import Collapse from "bootstrap/js/dist/collapse";

import logo from "../assets/logo.svg";
import RegionPicker from "./RegionPicker.vue";
import { birdAppKey } from "../composables/useGlobalRareBird";
import { formatDaysAgo, formatDistanceKm, formatObservationTime } from "../utils/formatters";

const app = inject(birdAppKey);

if (!app) {
  throw new Error("SidebarPanel requires the bird app context");
}

const openSpeciesCode = ref(null);
const initializedOpenSpecies = ref(false);
const showFilterOptions = ref(false);
const speciesCollapseRefs = new Map();

function setSpeciesCollapseRef(code) {
  return (el) => {
    if (el) {
      speciesCollapseRefs.set(code, el);
      return;
    }

    speciesCollapseRefs.delete(code);
  };
}

watch(
  () => app.speciesFiltered.map((species) => species.speciesCode),
  (codes) => {
    if (!codes.length) {
      openSpeciesCode.value = null;
      initializedOpenSpecies.value = false;
      return;
    }

    if (!initializedOpenSpecies.value) {
      openSpeciesCode.value = codes[0];
      initializedOpenSpecies.value = true;
      return;
    }

    if (openSpeciesCode.value && !codes.includes(openSpeciesCode.value)) {
      openSpeciesCode.value = codes[0];
    }
  },
  { immediate: true },
);

function toggleSpecies(code) {
  openSpeciesCode.value = openSpeciesCode.value === code ? null : code;
}

async function syncSpeciesCollapses() {
  await nextTick();

  for (const [code, el] of speciesCollapseRefs) {
    const instance = Collapse.getOrCreateInstance(el, { toggle: false });

    if (code === openSpeciesCode.value) {
      instance.show();
    } else {
      instance.hide();
    }
  }
}

watch(
  [() => app.speciesFiltered.map((species) => species.speciesCode).join("|"), openSpeciesCode],
  () => {
    void syncSpeciesCollapses();
  },
  { immediate: true },
);
</script>
