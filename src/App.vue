<template>
  <div class="app-shell" :class="{ 'app-shell--sidebar-open': app.sidebarOpen }">
    <SidebarPanel v-if="showSidebarPanel" />
    <MapView />
    <InstructionModal />
    <StatusBadgeModal />
  </div>
</template>

<script setup>
import { computed, provide } from "vue"

import InstructionModal from "./components/InstructionModal.vue"
import MapView from "./components/MapView.vue"
import StatusBadgeModal from "./components/StatusBadgeModal.vue"
import SidebarPanel from "./components/SidebarPanel.vue"
import { birdAppKey, useGlobalRareBird } from "./composables/useGlobalRareBird"

const app = useGlobalRareBird()
const showSidebarPanel = computed(() => !app.isMobileLayout || app.sidebarOpen)

provide(birdAppKey, app)
</script>
