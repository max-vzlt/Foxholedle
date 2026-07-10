<script setup>
import { ref, computed } from 'vue'
import allItems from '../data/foxholedle_classic_pool.json'

// ------------------------------------------------------------------
// TABLE DE RÉFÉRENCE War <-> Update
// ------------------------------------------------------------------
const UPDATE_TO_WAR_REFERENCE = {
  "1.64": 135, "1.63": 132, "1.62": 127, "1.61": 126, "1.60": 123,
  "1.59": 119, "1.58": 116, "1.57": 115, "1.56": 112, "1.55": 109,
  "1.54": 108, "1.53": 105, "1.52": 102, "1.51": 99,  "1.50": 96,
  "0.49": 92,  "0.48": 89,  "0.47": 86,  "0.46": 83,  "0.45": 80,
  "0.44": 77,  "0.43": 75,  "0.42": 71,  "0.41": 67,  "0.40": 65,
  "0.39": 63,  "0.38": 61,  "0.37": 59,  "0.36": 54,  "0.35": 52,
  "0.34": 50,  "0.33": 49,  "0.32": 45,  "0.31": 43,  "0.30": 41,
  "0.29": 38,  "0.28": 35,  "0.27": 33,  "0.26": 30,  "0.25": 25,
  "0.24": 24,  "0.23": 23,  "0.22": 22,  "0.21": 21,  "0.20": 19,
  "0.19": 18,  "0.18": 17,  "0.17": 15,  "0.16": 14,  "0.15": 12,
  "0.14": 10,  "0.13": 8,   "0.12": 6,   "0.11": 3,   "0.10": 1,
}

// Tableau trié par War croissant, pour retrouver l'update en vigueur
// à un War donné (recherche du dernier seuil <= warNum).
const WAR_THRESHOLDS = Object.entries(UPDATE_TO_WAR_REFERENCE)
  .map(([version, war]) => ({ version, war: Number(war) }))
  .sort((a, b) => a.war - b.war)

function warToUpdate(warNum) {
  let current = WAR_THRESHOLDS[0]
  for (const entry of WAR_THRESHOLDS) {
    if (entry.war <= warNum) current = entry
    else break
  }
  return current.version
}

// ------------------------------------------------------------------
// DONNÉES / POOL
// ------------------------------------------------------------------
const pool = allItems.filter(
  i => i.timeline_eligible === true && Array.isArray(i.war_added) && typeof i.war_added[0] === 'number'
)

// Bornes du slider : on englobe à la fois la table de référence et
// les War réels présents dans le pool, pour être sûr de tout couvrir.
const poolWars = pool.map(i => i.war_added[0])
const minWar = Math.min(WAR_THRESHOLDS[0].war, ...poolWars)
const maxWar = Math.max(WAR_THRESHOLDS[WAR_THRESHOLDS.length - 1].war, ...poolWars)

// ------------------------------------------------------------------
// RÉSOLUTION DES IMAGES (même pattern que les autres modes)
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

// ------------------------------------------------------------------
// SÉLECTION ALÉATOIRE DES 5 ROUNDS (Fisher-Yates, sans répétition)
// ------------------------------------------------------------------
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TOTAL_ROUNDS = 5

function pickRoundItems() {
  const shuffled = shuffle(pool)
  return shuffled.slice(0, Math.min(TOTAL_ROUNDS, shuffled.length))
}

// ------------------------------------------------------------------
// SCORE EN CLOCHE (gaussienne) — 200 points max par round, 1000 au total
// sigma contrôle la "largeur" de la cloche : à ajuster si besoin (plus grand = plus large)
// ------------------------------------------------------------------
const MAX_ROUND_SCORE = 200
const SIGMA = 6

function bellScore(distance) {
  const raw = MAX_ROUND_SCORE * Math.exp(-(distance ** 2) / (2 * SIGMA ** 2))
  return Math.round(raw)
}

// ------------------------------------------------------------------
// ÉTAT DE LA PARTIE
// ------------------------------------------------------------------
const poolIsEmpty = pool.length === 0

const roundItems = ref(pickRoundItems())
const roundIndex = ref(0)
const currentItem = computed(() => roundItems.value[roundIndex.value])

const midWar = Math.round((minWar + maxWar) / 2)
const guessValue = ref(midWar)
const submitted = ref(false)
const roundResults = ref([]) // { item, guess, actual, actualUpdate, distance, score }
const gameOver = ref(false)

const isLastRound = computed(() => roundIndex.value === roundItems.value.length - 1)
const totalScore = computed(() => roundResults.value.reduce((sum, r) => sum + r.score, 0))
const guessUpdateLabel = computed(() => warToUpdate(guessValue.value))

function guessMarkerPercent(value) {
  return ((value - minWar) / (maxWar - minWar)) * 100
}

// ------------------------------------------------------------------
// COURBE DE SCORE (visualisation de la gaussienne au-dessus de la frise)
// ------------------------------------------------------------------
const CURVE_HEIGHT = 50 // hauteur du viewBox SVG
const sigmaPercent = computed(() => (SIGMA / (maxWar - minWar)) * 100)

function gaussianValue(x, mu, sigma) {
  return Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))
}

const lastResult = computed(() => roundResults.value[roundResults.value.length - 1] || null)

const lastActualPercent = computed(() => lastResult.value ? guessMarkerPercent(lastResult.value.actual) : 0)
const lastGuessPercent = computed(() => lastResult.value ? guessMarkerPercent(lastResult.value.guess) : 0)

const curvePathD = computed(() => {
  if (!lastResult.value) return ''
  const mu = lastActualPercent.value
  const sigma = sigmaPercent.value
  const steps = 100
  const points = []
  for (let i = 0; i <= steps; i++) {
    const x = i
    const g = gaussianValue(x, mu, sigma)
    const y = CURVE_HEIGHT - g * CURVE_HEIGHT
    points.push(`${x},${y.toFixed(2)}`)
  }
  return 'M' + points.join(' L')
})

const lastGuessCurveY = computed(() => {
  if (!lastResult.value) return CURVE_HEIGHT
  const g = gaussianValue(lastGuessPercent.value, lastActualPercent.value, sigmaPercent.value)
  return CURVE_HEIGHT - g * CURVE_HEIGHT
})

// Position en % (pour un positionnement HTML absolu, non déformable,
// contrairement à un <circle> SVG étiré par preserveAspectRatio="none")
const lastGuessCurveYPercent = computed(() => (lastGuessCurveY.value / CURVE_HEIGHT) * 100)

function submitGuess() {
  if (submitted.value) return
  const actual = currentItem.value.war_added[0]
  const distance = Math.abs(guessValue.value - actual)
  const score = bellScore(distance)
  roundResults.value.push({
    item: currentItem.value,
    guess: guessValue.value,
    actual,
    actualUpdate: currentItem.value.war_added[1],
    distance,
    score,
  })
  submitted.value = true
}

function nextRound() {
  if (!isLastRound.value) {
    roundIndex.value++
    guessValue.value = midWar
    submitted.value = false
  } else {
    gameOver.value = true
  }
}

function resetGame() {
  roundItems.value = pickRoundItems()
  roundIndex.value = 0
  guessValue.value = midWar
  submitted.value = false
  roundResults.value = []
  gameOver.value = false
}
</script>

<template>
  <h1 class="page-title">{{ $t('timeline.title') }}</h1>
  <section class="main-minigame">
    <h2>{{ $t('timeline.explanation_title') }}</h2>
    <p>{{ $t('timeline.explanation_1') }}</p>
    <hr>

    <p v-if="poolIsEmpty" class="no-data-message">
      {{ $t('timeline.no_data') }}
    </p>

    <template v-else-if="!gameOver">
      <p class="round-indicator">
        {{ $t('timeline.round_label', { current: roundIndex + 1, total: roundItems.length }) }}
      </p>

      <div class="image-container">
        <img :src="resolveImage(currentItem.image)" :alt="currentItem.name">
      </div>
      <p class="item-name">{{ currentItem.name }}</p>

      <div v-if="!submitted" class="slider-section">
        <p class="slider-label">
          {{ $t('timeline.slider_label', { war: guessValue, update: guessUpdateLabel }) }}
        </p>
        <input
          type="range"
          class="war-slider"
          :min="minWar"
          :max="maxWar"
          step="1"
          v-model.number="guessValue"
        >
      </div>

      <button
        v-if="!submitted"
        type="button"
        class="validate-btn"
        @click="submitGuess"
      >
        {{ $t('timeline.validate_button') }}
      </button>

      <div v-if="submitted" class="round-result">
        <p class="result-text">
          {{ $t('timeline.result_text', {
            actual: roundResults[roundResults.length - 1].actual,
            update: roundResults[roundResults.length - 1].actualUpdate,
          }) }}
        </p>
        <p class="result-score">
          {{ $t('timeline.result_score', { score: roundResults[roundResults.length - 1].score }) }}
        </p>

        <div class="curve-container">
          <svg viewBox="0 0 100 50" preserveAspectRatio="none" class="score-curve">
            <path :d="curvePathD" class="curve-line" vector-effect="non-scaling-stroke" />
            <line
              :x1="lastActualPercent" y1="0" :x2="lastActualPercent" y2="50"
              class="curve-peak-line" vector-effect="non-scaling-stroke"
            />
            <line
              :x1="lastGuessPercent" :y1="50" :x2="lastGuessPercent" :y2="lastGuessCurveY"
              class="curve-guess-line" vector-effect="non-scaling-stroke"
            />
          </svg>
          <div
            class="curve-guess-dot"
            :style="{ left: lastGuessPercent + '%', top: lastGuessCurveYPercent + '%' }"
          ></div>
        </div>

        <div class="timeline-track">
          <div
            class="timeline-marker guess"
            :style="{ left: guessMarkerPercent(roundResults[roundResults.length - 1].guess) + '%' }"
          >
            <span>{{ $t('timeline.marker_guess') }}</span>
          </div>
          <div
            class="timeline-marker actual"
            :style="{ left: guessMarkerPercent(roundResults[roundResults.length - 1].actual) + '%' }"
          >
            <span>{{ $t('timeline.marker_actual') }}</span>
          </div>
        </div>

        <button type="button" class="new-game-btn" @click="nextRound">
          {{ isLastRound ? $t('timeline.see_final_score') : $t('timeline.next_round') }}
        </button>
      </div>
    </template>

    <template v-else>
      <h2 class="final-score-title">
        {{ $t('timeline.final_score_title', { score: totalScore }) }}
      </h2>

      <ul class="results-history">
        <li v-for="(r, i) in roundResults" :key="i">
          <img :src="resolveImage(r.item.image)" :alt="r.item.name" class="results-history-img">
          <span class="results-history-name">{{ r.item.name }}</span>
          <span class="results-history-detail">
            {{ $t('timeline.result_detail', { guess: r.guess, actual: r.actual, update: r.actualUpdate }) }}
          </span>
          <span class="results-history-score">{{ r.score }} pts</span>
        </li>
      </ul>

      <button type="button" class="new-game-btn" @click="resetGame">
        {{ $t('timeline.new_game') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
p {
  margin: 0;
}

button {
  display: block;
  margin: 0;
  width: fit-content;
}

.round-indicator {
  font-weight: bold;
  margin-bottom: 12px;
}

.no-data-message {
  text-align: center;
  font-weight: bold;
  padding: 20px;
}

.image-container {
  background-color: var(--dark-color);
  border-radius: 50%;
  box-shadow: 3px 3px 6px 4px rgba(41, 41, 41, 0.2);
  aspect-ratio: 1/1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;
  padding: 40px;
  margin: 0 auto;
}

.image-container img {
  display: flex;
  width: 200px;
}

.item-name {
  text-align: center;
  font-weight: bold;
  font-size: 20px;
  margin-top: 10px;
}

.slider-section {
  margin-top: 20px;
}

.slider-label {
  text-align: center;
  font-weight: bold;
  margin-bottom: 8px;
}

.war-slider {
  width: 100%;
  accent-color: var(--dark-color);
}

.validate-btn {
  margin: 16px auto 0;
  padding: 10px 20px;
  cursor: pointer;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

.validate-btn:hover {
  background: var(--light-color);
}

.round-result {
  margin-top: 20px;
  text-align: center;
}

.result-text {
  font-weight: bold;
}

.result-score {
  margin-top: 6px;
  font-size: 18px;
  font-weight: bold;
  color: rgba(46, 125, 50, 0.9);
}

.curve-container {
  position: relative;
  margin: 30px 10px 20px;
  height: 60px;
}

.score-curve {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.curve-line {
  fill: none;
  stroke: #37527C;
  stroke-width: 1.5;
}

.curve-peak-line {
  stroke: #9F4646;
  stroke-width: 1;
  stroke-dasharray: 3 2;
}

.curve-guess-line {
  stroke: #9F7D46;
  stroke-width: 1;
  stroke-dasharray: 3 2;
}

.curve-guess-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9F7D46;
  border: 1.5px solid var(--dark-color);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.timeline-track {
  position: relative;
  height: 6px;
  background: var(--dark-color);
  margin: 4px 10px 40px;
}

.timeline-marker {
  position: absolute;
  top: -6px;
  transform: translateX(-50%);
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--dark-color);
}

.timeline-marker span {
  position: absolute;
  top: 22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
}

.timeline-marker.guess {
  background: #9F7D46;
}

.timeline-marker.actual {
  background: #9F4646;
}

.new-game-btn {
  margin: 20px auto 0;
  padding: 10px 20px;
  cursor: pointer;
  background: var(--lighter-color);
  color: var(--dark-color);
  border: 1px solid var(--dark-color);
}

.new-game-btn:hover {
  background: var(--light-color);
}

.final-score-title {
  text-align: center;
}

.results-history {
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.results-history li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background-color: var(--darker-color);
  color: var(--light-color);
}

.results-history-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.results-history-name {
  font-weight: bold;
  flex: 0 0 auto;
  min-width: 300px;
}

.results-history-detail {
  flex: 1;
  font-size: 14px;
}

.results-history-score {
  font-weight: bold;
}
</style>