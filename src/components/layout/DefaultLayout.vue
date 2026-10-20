<script setup>
import { RouterView } from 'vue-router';
import AppNavbar from '@/components/layout/AppNavbar.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';
</script>

<template>
  <a
    class="visually-hidden-focusable skip-link"
    href="#conteudo"
    >Ir para o conteúdo</a
  >
  <AppNavbar />

  <div class="app-layout">
    <aside class="app-sidebar">
      <AppSidebar />
    </aside>

    <main
      id="conteudo"
      class="app-content"
    >
      <RouterView />
    </main>
  </div>
</template>
