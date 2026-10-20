<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <nav
    class="navbar navbar-expand-md navbar-dark bg-success app-navbar"
    aria-label="Navegação principal"
  >
    <div class="container-fluid">
      <RouterLink
        class="navbar-brand fw-semibold"
        to="/pets"
      >
        <i
          class="bi bi-heart-fill me-2"
          aria-hidden="true"
        ></i>
        PetSchool
      </RouterLink>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#petschool-navbar"
        aria-controls="petschool-navbar"
        aria-expanded="false"
        aria-label="Abrir menu principal"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div
        id="petschool-navbar"
        class="collapse navbar-collapse"
      >
        <div class="navbar-nav ms-auto">
          <RouterLink
            class="nav-link"
            to="/pets"
            >Pets</RouterLink
          >
          <RouterLink
            class="nav-link"
            to="/pets/novo"
            >Novo pet</RouterLink
          >
        </div>
      </div>
    </div>
  </nav>
</template>
