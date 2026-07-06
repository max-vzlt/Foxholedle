<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

// Ajoute une entrée ici pour chaque langue supportée.
// "flag" utilise des emojis drapeaux (aucune image à gérer),
// remplace par une balise <img> si tu préfères de vraies icônes.
const LANGUAGES = [
  { code: 'fr', label: 'Français', flagCode: 'fr' },
  { code: 'en', label: 'English', flagCode: 'gb' },
  { code: 'de', label: 'Deutsch', flagCode: 'de' },
]

const showDropdown = ref(false)
const wrapperRef = ref(null)

const currentLang = () => LANGUAGES.find(l => l.code === locale.value) || LANGUAGES[0]

function selectLang(code) {
  locale.value = code
  localStorage.setItem('foxholedle-lang', code)
  showDropdown.value = false
}

function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function handleClickOutside(e) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="lang-switcher" ref="wrapperRef">
    <button type="button" class="lang-btn" @click="toggleDropdown">
      <img :src="`https://flagicons.lipis.dev/flags/4x3/${currentLang().flagCode}.svg`" :alt="currentLang.label"/>
    </button>

    <ul v-if="showDropdown" class="lang-dropdown">
      <li
        v-for="lang in LANGUAGES"
        :key="lang.code"
        :class="{ active: lang.code === locale }"
        @click="selectLang(lang.code)"
      >
        <img class="flag" :src="`https://flagicons.lipis.dev/flags/4x3/${lang.flagCode}.svg`" :alt="currentLang.label"/>
        <span>{{ lang.label }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>

.lang-switcher {
  position: relative;
  display: inline-block;
}

.lang-btn {
    display: flex;
    align-items: center;
  font-size: 22px;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
  padding: 4px 8px;
  color: var(--light-color);
  padding: 0;
  border: solid 2px #555;
}

.lang-btn img{
    display: block;
    height: 30px;
    aspect-ratio: 4/3;
}

.lang-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--dark-color);
  color: var(--light-color);
  list-style: none;
  padding: 0;
  min-width: 140px;
  z-index: 20;
}

.lang-dropdown li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.lang-dropdown li:hover,
.lang-dropdown li.active {
  background: var(--darker-color);
}

.flag {
  height: 1.5rem;
}
</style>