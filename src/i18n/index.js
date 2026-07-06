import { createI18n } from 'vue-i18n'
import fr from './locales/fr.json'
import en from './locales/en.json'
import de from './locales/de.json'

// legacy: false => on utilise l'API Composition (useI18n() dans <script setup>)
// plutôt que this.$t() de l'API Options.
const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('foxholedle-lang') || 'fr',
  fallbackLocale: 'fr',
  messages: { fr, en, de},
})

export default i18n