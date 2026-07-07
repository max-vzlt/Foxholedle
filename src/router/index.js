import { createRouter, createWebHistory } from 'vue-router'
import ClassicMode from '../components/ClassicMode.vue'
import ReconMode from '../components/ReconMode.vue'
import ArmoryMode from '../components/ArmoryMode.vue'
import ExaguessrMode from '../components/ExaguessrMode.vue'
import TimelineMode from '../components/TimelineMode.vue'
import CityguessrMode from '../components/CityguessrMode.vue'
import NotFound from '../components/NotFound.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'classic', component: ClassicMode },
    { path: '/recon', name: 'recon', component: ReconMode },
    { path: '/armory', name: 'armory', component: ArmoryMode },
    { path: '/exaguessr', name: 'exaguessr', component: ExaguessrMode },
    { path: '/timeline', name: 'timeline', component: TimelineMode },
    { path: '/cityguessr', name: 'cityguessr', component: CityguessrMode },
    { path: '/:pathMatch(.*)*', name: 'notfound', component: NotFound },
  ],
})

export default router