<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import regions from '../data/foxholedle_regions.json'

const { t } = useI18n()

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES (même principe que ClassicMode.vue, mais
// pointant vers src/assets/regions/ au lieu de src/assets/icons/)
// ------------------------------------------------------------------
const regionImageModules = import.meta.glob('@/assets/regions/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

function resolveRegionImage(filename) {
  if (!filename) return ''
  const found = Object.entries(regionImageModules).find(([key]) => key.endsWith('/' + filename))
  return found ? found[1] : ''
}

// ------------------------------------------------------------------
// MODE DE JEU : Normal (noms majeurs) / Expert (noms mineurs)
// ------------------------------------------------------------------
const mode = ref('normal') // 'normal' | 'expert'

function setMode(newMode) {
  if (mode.value === newMode) return
  mode.value = newMode
  startNewRound()
}

// ------------------------------------------------------------------
// MÉLANGE (Fisher-Yates) — l'ordre de révélation des noms est
// randomisé une fois par partie, pas à chaque affichage.
// ------------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandomRegion() {
  return regions[Math.floor(Math.random() * regions.length)]
}

// ------------------------------------------------------------------
// ÉTAT DE LA PARTIE
// ------------------------------------------------------------------
const target = ref(pickRandomRegion())
const shuffledNames = ref([])
const revealedCount = ref(1) // un premier nom est révélé dès le départ
const guesses = ref([])      // historique des propositions {name, correct}
const hasWon = ref(false)
const gaveUp = ref(false)

function currentPool() {
  return mode.value === 'normal' ? target.value.major : target.value.minor
}

function startNewRound() {
  target.value = pickRandomRegion()
  shuffledNames.value = shuffle(currentPool())
  revealedCount.value = 1
  guesses.value = []
  hasWon.value = false
  gaveUp.value = false
  searchQuery.value = ''
  showDropdown.value = false
}

const revealedNames = computed(() => shuffledNames.value.slice(0, revealedCount.value))
const isOver = computed(() => hasWon.value || gaveUp.value)

// Abandon toujours disponible (les indices se révèlent déjà
// progressivement à chaque mauvais guess, contrairement au mode
// Classic qui a un seuil de 15 guesses).
function giveUp() {
  if (isOver.value) return
  gaveUp.value = true
}

// ------------------------------------------------------------------
// RECHERCHE / DROPDOWN (nom d'hexagone à deviner)
// ------------------------------------------------------------------
const searchQuery = ref('')
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const searchWrapperRef = ref(null)

const alreadyGuessedNames = computed(() => new Set(guesses.value.map(g => g.name)))

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return regions
    .map(r => r.name)
    .filter(name => !alreadyGuessedNames.value.has(name))
    .filter(name => name.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b))
})

function openDropdown() {
  showDropdown.value = true
  highlightedIndex.value = 0
}
function onSearchInput() {
  showDropdown.value = true
  highlightedIndex.value = 0
}
function onArrowDown() {
  if (!showDropdown.value) return
  highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredOptions.value.length - 1)
}
function onArrowUp() {
  if (!showDropdown.value) return
  highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
}
function onEnter() {
  const top = filteredOptions.value[highlightedIndex.value]
  if (top) selectName(top)
}
function selectName(name) {
  submitGuess(name)
  searchQuery.value = ''
  showDropdown.value = false
}
function handleClickOutside(e) {
  if (searchWrapperRef.value && !searchWrapperRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

// ------------------------------------------------------------------
// SOUMISSION D'UN GUESS
// ------------------------------------------------------------------
function submitGuess(name) {
  if (isOver.value) return
  const correct = name === target.value.name
  guesses.value.unshift({ name, correct })
  if (correct) {
    hasWon.value = true
  } else if (revealedCount.value < shuffledNames.value.length) {
    revealedCount.value++
  }
}

// Initialisation de la première manche, une fois que tout
// (y compris searchQuery/showDropdown) est bien déclaré.
startNewRound()
</script>

<template>
  <h1 class="page-title">{{ $t('exadle.title') }}</h1>
  <section class="main-minigame">
    <h2>{{ $t('exadle.explanation_title') }}</h2>
    <p>{{ $t('exadle.explanation_1') }}</p>
    <hr>

    <div class="mode-section">
      <h2>{{ $t('exadle.mode_title') }}</h2>
      <div class="mode-buttons">
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mode === 'normal' }"
          @click="setMode('normal')"
        >
          {{ $t('exadle.mode_normal') }}
        </button>
        <button
          type="button"
          class="mode-btn"
          :class="{ active: mode === 'expert' }"
          @click="setMode('expert')"
        >
          {{ $t('exadle.mode_expert') }}
        </button>
      </div>
    </div>

    <div class="search-section">
      <h2>{{ $t('exadle.search_title') }}</h2>
      <div class="search-bar" ref="searchWrapperRef">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('exadle.search_placeholder')"
          @focus="openDropdown"
          @input="onSearchInput"
          @keydown.down.prevent="onArrowDown"
          @keydown.up.prevent="onArrowUp"
          @keydown.enter.prevent="onEnter"
          :disabled="isOver"
        />

        <ul v-if="showDropdown && filteredOptions.length" class="dropdown">
          <li
            v-for="(name, index) in filteredOptions"
            :key="name"
            :class="{ highlighted: index === highlightedIndex }"
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent="selectName(name)"
          >
            {{ name }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Indices révélés progressivement -->
    <div class="hints">
      <h2>{{ $t('exadle.hints_title') }}</h2>
      <TransitionGroup name="hint-pop" tag="div" class="hint-list">
        <span v-for="hint in revealedNames" :key="hint" class="hint-chip">{{ hint }}</span>
      </TransitionGroup>
    </div>

    <!-- Historique des propositions -->
    <div v-if="guesses.length" class="guess-history">
      <h2>{{ $t('exadle.history_title') }}</h2>
      <ul>
        <li v-for="(g, i) in guesses" :key="i" :class="g.correct ? 'guess-correct' : 'guess-wrong'">
          {{ g.name }} {{ g.correct ? '✅' : '❌' }}
        </li>
      </ul>
    </div>

    <p v-if="hasWon" class="win-message">
      {{ $t('exadle.win_message', { name: target.name }) }}
      ({{ guesses.length }} {{ guesses.length > 1 ? $t('exadle.guesses_plural') : $t('exadle.guesses_singular') }})
      <button type="button" class="new-game-btn" @click="startNewRound">{{ $t('exadle.new_game') }}</button>
    </p>

    <p v-if="gaveUp" class="win-message give-up-message">
      {{ $t('exadle.give_up_message', { name: target.name }) }}
      <button type="button" class="new-game-btn" @click="startNewRound">{{ $t('exadle.new_game') }}</button>
    </p>

    <button v-if="!isOver" type="button" class="give-up-btn" @click="giveUp">
      {{ $t('exadle.give_up_button') }}
    </button>

    <!-- Image de l'hexagone, révélée une fois trouvé ou abandonné -->
    <div v-if="isOver" class="region-reveal">
      <img :src="resolveRegionImage(target.image)" :alt="target.name" class="region-img" />
    </div>
  </section>
</template>

<style scoped>
p {
  margin: 0;
}

.mode-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.mode-section h2 {
  margin: 0;
}

.mode-buttons {
  display: flex;
  gap: 8px;
}

.mode-btn {
  padding: 8px 14px;
  cursor: pointer;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

.mode-btn.active {
  background: var(--dark-color);
  color: var(--light-color);
}

.search-section {
  display: flex;
  gap: 10px;
  height: 40px;
  margin-bottom: 12px;
}
.search-section h2 {
  margin: 0;
  align-self: center;
}

.search-bar {
  display: flex;
  width: 100%;
  position: relative;
}

.search-bar input {
  flex: 1;
  padding: 5px 10px;
  font-size: 16px;
  border: none;
  border-bottom: 2px solid var(--dark-color);
  background-color: var(--lighter-color);
  color: var(--dark-color);
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  background: var(--dark-color);
  color: var(--light-color);
  border: 1px solid #555;
  border-top: none;
  list-style: none;
  margin: 0;
  padding: 0;
  z-index: 10;
}

.dropdown li {
  padding: 8px 12px;
  cursor: pointer;
}

.dropdown li.highlighted,
.dropdown li:hover {
  background: var(--darker-color);
}

.hints {
  margin-bottom: 16px;
}

.hint-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.hint-chip {
  padding: 6px 12px;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

.hint-pop-enter-active {
  animation: hint-drop 0.4s cubic-bezier(0.25, 0.8, 0.4, 1) both;
}

@keyframes hint-drop {
  0%   { opacity: 0; transform: translateY(-30px) scale(1.4); }
  60%  { opacity: 1; transform: translateY(3px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.guess-history {
  margin-bottom: 16px;
}

.guess-history ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guess-history li {
  padding: 6px 10px;
}

.guess-correct {
  background-color: rgba(46, 125, 50, 0.3);
}

.guess-wrong {
  background-color: rgba(107, 44, 44, 0.2);
}

.win-message {
  display: flex;
  flex-direction: column;
  font-weight: bold;
  gap: 10px;
  margin-bottom: 12px;
}

.give-up-message {
  color: rgba(157, 44, 44, 0.9);
}

.new-game-btn {
  padding: 10px;
  cursor: pointer;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
  align-self: flex-start;
  width: 100%;
}
.new-game-btn:hover {
  background: var(--light-color);
}

.give-up-btn {
  padding: 10px;
  cursor: pointer;
  background: #7C3636;
  color: var(--light-color);
  border: 1px solid var(--dark-color);
  margin-bottom: 16px;
}
.give-up-btn:hover {
  background: #592727;
}

.region-reveal {
  margin-top: 16px;
  animation: badge-drop 0.5s cubic-bezier(0.25, 0.8, 0.4, 1) both;
}

@keyframes badge-drop {
  0%   { opacity: 0; transform: translateY(-40px) scale(1.3); }
  60%  { opacity: 1; transform: translateY(4px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.region-img {
  max-width: 100%;
  display: block;
  margin: 0 auto;
}
</style>