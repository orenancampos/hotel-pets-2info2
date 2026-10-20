import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/reservas',
      name: 'reservas',
      component: () => import('../views/ReservasView.vue'),
    },
    {
      path: '/',
      redirect: '/pets',
    },
    {
      path: '/pets',
      name: 'pets',
      component: () => import('../views/PetsView.vue'),
    },
    {
      path: '/pets/novo',
      name: 'novo-pet',
      component: () => import('../views/AddPetView.vue'),
    },
    {
      path: '/pets/:id',
      name: 'detalhes-pet',
      component: () => import('../views/PetDetailsView.vue'),
    },
    {
      path: '/tutores',
      name: 'tutores',
      component: () => import('../views/TutoresView.vue'),
    },
    {
      path: '/tutores/novo',
      name: 'novo-tutor',
      component: () => import('../views/AddTutorView.vue'),
    },
    {
      path: '/tutores/:id',
      name: 'detalhes-tutor',
      component: () => import('../views/TutorDetailsView.vue'),
    },
  ],
});

export default router;
