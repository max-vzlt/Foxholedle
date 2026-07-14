<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import allItems from '../data/foxholedle_classic_pool.json'

// ------------------------------------------------------------------
// DONNÉES
// ------------------------------------------------------------------
const pool = allItems.filter(
  i => i.category === 'Weapon' && i.armory_eligible === true
)

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES (même pattern que ClassicMode)
// ------------------------------------------------------------------
const iconModules = import.meta.glob('@/assets/icons/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

function resolveImage(path) {
  if (!path) return ''
  const filename = path.split('/').pop()
  const found = Object.entries(iconModules).find(([key]) => key.endsWith('/' + filename))
  return found ? found[1] : ''
}

function pickRandomWeapon() {
  return pool[Math.floor(Math.random() * pool.length)]
}

const target = ref(pickRandomWeapon())

function factionClass(faction) {
  if (faction === 'Colonial') return 'colonial'
  if (faction === 'Warden') return 'warden'
  return 'no-fac'
}

// ------------------------------------------------------------------
// RECHERCHE / DROPDOWN (repris de ClassicMode)
// ------------------------------------------------------------------
const searchQuery = ref('')
const showDropdown = ref(false)
const highlightedIndex = ref(0)
const searchWrapperRef = ref(null)

const alreadyGuessedIds = computed(() => new Set(guesses.value.map(g => g.id)))

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return pool
    .filter(i => !alreadyGuessedIds.value.has(i.id))
    .filter(i => i.name.toLowerCase().includes(q))
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
const hasWon = computed(() => guesses.value.some(g => g.isWin))
const gaveUp = ref(false)
const revealed = computed(() => hasWon.value || gaveUp.value)

function giveUp() {
  if (hasWon.value) return
  gaveUp.value = true
}

function resetGame() {
  target.value = pickRandomWeapon()
  guesses.value = []
  gaveUp.value = false
  searchQuery.value = ''
  showDropdown.value = false
}

function submitGuess(item) {
  if (hasWon.value || gaveUp.value) return
  guesses.value.unshift({
    id: item.id,
    name: item.name,
    image: item.image,
    faction: item.faction,
    isWin: item.id === target.value.id,
  })
}
</script>

<template>
  <h1 class="page-title">{{ $t('armory.title') }}</h1>
  <section>
    <h2>{{ $t('armory.explanation_title') }}</h2>
    <p>{{ $t('armory.explanation_1') }}</p>
  </section>
  <section class="main-minigame">
    <div class="search-section">
      <h2>{{ $t('generic.search_title') }}</h2>
      <div class="search-bar" ref="searchWrapperRef">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('armory.search_placeholder')"
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

    <button
      v-if="!hasWon && !gaveUp"
      type="button"
      class="give-up-btn"
      @click="giveUp"
    >
      {{ $t('generic.give_up_button') }}
    </button>

    <p v-if="hasWon" class="win-message">
      {{ $t('generic.win_message', { name: target.name }) }}
      ({{ guesses.length }} {{ guesses.length > 1 ? $t('generic.guesses_plural') : $t('generic.guesses_singular') }})
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('generic.new_game') }}</button>
    </p>

    <p v-if="gaveUp" class="win-message give-up-message">
      {{ $t('generic.give_up_message', { name: target.name }) }}
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('generic.new_game') }}</button>
    </p>

    <div class="image-container">
      <img
        :src="resolveImage(target.image)"
        :alt="target.name"
        :class="{ revealed: revealed }"
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
p{
  margin: 0;
}

button{
  display: block;
  margin: 0;
  width: fit-content;
}

.image-container{
  background-image: url(../assets/stamps/WhiteCircleStamp.png);
  background-size: cover;
  aspect-ratio: 1/1;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;
  padding: 50px;
  margin: auto;
}

.image-container img{
  display: flex;
  margin: 50px;
  width: 250px;
  filter: brightness(0) blur(8px);
}

.image-container img.revealed{
  filter: brightness(0) blur(0px);
}

/* ---------------- Recherche / dropdown (repris de ClassicMode) ---------------- */

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
  z-index: 10;
}

.dropdown li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 8px;
  cursor: pointer;
}

.dropdown li.colonial::before {
  content: "";
  width: 40px;
  height: 40px;
  background-image: url("@/assets/Colonial.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.dropdown li.warden::before {
  content: "";
  width: 40px;
  height: 40px;
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

.option-img {
  width: 40px;
  aspect-ratio: 1/1;
  object-fit: contain;
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

/* ---------------- Historique des guesses (repris d'ExaguessrMode) ---------------- */
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