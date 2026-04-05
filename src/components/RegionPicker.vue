<template>
  <div class="region-picker">
    <div class="input-group region-picker__group">
      <span class="input-group-text region-picker__icon" aria-hidden="true">
        <i class="bi bi-globe2"></i>
      </span>
      <Multiselect
        v-model="selected"
        class="region-picker__multiselect"
        :options="visibleRegions"
        :multiple="true"
        :close-on-select="true"
        :clear-on-select="true"
        :hide-selected="true"
        :searchable="true"
        :preserve-search="false"
        :show-labels="false"
        :show-no-options="false"
        :show-no-results="false"
        :max-height="220"
        track-by="code"
        label="name"
        placeholder="Search countries, states, provinces"
        :custom-label="regionLabel"
        @search-change="searchQuery = $event"
      >
        <template #option="{ option }">
          <div class="region-picker__option">
            <span>{{ option.name }}</span>
            <small>{{ option.code }}</small>
          </div>
        </template>
      </Multiselect>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue"
import Multiselect from "vue-multiselect"
import "vue-multiselect/dist/vue-multiselect.css"

import { filterRegions } from "../utils/regions"

const props = defineProps({
  regions: {
    type: Array,
    default: () => [],
  },
  selectedRegions: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(["add-region", "remove-region"])

const selected = ref([...props.selectedRegions])
const searchQuery = ref("")
let syncFromProps = false

function regionLabel(region) {
  return region ? region.name : ""
}

const visibleRegions = computed(() =>
  searchQuery.value.trim().length >= 1
    ? filterRegions(
        props.regions,
        searchQuery.value,
        selected.value.map((region) => region.code)
      )
    : []
)

watch(
  () => props.selectedRegions,
  (next) => {
    syncFromProps = true
    selected.value = [...next]
    nextTick(() => {
      syncFromProps = false
    })
  },
  { deep: true, immediate: true }
)

watch(
  selected,
  (next, prev) => {
    if (syncFromProps) {
      return
    }

    const nextCodes = new Set(next.map((region) => region.code))
    const prevCodes = new Set(prev.map((region) => region.code))

    for (const region of next) {
      if (!prevCodes.has(region.code)) {
        emit("add-region", region)
      }
    }

    for (const region of prev) {
      if (!nextCodes.has(region.code)) {
        emit("remove-region", region)
      }
    }
  },
  { deep: true }
)
</script>
