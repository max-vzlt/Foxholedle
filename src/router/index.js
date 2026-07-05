import { createRouter, createWebHistory } from 'vue-router'
import ClassicMode from '../components/ClassicMode.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'classic', component: ClassicMode },
    // { path: '/zoom', name: 'zoom', component: ZoomMode },
    // { path: '/silhouette', name: 'silhouette', component: SilhouetteMode },
  ],
})

export default router