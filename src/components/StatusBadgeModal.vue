<template>
  <div
    v-if="isOpen"
    class="instruction-overlay status-badge-overlay"
    @click.self="app.closeStatusBadgeModal()"
  >
    <div class="instruction-modal status-badge-modal">
      <header class="instruction-modal__header">
        <div class="instruction-modal__header-copy">
          <p class="instruction-modal__eyebrow">Regional badges</p>
          <h2>What the badges mean</h2>
        </div>
        <button type="button" class="icon-button" @click="app.closeStatusBadgeModal()">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="instruction-modal__body">
        <p class="instruction-modal__lead">
          These badges highlight species that are flagged by the national or regional checklist
          for the selected country.
        </p>

        <section class="status-badge-modal__section">
          <h3 class="status-badge-modal__section-title">Badge meanings by region</h3>
          <div class="status-badge-modal__grid">
            <article
              v-for="row in rows"
              :key="row.id"
              :id="`status-badge-row-${row.id}`"
              :ref="(el) => setRowRef(row.id, el)"
              class="status-badge-modal__row"
              :class="{
                'status-badge-modal__row--active': row.id === app.statusBadgeModalSystemId,
              }"
            >
              <div class="status-badge-modal__row-head">
                <div>
                  <h4 class="status-badge-modal__row-title">{{ row.title }}</h4>
                  <a
                    class="status-badge-modal__row-source"
                    :href="row.sourceUrl"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {{ row.sourceLabel }}
                  </a>
                </div>
                <div class="status-badge-modal__chips">
                  <span
                    v-for="badge in row.badges"
                    :key="badge"
                    class="badge rounded-pill status-badge status-badge--guide"
                    :class="badgeClass(row.id, badge)"
                  >
                    {{ badge }}
                  </span>
                </div>
              </div>

              <p v-if="row.meaning" class="status-badge-modal__text">
                {{ row.meaning }}
              </p>

              <ol v-if="row.details" class="status-badge-modal__list">
                <li v-for="item in row.details" :key="item">
                  {{ item }}
                </li>
              </ol>
            </article>
          </div>
        </section>
      </div>

      <footer class="instruction-modal__footer">
        <button type="button" class="btn btn-brand" @click="app.closeStatusBadgeModal()">
          Close
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref, watch } from "vue";

import { birdAppKey } from "../composables/useGlobalRareBird";

const app = inject(birdAppKey);

if (!app) {
  throw new Error("StatusBadgeModal requires the bird app context");
}

const isOpen = computed(() => app.statusBadgeModalSystemId !== null);
const rowRefs = ref(new Map());

const rows = [
  {
    id: "aba",
    title: "ABA regions",
    sourceLabel: "American Birding Association",
    sourceUrl: "https://www.aba.org/aba-checklist/",
    badges: ["ABA-1", "ABA-2", "ABA-3", "ABA-4", "ABA-5", "ABA-6"],
    meaning: "ABA checklist codes describe how regular a species is in the ABA Area.",
    details: [
      "ABA-1: regularly occurring ABA Area avifauna. Includes regular breeding species and visitors.",
      "ABA-2: regularly occurring ABA Area avifauna. More restricted, lower-density, or harder-to-detect species.",
      "ABA-3: rare species that occur in very low numbers, but annually, in the ABA Area.",
      "ABA-4: casual species with some pattern of occurrence but not recorded annually.",
      "ABA-5: accidental species recorded five or fewer times in the ABA Area, or fewer than three records in the past 30 years.",
      "ABA-6: species that cannot be found in the ABA Area, including extinct, extirpated, or captive-only cases.",
    ],
  },
  {
    id: "fr",
    title: "France",
    sourceLabel: "Comité d'Homologation National",
    sourceUrl: "https://www.chn-france.org/",
    badges: ["rare"],
    meaning: "Rare species on the French checklist.",
  },
  {
    id: "de",
    title: "Germany",
    sourceLabel: "Deutsche Avifaunistische Kommission",
    sourceUrl: "https://www.dda-web.de/dak",
    badges: ["rare"],
    meaning: "Rare species on the German checklist.",
  },
  {
    id: "ch",
    title: "Switzerland",
    sourceLabel: "Swiss Rarities Committee",
    sourceUrl: "https://www.vogelwarte.ch/en/projects/swiss-rarities-committee",
    badges: ["regular", "irregular", "accidental", "rare"],
    details: [
      "Regular: species recorded in at least 9 years out of 10 between 2005 and 2014.",
      "Irregular: species recorded more than 10 times and in more than 5 years between 1965 and 2014 but in fewer than 9 years out of 10 between 2005 and 2014.",
      "Accidental: species recorded 1-10 times or in 1-5 years between 1965 and 2014, or for the first time after 2014.",
      "Rare: species recorded at least once but not since 1965.",
    ],
  },
];

function badgeClass(systemId, badge) {
  switch (systemId) {
    case "aba":
      return `status-badge--aba-${String(badge).split("-").pop()}`;
    case "fr":
    case "de":
      return "status-badge--rare";
    case "ch":
      if (badge === "regular") {
        return "status-badge--regular";
      }

      if (badge === "irregular") {
        return "status-badge--irregular";
      }

      if (badge === "accidental") {
        return "status-badge--accidental";
      }

      return "status-badge--rare";
    default:
      return "status-badge--rare";
  }
}

function setRowRef(rowId, el) {
  if (!el) {
    rowRefs.value.delete(rowId);
    return;
  }

  rowRefs.value.set(rowId, el);
}

async function scrollToActiveRow() {
  if (!app.statusBadgeModalSystemId) {
    return;
  }

  await nextTick();
  const row = rowRefs.value.get(app.statusBadgeModalSystemId);
  row?.scrollIntoView({ block: "start", behavior: "smooth" });
}

watch(
  () => app.statusBadgeModalSystemId,
  () => {
    if (isOpen.value) {
      scrollToActiveRow();
    }
  },
  { immediate: true },
);
</script>
