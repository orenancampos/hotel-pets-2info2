import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
  ],
});

export default router;
