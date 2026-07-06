<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
const pool = allItems.filter(i => i.classic_eligible)

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES
// ------------------------------------------------------------------
// Les images réelles vivent dans src/assets/icons/ (donc traitées par
// Vite au build, contrairement à public/). Le JSON ne contient qu'un
// chemin/nom de fichier en dur (ex: "/images/lance-36.png"), qui ne
// pointe vers rien de réel une fois bundlé. import.meta.glob charge
// tous les fichiers du dossier d'un coup et nous donne leurs vraies
// URLs générées par Vite ; on ne garde que le nom de fichier (basename)
// du JSON pour retrouver la bonne image dans cette liste.
const iconModules = import.meta.glob('@/assets/icons/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})
// iconModules ressemble à { '/src/assets/icons/lance-36.png': 'url-résolue-par-vite', ... }

function resolveImage(path) {
  if (!path) return ''
  const filename = path.split('/').pop()
  const found = Object.entries(iconModules).find(([key]) => key.endsWith('/' + filename))
  return found ? found[1] : ''
}

function pickRandomTarget() {
  return pool[Math.floor(Math.random() * pool.length)]
}

// La réponse est tirée au hasard à chaque partie (donc à chaque
// montage du composant, et aussi à chaque clic sur "Nouvelle partie").
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
// À REMPLIR TOI-MÊME avec tes vrais taux d'équivalence.
// Exemple : si tu considères que 1 Rmat "vaut" 20 Bmat, mets Rmat: 20.
// Bmat doit toujours valoir 1 (c'est la référence).
const RESOURCE_TO_BMAT = {
  Bmat: 1,
  Rmat: 20,   // À AJUSTER
  test: 15,   // À AJUSTER
  // Ajoute ici toute autre unité que tu utilises dans "cost"
  // (ex: Cmat: X, Fuel: X, ...)
}

// Parse un tableau ["165-Rmat", "50-Emat"] -> total en équivalent Bmat.
// Retourne null si le coût est absent ou si une unité est inconnue
// (plutôt que de fausser silencieusement la comparaison).
function parseCostToBmat(costArray) {
  if (!costArray || !costArray.length) return null
  let total = 0
  for (const entry of costArray) {
    const [amountStr, unit] = entry.split('-')
    const amount = Number(amountStr)
    const rate = RESOURCE_TO_BMAT[unit]
    if (Number.isNaN(amount) || rate == null) return null // unité inconnue -> on ne devine pas
    total += amount * rate
  }
  return total
}

// ------------------------------------------------------------------
// DÉBLOCAGE PROGRESSIF
// ------------------------------------------------------------------
// Le Rôle est désormais visible dès le début. C'est le Milieu qui est
// verrouillé jusqu'au 3e guess (à la place du Rôle avant).
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

// Compare deux valeurs qui peuvent être soit une string unique, soit un
// tableau de plusieurs valeurs (ex: le Rôle, ou les Munitions quand un
// véhicule a plusieurs armes comme le Bardiche avec 12.7mm + 68mm).
// - 'correct' si les deux ensembles sont rigoureusement identiques
// - 'partial' si au moins une valeur est en commun mais pas toutes
// - 'wrong' si aucune valeur en commun
// - 'unknown' si l'une des deux valeurs est absente/non renseignée
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

// Alias conservé pour le rôle (comportement inchangé, réutilise juste
// la logique générique ci-dessus)
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

function displayFaction(g) { return g.faction.value }
function displayRole(g) { return g.role.value?.join(', ') || '?' }
function displayMilieu(g) { return g.milieu.value || '?' }
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
const STAMP_FALL_DURATION = 400 // doit correspondre à la durée de @keyframes stamp-drop

const TEXT_COLUMNS = ['name', 'faction', 'milieu', 'role', 'ammo', 'cost', 'war']
const STAMP_COLUMNS = ['faction', 'milieu', 'role', 'ammo', 'cost', 'war']

function randomStampAngle() {
  const sign = Math.random() < 0.5 ? -1 : 1
  return sign * (6 + Math.random() * 14)
}

// onComplete (optionnel) est appelé une fois que TOUT est fini d'apparaître :
// tout le texte de la ligne + tous les tampons (y compris leur propre chute).
// C'est ce qu'on utilise pour retarder le message de victoire.
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

// Contrairement à hasWon (vrai dès la soumission, sert à bloquer la
// recherche), winRevealed ne passe à true qu'une fois TOUTE l'animation
// de la ligne gagnante terminée (texte + tampons) — c'est lui qui
// contrôle l'affichage du message de victoire.
const winRevealed = ref(false)

function resetGame() {
  target.value = pickRandomTarget()
  guesses.value = []
  winRevealed.value = false
  searchQuery.value = ''
  showDropdown.value = false
}

function submitGuess(item) {
  if (hasWon.value) return
  const result = buildGuessResult(item)
  guesses.value.unshift(result)
  const reactiveGuess = guesses.value[0] // version réactive, pas la variable locale
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
  <h1 class="page-title">Classic</h1>
  <section class="main-minigame">
    <h2>Explication</h2>
    <p>À partir d'indices et de caractéristiques partagées entre plusieurs objets et véhicules, identifie la bonne réponse et fais les bons choix.</p>
    <hr>
    <div class="search-section">
      <h2>Recherche</h2>
      <div class="search-bar" ref="searchWrapperRef">
        <input
          type="text"
          v-model="searchQuery"
          placeholder="Devine un véhicule, une arme..."
          @focus="openDropdown"
          @input="onSearchInput"
          @keydown.down.prevent="onArrowDown"
          @keydown.up.prevent="onArrowUp"
          @keydown.enter.prevent="onEnter"
          :disabled="hasWon"
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
      🎉 Trouvé : {{ target.name }} !
      <button type="button" class="new-game-btn" @click="resetGame">Nouvelle partie</button>
    </p>

    <p class="unlock-hint">
      Faction {{ factionUnlocked ? 'débloquée' : `débloquée au guess ${FACTION_UNLOCK_AT} (encore ${FACTION_UNLOCK_AT - guesses.length})` }}
      · Milieu {{ milieuUnlocked ? 'débloqué' : `débloqué au guess ${MILIEU_UNLOCK_AT} (encore ${MILIEU_UNLOCK_AT - guesses.length})` }}
    </p>

    <table>
      <thead>
        <tr>
          <th data-tooltip="Images de l'objet/véhicule">Image</th>
          <th data-tooltip="Nom de l'objet/véhicule">Nom</th>
          <th data-tooltip="Faction à laquelle appartient l'objet/véhicule">Faction</th>
          <th data-tooltip="Milieu dans lequel évolue l'objet/véhicule (Terrestre, Aquatique, Aérien)">Milieu</th>
          <th data-tooltip="Rôle de l'objet/véhicule (Combat, Soutien, Logistique, Reconnaissance)">Rôle</th>
          <th data-tooltip="Munition qu'utilise l'objet/véhicule">Munition</th>
          <th data-tooltip="Coût de production, converti en équivalent Bmat (à l'unité et sans MPF)">Coût (Bmat)</th>
          <th data-tooltip="La Guerre de première parution de l'objet/véhicule">War d'ajout</th>
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

          <!-- Milieu : verrouillé jusqu'au 3e guess -->
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

          <!-- Rôle : plus de verrouillage, affiché dès le début -->
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

          <!-- Coût (équivalent Bmat) : même mécanique que War (fond rouge + tampon Higher/Lower) -->
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

          <!-- War d'ajout : fond rouge (bg-higher/bg-lower) + tampon Higher/Lower quand ce n'est pas la bonne War -->
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
    <h2>Légende</h2>
    <div class="legende">
      <p><span class="legend-symbol" style="background-color: rgba(46, 125, 50, 0.6);"></span> Correct</p>
      <p><span class="legend-symbol" style="background-color: rgba(249, 168, 37, 0.6);"></span> Partiellement correct</p>
      <p><span class="legend-symbol" style="background-color: rgba(157, 44, 44, 0.8);"></span> Incorrect / mauvaise War</p>
      <p><span class="legend-symbol" style="background-color: rgba(120, 120, 120, 0.6);"></span> Inconnu / verrouillé</p>
      <p>↑ / ↓ : la bonne War est plus haute / plus basse que ta proposition</p>
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
  width: 35px;
  height: 35px;
  background-image: url("@/assets/Colonial.png");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.dropdown li.warden::before {
  content: "";
  width: 35px;
  height: 35px;
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
  width: 35px;
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