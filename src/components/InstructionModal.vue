<template>
  <div v-if="app.showInstruction" class="instruction-overlay" @click.self="app.toggleInstruction(false)">
    <div class="instruction-modal">
      <header class="instruction-modal__header">
        <div class="instruction-modal__header-copy">
          <h2>Settings</h2>
        </div>
        <button type="button" class="icon-button" @click="app.toggleInstruction(false)">
          <i class="bi bi-x-lg"></i>
        </button>
      </header>

      <div class="instruction-modal__body">
        <p class="instruction-modal__lead">
          Set the search radius, filters, language, and share link below.
        </p>

        <div class="instruction-section instruction-section--compact">
          <div class="settings-grid settings-grid--two">
            <label class="instruction-field">
              <span class="form-label">Days back fetched</span>
              <input
                v-model.number="app.backMax"
                type="number"
                min="0"
                max="30"
                step="1"
                class="form-control"
              />
            </label>
            <label class="instruction-field">
              <span class="form-label">Around me search radius</span>
              <input
                v-model.number="app.distMax"
                type="number"
                min="0"
                max="50"
                step="1"
                class="form-control"
              />
            </label>
          </div>

          <div class="instruction-switch-list">
            <label class="instruction-switch">
              <span class="instruction-switch__label">
                Synchronize the observation list with the map view.
              </span>
              <input
                v-model="app.mapSelected"
                class="form-check-input instruction-switch__control"
                type="checkbox"
                role="switch"
              />
            </label>

            <label class="instruction-switch">
              <span class="instruction-switch__label">Only show observations with media.</span>
              <input
                v-model="app.mediaSelected"
                class="form-check-input instruction-switch__control"
                type="checkbox"
                role="switch"
              />
            </label>

            <label class="instruction-switch">
              <span class="instruction-switch__label">Only show observations made at a hotspot.</span>
              <input
                v-model="app.hotspotSelected"
                class="form-check-input instruction-switch__control"
                type="checkbox"
                role="switch"
              />
            </label>
          </div>

          <label class="instruction-field">
            <span class="form-label">Language of species</span>
            <select
              :value="app.sppLocale"
              class="form-select"
              @change="app.setSpeciesLocale($event.target.value)"
            >
              <option value="af">Afrikaans</option>
              <option value="sq">Albanian</option>
              <option value="ar">Arabic</option>
              <option value="hy">Armenian</option>
              <option value="as">Assamese</option>
              <option value="ast">Asturian</option>
              <option value="az">Azerbaijani</option>
              <option value="bn">Bangla</option>
              <option value="bn_BD">Bangla (Bangladesh)</option>
              <option value="eu">Basque</option>
              <option value="bn_IN">Bengali (India)</option>
              <option value="bg">Bulgarian</option>
              <option value="ca">Catalan</option>
              <option value="zh">Chinese</option>
              <option value="zh_HK">Chinese (Hong Kong)</option>
              <option value="zh_SIM">Chinese (SIM)</option>
              <option value="hr">Croatian</option>
              <option value="cs">Czech</option>
              <option value="da">Danish</option>
              <option value="nl">Dutch</option>
              <option value="en" selected="selected">English</option>
              <option value="en_AU">English (Australia)</option>
              <option value="en_BD">English (Bangladesh)</option>
              <option value="en_HAW">English (HAW)</option>
              <option value="en_HBW">English (HBW)</option>
              <option value="en_HK">English (Hong Kong)</option>
              <option value="en_IN">English (India)</option>
              <option value="en_IOC">English (IOC)</option>
              <option value="en_KE">English (Kenya)</option>
              <option value="en_MY">English (Malaysia)</option>
              <option value="en_NZ">English (New Zealand)</option>
              <option value="en_PH">English (Philippines)</option>
              <option value="en_ZA">English (South Africa)</option>
              <option value="en_UK">English (UK)</option>
              <option value="en_AE">English (United Arab Emirates)</option>
              <option value="en_US">English (United States)</option>
              <option value="fo">Faroese</option>
              <option value="fi">Finnish</option>
              <option value="fr">French</option>
              <option value="fr_AOU">French (AOU)</option>
              <option value="fr_CA">French (Canada)</option>
              <option value="fr_FR">French (France)</option>
              <option value="fr_GF">French (French Guiana)</option>
              <option value="fr_GP">French (Guadeloupe)</option>
              <option value="fr_HT">French (Haiti)</option>
              <option value="gl">Galician</option>
              <option value="de">German</option>
              <option value="el">Greek</option>
              <option value="gu">Gujarati</option>
              <option value="ht_HT">Haitian Creole (Haiti)</option>
              <option value="he">Hebrew</option>
              <option value="hi">Hindi</option>
              <option value="hu">Hungarian</option>
              <option value="is">Icelandic</option>
              <option value="in">Indonesian</option>
              <option value="it">Italian</option>
              <option value="ja">Japanese</option>
              <option value="kn">Kannada</option>
              <option value="kok">Konkani</option>
              <option value="ko">Korean</option>
              <option value="lbj">Ladakhi</option>
              <option value="lv">Latvian</option>
              <option value="lt">Lithuanian</option>
              <option value="ml">Malayalam</option>
              <option value="mr">Marathi</option>
              <option value="mn">Mongolian</option>
              <option value="mi">Māori</option>
              <option value="ne_IN">Nepali (India)</option>
              <option value="ne_NP">Nepali (Nepal)</option>
              <option value="no">Norwegian</option>
              <option value="or">Odia</option>
              <option value="fa">Persian</option>
              <option value="pl">Polish</option>
              <option value="pt_AO">Portuguese (Angola)</option>
              <option value="pt_BR">Portuguese (Brazil)</option>
              <option value="pt_PT">Portuguese (Portugal)</option>
              <option value="pt_RAA">Portuguese (RAA)</option>
              <option value="pt_RAM">Portuguese (RAM)</option>
              <option value="pa_IN">Punjabi (India)</option>
              <option value="ro">Romanian</option>
              <option value="ru">Russian</option>
              <option value="sr">Serbian</option>
              <option value="sk">Slovak</option>
              <option value="sl">Slovenian</option>
              <option value="es">Spanish</option>
              <option value="es_AR">Spanish (Argentina)</option>
              <option value="es_CL">Spanish (Chile)</option>
              <option value="es_CR">Spanish (Costa Rica)</option>
              <option value="es_CU">Spanish (Cuba)</option>
              <option value="es_DO">Spanish (Dominican Republic)</option>
              <option value="es_EC">Spanish (Ecuador)</option>
              <option value="es_HN">Spanish (Honduras)</option>
              <option value="es_MX">Spanish (Mexico)</option>
              <option value="es_PA">Spanish (Panama)</option>
              <option value="es_PY">Spanish (Paraguay)</option>
              <option value="es_PE">Spanish (Peru)</option>
              <option value="es_PR">Spanish (Puerto Rico)</option>
              <option value="es_ES">Spanish (Spain)</option>
              <option value="es_UY">Spanish (Uruguay)</option>
              <option value="es_VE">Spanish (Venezuela)</option>
              <option value="sv">Swedish</option>
              <option value="ta_IN">Tamil (India)</option>
              <option value="te">Telugu</option>
              <option value="th">Thai</option>
              <option value="tr">Turkish</option>
              <option value="uk">Ukrainian</option>
              <option value="zu">Zulu</option>
            </select>
          </label>
        </div>
      </div>

      <footer class="instruction-modal__footer">
        <button type="button" class="btn btn-brand" @click="app.toggleInstruction(false)">
          Close
        </button>
        <a href="https://github.com/Zoziologie/global-rare-ebird/issues" target="_blank" rel="noreferrer">
          Report an issue
        </a>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { inject } from "vue"

import { birdAppKey } from "../composables/useGlobalRareBird"

const app = inject(birdAppKey)

if (!app) {
  throw new Error("InstructionModal requires the bird app context")
}
</script>
