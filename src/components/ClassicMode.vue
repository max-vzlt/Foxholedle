<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import allItems from '../data/foxholedle_classic_pool.json'
import stampApproved from '@/assets/stamps/Approved.png'
import stampDenied from '@/assets/stamps/Denied.png'
import stampInReview from '@/assets/stamps/InReview.png'
import stampClassified from '@/assets/stamps/Classified.png'
import stampHigher from '@/assets/stamps/Higher.png'
import stampLower from '@/assets/stamps/Lower.png'

// ------------------------------------------------------------------
// DONNÉES
// ------------------------------------------------------------------
const { t } = useI18n()

const pool = allItems.filter(i => i.classic_eligible)

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES
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

function pickRandomTarget() {
  return pool[Math.floor(Math.random() * pool.length)]
}

const target = ref(pickRandomTarget())

const STAMP_IMAGES = {
  correct: stampApproved,
  wrong: stampDenied,
  partial: stampInReview,
  unknown: stampClassified,
  locked: stampClassified,
  higher: stampHigher,
  lower: stampLower,
}

// ------------------------------------------------------------------
// TABLE DE CONVERSION DES RESSOURCES EN ÉQUIVALENT BMAT
// ------------------------------------------------------------------
const RESOURCE_TO_BMAT = {
  Bmat: 1,
  AsmatI: 60,
  AsmatII: 130,
  AsmatIII: 275,
  AsmatIV: 550,
  AsmatV: 1100,
  Rmat: 20,
  PCmat: 55,
  Cmat: 95,
  ThermalShielding: 810,
  RareAlloys: 1365,
  SCmat: 240,
  NavalHullSegments: 4285,
  NavalShellPlating: 5125,
  NavalTurbineComponents: 6375,
}
function parseCostToBmat(costArray) {
  if (!costArray || !costArray.length) return null
  let total = 0
  for (const entry of costArray) {
    const [amountStr, unit] = entry.split('-')
    const amount = Number(amountStr)
    const rate = RESOURCE_TO_BMAT[unit]
    if (Number.isNaN(amount) || rate == null) return null
    total += amount * rate
  }
  return total
}

// ------------------------------------------------------------------
// DÉBLOCAGE PROGRESSIF
// ------------------------------------------------------------------
const FACTION_UNLOCK_AT = 5
const MILIEU_UNLOCK_AT = 3

const factionUnlocked = computed(() => guesses.value.length >= FACTION_UNLOCK_AT)
const milieuUnlocked = computed(() => guesses.value.length >= MILIEU_UNLOCK_AT)

function factionClass(faction) {
  if (faction === 'Colonial') return 'colonial'
  if (faction === 'Warden') return 'warden'
  return 'no-fac'
}

function resolvedStatus(realStatus, isUnlocked) {
  return isUnlocked ? realStatus : 'locked'
}

// ------------------------------------------------------------------
// RECHERCHE / DROPDOWN
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
    .filter(i => {
      const nameMatch = i.name.toLowerCase().includes(q)
      const classMatch = i.class && i.class.toLowerCase().includes(q)
      return nameMatch || classMatch
    })
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
// LOGIQUE DE COMPARAISON
// ------------------------------------------------------------------
function compareExact(guessVal, targetVal) {
  if (guessVal == null || targetVal == null) return { status: 'unknown' }
  return { status: guessVal === targetVal ? 'correct' : 'wrong' }
}

function toValueArray(val) {
  if (val == null) return null
  return Array.isArray(val) ? val : [val]
}

function compareMultiValue(guessVal, targetVal) {
  const guessArr = toValueArray(guessVal)
  const targetArr = toValueArray(targetVal)
  if (!guessArr?.length || !targetArr?.length) return { status: 'unknown' }
  const overlap = guessArr.filter(v => targetArr.includes(v))
  if (overlap.length === guessArr.length && overlap.length === targetArr.length) {
    return { status: 'correct' }
  }
  if (overlap.length > 0) return { status: 'partial' }
  return { status: 'wrong' }
}

function compareRole(guessArr, targetArr) {
  return compareMultiValue(guessArr, targetArr)
}

function compareOrdinal(guessVal, targetVal, orderMap) {
  if (guessVal == null || targetVal == null) return { status: 'unknown' }
  const g = orderMap(guessVal)
  const t = orderMap(targetVal)
  if (g === t) return { status: 'correct' }
  return { status: g < t ? 'higher' : 'lower' }
}

function arrowFor(status) {
  if (status === 'higher') return '↑'
  if (status === 'lower') return '↓'
  return ''
}

// Traduit une valeur de donnée (Rôle/Milieu/Faction) via les clés i18n
// role.*, milieu.*, faction.* — jamais utilisé sur g.name (les noms
// d'objets/véhicules ne sont JAMAIS traduits).
function tFaction(val) { return val ? t('faction.' + val) : '?' }
function tMilieu(val) { return val ? t('milieu.' + val) : '?' }
function tRole(val) { return val ? t('role.' + val) : val }

function displayFaction(g) { return tFaction(g.faction.value) }
function displayRole(g) { return g.role.value?.map(tRole).join(', ') || '?' }
function displayMilieu(g) { return tMilieu(g.milieu.value) }
function displayAmmo(g) {
  const val = g.ammo.value
  if (Array.isArray(val)) return val.join(' + ')
  return val ?? '?'
}
function displayCost(g) {
  const bmat = g.cost.value
  return bmat != null ? `${bmat} Bmat` : '?'
}
function displayWar(g) {
  const base = g.war.value ? `War ${g.war.value[0]} (${g.war.value[1]})` : '?'
  return `${base} ${arrowFor(g.war.status)}`.trim()
}

function charsOf(text) {
  return Array.from(String(text ?? '?')).map(c => (c === ' ' ? '\u00A0' : c))
}

// ------------------------------------------------------------------
// EFFET MACHINE À ÉCRIRE + TAMPONS
// ------------------------------------------------------------------
const COLUMN_BASE_DELAY = 150
const CHAR_STEP_DELAY = 25
const STAMP_STEP_DELAY = 220
const STAMP_START_BUFFER = 200
const STAMP_FALL_DURATION = 400

const TEXT_COLUMNS = ['name', 'faction', 'milieu', 'role', 'ammo', 'cost', 'war']
const STAMP_COLUMNS = ['faction', 'milieu', 'role', 'ammo', 'cost', 'war']

function randomStampAngle() {
  const sign = Math.random() < 0.5 ? -1 : 1
  return sign * (6 + Math.random() * 14)
}

function scheduleReveal(guessObj, onComplete) {
  const texts = {
    name: guessObj.name,
    faction: displayFaction(guessObj),
    role: displayRole(guessObj),
    milieu: displayMilieu(guessObj),
    ammo: displayAmmo(guessObj),
    cost: displayCost(guessObj),
    war: displayWar(guessObj),
  }

  let maxTextEnd = 0

  TEXT_COLUMNS.forEach((col, colIndex) => {
    const length = charsOf(texts[col]).length
    for (let i = 0; i < length; i++) {
      const delay = colIndex * COLUMN_BASE_DELAY + i * CHAR_STEP_DELAY
      maxTextEnd = Math.max(maxTextEnd, delay)
      setTimeout(() => {
        guessObj.revealCount[col] = i + 1
      }, delay)
    }
  })

  const stampStart = maxTextEnd + STAMP_START_BUFFER
  STAMP_COLUMNS.forEach((col, i) => {
    setTimeout(() => {
      guessObj.stampVisible[col] = true
    }, stampStart + i * STAMP_STEP_DELAY)
  })

  if (onComplete) {
    const lastStampStart = stampStart + (STAMP_COLUMNS.length - 1) * STAMP_STEP_DELAY
    const totalEnd = lastStampStart + STAMP_FALL_DURATION
    setTimeout(onComplete, totalEnd)
  }
}

// ------------------------------------------------------------------
// GUESSES
// ------------------------------------------------------------------
const guesses = ref([])
const hasWon = computed(() => guesses.value.some(g => g.id === target.value.id))
const winRevealed = ref(false)

const GIVE_UP_UNLOCK_AT = 15
const gaveUp = ref(false)
const canGiveUp = computed(() => !hasWon.value && !gaveUp.value && guesses.value.length >= GIVE_UP_UNLOCK_AT)

function giveUp() {
  if (hasWon.value) return
  gaveUp.value = true
}

function resetGame() {
  target.value = pickRandomTarget()
  guesses.value = []
  winRevealed.value = false
  gaveUp.value = false
  searchQuery.value = ''
  showDropdown.value = false
}

function submitGuess(item) {
  if (hasWon.value || gaveUp.value) return
  const result = buildGuessResult(item)
  guesses.value.unshift(result)
  const reactiveGuess = guesses.value[0]
  scheduleReveal(reactiveGuess, reactiveGuess.isWin ? () => { winRevealed.value = true } : null)
}

function buildGuessResult(item) {
  return {
    id: item.id,
    name: item.name,
    image: item.image,
    faction: { value: item.faction, ...compareExact(item.faction, target.value.faction) },
    role: { value: item.role, ...compareRole(item.role, target.value.role) },
    milieu: { value: item.milieu, ...compareExact(item.milieu, target.value.milieu) },
    ammo: { value: item.ammo, ...compareMultiValue(item.ammo, target.value.ammo) },
    cost: {
      value: parseCostToBmat(item.cost),
      ...compareOrdinal(parseCostToBmat(item.cost), parseCostToBmat(target.value.cost), v => v)
    },
    war: {
      value: item.war_added,
      ...compareOrdinal(item.war_added?.[0], target.value.war_added?.[0], v => v)
    },
    isWin: item.id === target.value.id,
    revealCount: { name: 0, faction: 0, role: 0, milieu: 0, ammo: 0, cost: 0, war: 0 },
    stampVisible: { faction: false, role: false, milieu: false, ammo: false, cost: false, war: false },
    stampRotation: {
      faction: randomStampAngle(),
      role: randomStampAngle(),
      milieu: randomStampAngle(),
      ammo: randomStampAngle(),
      cost: randomStampAngle(),
      war: randomStampAngle(),
    },
  }
}
</script>

<template>
  <h1 class="page-title">{{ $t('classic.title') }}</h1>
  <section class="main-minigame">
    <h2>{{ $t('classic.explanation_title') }}</h2>
    <p>{{ $t('classic.explanation_1') }}</p>
    <hr>
    <div class="search-section">
      <h2>{{ $t('classic.search_title') }}</h2>
      <div class="search-bar" ref="searchWrapperRef">
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="$t('classic.search_placeholder')"
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
            @click="selectItem(opt)"
          >
            <img :src="resolveImage(opt.image)" :alt="opt.name" class="option-img" />
            <span>{{ opt.name }}</span>
          </li>
        </ul>
      </div>
    </div>

    <p v-if="winRevealed" class="win-message">
      {{ $t('classic.win_message', { name: target.name }) }}
      ({{ guesses.length }} {{ guesses.length > 1 ? $t('classic.guesses_plural') : $t('classic.guesses_singular') }})
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('classic.new_game') }}</button>
    </p>

    <p v-if="gaveUp" class="win-message give-up-message">
      {{ $t('classic.give_up_message', { name: target.name }) }}
      <button type="button" class="new-game-btn" @click="resetGame">{{ $t('classic.new_game') }}</button>
    </p>

    <button
      v-if="canGiveUp"
      type="button"
      class="give-up-btn"
      @click="giveUp"
    >
      {{ $t('classic.give_up_button') }}
    </button>

    <p class="unlock-hint">
      {{ factionUnlocked
        ? $t('classic.unlock_faction_unlocked')
        : $t('classic.unlock_faction_locked', { n: FACTION_UNLOCK_AT, remaining: FACTION_UNLOCK_AT - guesses.length }) }}
      ·
      {{ milieuUnlocked
        ? $t('classic.unlock_milieu_unlocked')
        : $t('classic.unlock_milieu_locked', { n: MILIEU_UNLOCK_AT, remaining: MILIEU_UNLOCK_AT - guesses.length }) }}
    </p>

    <table>
      <thead>
        <tr>
          <th :data-tooltip="$t('classic.tooltip.image')">{{ $t('classic.table.image') }}</th>
          <th :data-tooltip="$t('classic.tooltip.name')">{{ $t('classic.table.name') }}</th>
          <th :data-tooltip="$t('classic.tooltip.faction')">{{ $t('classic.table.faction') }}</th>
          <th :data-tooltip="$t('classic.tooltip.milieu')">{{ $t('classic.table.milieu') }}</th>
          <th :data-tooltip="$t('classic.tooltip.role')">{{ $t('classic.table.role') }}</th>
          <th :data-tooltip="$t('classic.tooltip.ammo')">{{ $t('classic.table.ammo') }}</th>
          <th :data-tooltip="$t('classic.tooltip.cost')">{{ $t('classic.table.cost') }}</th>
          <th :data-tooltip="$t('classic.tooltip.war')">{{ $t('classic.table.war') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="g in guesses" :key="g.id" :class="{ 'win-row': g.isWin && winRevealed }">
          <td class="cell-img-anim" :class="factionClass(g.faction.value)">
            <img :src="resolveImage(g.image)" :alt="g.name" class="cell-img" />
          </td>

          <td>
            <span
              v-for="(c, i) in charsOf(g.name)"
              :key="i"
              class="type-char"
              :class="{ visible: i < g.revealCount.name }"
            >{{ c }}</span>
          </td>

          <td class="stampable" :class="{ ['bg-' + resolvedStatus(g.faction.status, factionUnlocked)]: g.stampVisible.faction }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayFaction(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.faction }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.faction"
              :src="STAMP_IMAGES[resolvedStatus(g.faction.status, factionUnlocked)]"
              class="stamp-img"
              :style="{ '--stamp-rot': g.stampRotation.faction + 'deg' }"
              alt=""
            />
          </td>

          <td class="stampable" :class="{ ['bg-' + resolvedStatus(g.milieu.status, milieuUnlocked)]: g.stampVisible.milieu }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayMilieu(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.milieu }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.milieu"
              :src="STAMP_IMAGES[resolvedStatus(g.milieu.status, milieuUnlocked)]"
              class="stamp-img"
              :style="{ '--stamp-rot': g.stampRotation.milieu + 'deg' }"
              alt=""
            />
          </td>

          <td class="stampable" :class="{ ['bg-' + g.role.status]: g.stampVisible.role }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayRole(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.role }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.role"
              :src="STAMP_IMAGES[g.role.status]"
              class="stamp-img"
              :style="{ '--stamp-rot': g.stampRotation.role + 'deg' }"
              alt=""
            />
          </td>

          <td class="stampable" :class="{ ['bg-' + g.ammo.status]: g.stampVisible.ammo }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayAmmo(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.ammo }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.ammo"
              :src="STAMP_IMAGES[g.ammo.status]"
              class="stamp-img"
              :style="{ '--stamp-rot': g.stampRotation.ammo + 'deg' }"
              alt=""
            />
          </td>

          <td class="stampable" :class="{ ['bg-' + g.cost.status]: g.stampVisible.cost }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayCost(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.cost }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.cost"
              :src="STAMP_IMAGES[g.cost.status]"
              class="stamp-img"
              :class="{ 'stamp-img-arrow': g.cost.status === 'higher' || g.cost.status === 'lower' }"
              :style="{ '--stamp-rot': g.stampRotation.cost + 'deg' }"
              alt=""
            />
          </td>

          <td class="stampable" :class="{ ['bg-' + g.war.status]: g.stampVisible.war }">
            <span class="cell-text">
              <span
                v-for="(c, i) in charsOf(displayWar(g))"
                :key="i"
                class="type-char"
                :class="{ visible: i < g.revealCount.war }"
              >{{ c }}</span>
            </span>
            <img
              v-if="g.stampVisible.war"
              :src="STAMP_IMAGES[g.war.status]"
              class="stamp-img"
              :class="{ 'stamp-img-arrow': g.war.status === 'higher' || g.war.status === 'lower' }"
              :style="{ '--stamp-rot': g.stampRotation.war + 'deg' }"
              alt=""
            />
          </td>
        </tr>
      </tbody>
    </table>

  </section>

  <section>
    <h2>{{ $t('classic.legend_title') }}</h2>
    <div class="legende">
      <p><span class="legend-symbol" style="background-color: rgba(46, 125, 50, 0.6);"></span> {{ $t('classic.legend.correct') }}</p>
      <p><span class="legend-symbol" style="background-color: rgba(249, 168, 37, 0.6);"></span> {{ $t('classic.legend.partial') }}</p>
      <p><span class="legend-symbol" style="background-color: rgba(157, 44, 44, 0.8);"></span> {{ $t('classic.legend.wrong') }}</p>
      <p><span class="legend-symbol" style="background-color: rgba(120, 120, 120, 0.6);"></span> {{ $t('classic.legend.unknown') }}</p>
      <p>{{ $t('classic.legend.arrows') }}</p>
    </div>
  </section>
</template>

<style scoped>
p{
  margin: 0;
}

thead th{
  position: relative;
  cursor: help;
}

thead th::after{
  content: attr(data-tooltip);
  position: absolute;
  bottom: 120%;
  left: 50%;
  transform: translateX(-50%);
  max-width: 250px;
  min-width: 200px;
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
  background: var(--dark-color);
  color: var(--light-color);
  padding: 6px 10px;
  font-size: 14px;
  opacity: 0;
  pointer-events: none;
}

thead th:hover::after{
  opacity: 1;
}

.search-section{
  display: flex;
  gap: 5px;
  height: 40px;
}

.search-section h2 {
  margin: 0;
  align-self: center;
}

.search-bar {
  display: flex;
  width: 100%;
  gap: 2px;
  position: relative;
}

.search-bar input {
  flex: 1;
  padding: 5px 10px ;
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

.win-message {
  display: flex;
  flex-direction: column;
  font-weight: bold;
  gap: 10px;
}

.new-game-btn {
  padding: 10px;
  cursor: pointer;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

.new-game-btn:hover {
  background: var(--light-color);
}

.give-up-btn {
  padding: 10px;
  cursor: pointer;
  background: #592727;
  color: var(--light-color);
  border: 1px solid var(--dark-color);
  align-self: flex-start;
}

.give-up-btn:hover {
  background: #471F1F;
}

.give-up-message {
  color: rgba(157, 44, 44, 0.9);
}

.unlock-hint {
  font-size: 13px;
  color: var(--text-color);
  margin: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

table tbody *{
  font-family: Typewriter;
  color: var(--dark-color);
}

th, td {
  border: 1px solid #444;
  padding: 8px;
  text-align: center;
}

table tr > *:first-child{
  border-left: none;
  background: var(--darker-color);
  color: var(--light-color);
}

table tbody tr > *:first-child{
  width: 70px;
  height: 70px;
  padding: 5px;
}

table tbody tr > td.colonial:first-child {
  background: var(--dark-colonial-color);
}
table tbody tr > td.warden:first-child {
  background: var(--dark-warden-color);
}
table tbody tr > td.no-fac:first-child {
  background: var(--dark-nofac-color);
}

.cell-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

table *:last-child{
  border-right: none;
}

.win-row {
  outline: 2px solid gold;
}

.bg-correct  { background-color: rgba(46, 125, 50, 0.2); }
.bg-partial  { background-color: rgba(249, 168, 37, 0.2); }
.bg-wrong    { background-color: rgba(107, 44, 44, 0.2); }
.bg-higher   { background-color: rgba(107, 44, 44, 0.2); }
.bg-lower    { background-color: rgba(107, 44, 44, 0.2); }
.bg-unknown  { background-color: rgba(120, 120, 120, 0.2); }
.bg-locked   { background-color: rgba(120, 120, 120, 0.6); }

.arrow {
  font-weight: bold;
}

.legende {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  line-height: 1.8;
}

.legende p {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
}

.legend-symbol {
  display: inline-block;
  height: 1em;
  width: 1em;
  background-color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

/* ------------------------------------------------------------------
   ANIMATION IMAGE (colonne Image) : "badge qui tombe"
------------------------------------------------------------------- */
.cell-img-anim {
  animation: badge-drop 0.45s cubic-bezier(0.25, 0.8, 0.4, 1) both;
}

@keyframes badge-drop {
  0%   { opacity: 0; transform: translateY(-45px) scale(1.6) rotate(-18deg); }
  60%  { opacity: 1; transform: translateY(4px) scale(0.95) rotate(3deg); }
  100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
}

/* ------------------------------------------------------------------
   ANIMATION TEXTE : "machine à écrire", pilotée par Vue/JS.
------------------------------------------------------------------- */
.type-char {
  display: inline-block;
  opacity: 0;
}

.type-char.visible {
  opacity: 1;
  animation: char-pop 0.09s ease-out;
}

@keyframes char-pop {
  0%   { transform: scale(1.8); }
  60%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.stampable {
  position: relative;
  transition: background-color 0.3s ease-out;
}

.cell-text {
  position: relative;
  z-index: 1;
}

.stamp-img {
  --stamp-rot: 0deg;
  position: absolute;
  inset: 0;
  margin: auto;
  width: 80%;
  max-width: 90px;
  height: auto;
  opacity: 0.55;
  mix-blend-mode: multiply;
  pointer-events: none;
  z-index: 2;
  animation: stamp-drop 0.4s cubic-bezier(0.25, 0.8, 0.4, 1) both;
}

.stamp-img-arrow {
  width: 45%;
  max-width: 45px;
}

@keyframes stamp-drop {
  0%   { opacity: 0;    transform: translateY(-70px) scale(2)    rotate(0deg); }
  55%  { opacity: 0.55; transform: translateY(6px)   scale(0.9)  rotate(var(--stamp-rot)); }
  100% { opacity: 0.55; transform: translateY(0)      scale(1)    rotate(var(--stamp-rot)); }
}

@media (prefers-reduced-motion: reduce) {
  .cell-img-anim { animation: none; }
  .type-char.visible { animation: none; }
  .stamp-img { animation: none; opacity: 0.55; }
}
</style>