<script setup>
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();

function isCurrentSection(section) {
  return (
    route.path === `/${section}` ||
    (route.path.startsWith(`/${section}/`) && route.path !== `/${section}/novo`)
  );
}
</script>

<template>
  <nav aria-label="Menu da PetSchool">
    <div class="nav flex-column nav-pills gap-1">
      <RouterLink
        class="nav-link section-link"
        :class="{ active: isCurrentSection('pets') }"
        :aria-current="isCurrentSection('pets') ? 'page' : undefined"
        active-class=""
        to="/pets"
      >
        <i
          class="bi bi-heart me-2"
          aria-hidden="true"
        ></i>
        Pets
      </RouterLink>

      <RouterLink
        class="nav-link create-link"
        exact-active-class="active"
        active-class=""
        to="/pets/novo"
      >
        <i
          class="bi bi-plus-circle me-2"
          aria-hidden="true"
        ></i>
        Novo pet
      </RouterLink>

      <RouterLink
        class="nav-link section-link"
        :class="{ active: isCurrentSection('tutores') }"
        :aria-current="isCurrentSection('tutores') ? 'page' : undefined"
        active-class=""
        to="/tutores"
      >
        <i
          class="bi bi-people me-2"
          aria-hidden="true"
        ></i>
        Tutores
      </RouterLink>

      <RouterLink
        class="nav-link create-link"
        exact-active-class="active"
        active-class=""
        to="/tutores/novo"
      >
        <i
          class="bi me-2"
          :class="
            route.path === '/tutores/novo' ? 'bi-people' : 'bi-plus-circle'
          "
          aria-hidden="true"
        ></i>
        Novo tutor
      </RouterLink>

      <RouterLink
        class="nav-link section-link"
        exact-active-class="active"
        active-class=""
        to="/reservas"
      >
        <i
          class="bi bi-calendar-check me-2"
          aria-hidden="true"
        ></i>
        Reservas
      </RouterLink>
    </div>
  </nav>
</template>
