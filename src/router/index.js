import { createRouter, createWebHistory } from 'vue-router'
import ClassicMode from '../components/ClassicMode.vue'
import ReconMode from '../components/ReconMode.vue'
import ArmoryMode from '../components/ArmoryMode.vue'
import ExadleMode from '../components/ExadleMode.vue'
import TimelineMode from '../components/TimelineMode.vue'
import CityguessrMode from '../components/CityguessrMode.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'classic', component: ClassicMode },
    { path: '/recon', name: 'recon', component: ReconMode },
    { path: '/armory', name: 'armory', component: ArmoryMode },
    { path: '/exadle', name: 'exadle', component: ExadleMode },
    { path: '/timeline', name: 'timeline', component: TimelineMode },
    { path: '/cityguessr', name: 'cityguessr', component: CityguessrMode },
  ],
})

export default router