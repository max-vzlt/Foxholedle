<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import allTanks from '../data/foxholedle_tanks.json'

// ------------------------------------------------------------------
// DONNÉES
// ------------------------------------------------------------------
const pool = allTanks

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES (dossier dédié aux tanks)
// ------------------------------------------------------------------
const imageModules = import.meta.glob('@/assets/tanks/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

function resolveImage(filename) {
  if (!filename) return ''
  const found = Object.entries(imageModules).find(([key]) => key.endsWith('/' + filename))
  return found ? found[1] : ''
}

function pickRandomTank() {
  return pool[Math.floor(Math.random() * pool.length)]
}

function pickRandomImage(tank) {
  return tank.images[Math.floor(Math.random() * tank.images.length)]
}

const target = ref(pickRandomTank())
const targetImage = ref(pickRandomImage(target.value))

function factionClass(faction) {
  if (faction === 'Colonial') return 'colonial'
  if (faction === 'Warden') return 'warden'
  return 'no-fac'
}

// ------------------------------------------------------------------
// POINT DE ZOOM ALÉATOIRE — pour ne pas toujours zoomer sur le centre.
// On limite entre ORIGIN_MIN et ORIGIN_MAX pour éviter de tomber pile
// sur un bord/coin de l'image (vue trop peu lisible au zoom max).
// Comme l'image est en object-fit: cover (aucune zone vide) et le
// container en overflow: hidden, zoomer autour d'un point décentré ne
// peut jamais laisser apparaître de bord vide : à scale(1) la
// transformation est neutre quel que soit le transform-origin, donc
// l'image revient pile dans le cadre au dézoom complet.
// ------------------------------------------------------------------
const ORIGIN_MIN = 20
const ORIGIN_MAX = 80

function pickRandomOrigin() {
  return {
    x: ORIGIN_MIN + Math.random() * (ORIGIN_MAX - ORIGIN_MIN),
    y: ORIGIN_MIN + Math.random() * (ORIGIN_MAX - ORIGIN_MIN),
  }
}

const zoomOrigin = ref(pickRandomOrigin())

// Désactive temporairement la transition CSS au moment où on change de
// round (nouvelle image + zoom remis à fond), pour ne pas animer depuis
// l'état "pleinement visible" du round précédent vers le nouveau zoom
// (ce qui laisserait entrevoir la nouvelle image en entier).
const skipTransition = ref(false)

// ------------------------------------------------------------------
// ZOOM — dézoome un peu à chaque mauvais essai
// ------------------------------------------------------------------
const ZOOM_START = 4   // niveau de zoom au lancement (x4)
const ZOOM_STEP = 0.5  // dézoom par mauvais essai
const ZOOM_MIN = 1     // image entièrement visible

const zoomLevel = ref(ZOOM_START)

// ------------------------------------------------------------------
// RECHERCHE / DROPDOWN (même pattern que les autres modes)
// ------------------------------------------------------------------
const searchQuery = ref('')
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const searchWrapperRef = ref(null)

const alreadyGuessedIds = computed(() => new Set(guesses.value.map(g => g.id)))

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return pool
    .filter(t => !alreadyGuessedIds.value.has(t.id))
    .filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.alias && t.alias.toLowerCase().includes(q)) ||
      (t.class && t.class.toLowerCase().includes(q))
    )
    .sort((a, b) => a.name.localeCompare(b.name))
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
  if (top) selectItem(top)
}
function selectItem(item) {
  submitGuess(item)
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
// GUESSES / HISTORIQUE
// ------------------------------------------------------------------
const guesses = ref([])
const hasWon = computed(() => guesses.value.some(g => g.correct))
const gaveUp = ref(false)

function giveUp() {
  if (hasWon.value) return
  gaveUp.value = true
  zoomLevel.value = ZOOM_MIN
}

async function resetGame() {
  skipTransition.value = true
  target.value = pickRandomTank()
  targetImage.value = pickRandomImage(target.value)
  zoomOrigin.value = pickRandomOrigin()
  zoomLevel.value = ZOOM_START
  guesses.value = []
  gaveUp.value = false
  searchQuery.value = ''
  showDropdown.value = false
  await nextTick()
  skipTransition.value = false
}

function submitGuess(item) {
  if (hasWon.value || gaveUp.value) return
  const isWin = item.id === target.value.id
  guesses.value.unshift({ id: item.id, name: item.name, correct: isWin })
  if (isWin) {
    zoomLevel.value = ZOOM_MIN
  } else {
    zoomLevel.value = Math.max(ZOOM_MIN, zoomLevel.value - ZOOM_STEP)
  }
}
</script>

<template>
  <h1 class="page-title">{{ $t('recon.title') }}</h1>
  <section>
    <h2>{{ $t('recon.explanation_title') }}</h2>
    <p>{{ $t('recon.explanation_1') }}</p>
  </section>
  <section class="main-minigame">
    <div class="search-section">
      <h2>{{ $t('generic.search_title') }}</h2>
      <div class="search-bar" ref="searchWrapperRef">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('recon.search_placeholder')"
          @focus="openDropdown"
          @input="onSearchInput"
          @keydown.down.prevent="onArrowDown"
          @keydown.up.prevent="onArrowUp"
          @keydown.enter.prevent="onEnter"
          :disabled="hasWon || gaveUp"
        />

        <ul v-if="showDropdown && filteredOptions.length" class="dropdown">
          <li
            v-for="(opt, index) in filteredOptions"
            :key="opt.id"
            :class="[factionClass(opt.faction), { highlighted: index === highlightedIndex }]"
            @mouseenter="highlightedIndex = index"
            @mousedown.prevent="selectItem(opt)"
          >
            <span>{{ opt.name }}</span>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="hasWon" class="win-message">
      {{ $t('generic.win_message', { name: target.name }) }}
      ({{ guesses.length }} {{ guesses.length > 1 ? $t('generic.guesses_plural') : $t('generic.guesses_singular') }})
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('generic.new_game') }}</button>
    </p>

    <p v-if="gaveUp" class="win-message give-up-message">
      {{ $t('generic.give_up_message', { name: target.name }) }}
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('generic.new_game') }}</button>
    </p>

    <button
      v-if="!hasWon && !gaveUp"
      type="button"
      class="give-up-btn"
      @click="giveUp"
    >
      {{ $t('generic.give_up_button') }}
    </button>

    <div class="recon-image-container">
      <img
        :src="resolveImage(targetImage)"
        :alt="target.name"
        :style="{
          transform: `scale(${zoomLevel})`,
          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          transition: skipTransition ? 'none' : '',
        }"
      >
    </div>
  </section>

  <!-- Historique des propositions -->
  <section class="guess-history">
    <h2>{{ $t('generic.history_title') }}</h2>
    <ul>
      <li v-if="!guesses.length" is false class="noguess">
        {{ $t('generic.noguess') }}
      </li>
      <li v-for="(g, i) in guesses" :key="i" :class="g.correct ? 'guess-correct' : 'guess-wrong'">
        {{ g.name }} {{ g.correct ? '✅' : '❌' }}
      </li>
    </ul>
  </section>
</template>

<style scoped>
p {
  margin: 0;
}

/* ---------------- Image zoomée ---------------- */
.recon-image-container {
  width: 400px;
  height: 400px;
  max-width: 100%;
  aspect-ratio: 1/1;
  overflow: hidden;
  border: 2px solid var(--dark-color);
  margin: 0 auto;
  position: relative;
}

.recon-image-container::before{
    backdrop-filter: blur(10px);
    z-index: 100;
    mask-image: radial-gradient(circle,
        transparent 55%,
        black 80%);
}

.recon-image-container::after{
    content: "";
    position: absolute;
    inset: 0;
    background: url("../assets/image_noise.png");
    background-size: cover;
    opacity: 0.6;
    mix-blend-mode: overlay;

    pointer-events: none;
}

.recon-image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ---------------- Recherche / dropdown (repris des autres modes) ---------------- */

.search-bar {
  display: flex;
  width: 100%;
  gap: 2px;
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
  z-index: 1000;
}

.dropdown li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  cursor: pointer;
}

.dropdown li.colonial::before {
  content: "";
  width: 30px;
  height: 30px;
  background-image: url("@/assets/Colonial.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.dropdown li.warden::before {
  content: "";
  width: 30px;
  height: 30px;
  background-image: url("@/assets/Warden.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.dropdown li.colonial.highlighted,
.dropdown li.colonial:hover {
  background-color: var(--dark-colonial-color);
}
.dropdown li.warden.highlighted,
.dropdown li.warden:hover {
  background-color: var(--dark-warden-color);
}
.dropdown li.no-fac.highlighted,
.dropdown li.no-fac:hover {
  background-color: var(--dark-nofac-color);
}

/* ---------------- Messages / boutons ---------------- */
.win-message {
  display: flex;
  flex-direction: column;
  font-weight: bold;
  gap: 10px;
  margin-top: 15px;
}

.give-up-message {
  color: rgba(157, 44, 44, 0.9);
}

/* ---------------- Historique (style simple, repris d'ExaguessrMode) ---------------- */
.guess-history {
  margin-top: 20px;
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

.noguess{
  background-color: rgba(107, 44, 44, 0.2);
}
</style>