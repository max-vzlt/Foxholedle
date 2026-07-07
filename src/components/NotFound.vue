<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const randomMessages = ['random1', 'random2', 'random3']

const randomKey =
  randomMessages[Math.floor(Math.random() * 3)]

const randomText = computed(() => t(`notfound.text.` + randomKey))
</script>

<template>
    <section class="not-found">
        <h1>404</h1>
        <p>{{ randomText }}</p>

        <RouterLink to="/">
        {{ $t('notfound.link') }}
        </RouterLink>
    </section>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  margin: auto;
}

h1 {
  font-size: 6rem;
  margin: 0;
  color: var(--dark-color);
}

p {
  margin: 1rem 0 2rem;
  color: var(--dark-color);
}

a{
    color: var(--dark-color);
}

a:hover{
    color: var(--medium-color);
}
</style>