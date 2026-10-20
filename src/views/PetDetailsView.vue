<script setup>
import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiRequest } from '@/services/api';

const route = useRoute();
const pet = ref(null);
const tutor = ref(null);
const carregando = ref(true);
const erro = ref('');
const erroTutor = ref('');
const naoEncontrado = ref(false);
let consultaAtual = 0;

async function carregarPet() {
  const consulta = ++consultaAtual;
  const idPet = route.params.id;
  carregando.value = true;
  erro.value = '';
  erroTutor.value = '';
  naoEncontrado.value = false;
  pet.value = null;
  tutor.value = null;

  try {
    const petConsultado = await apiRequest(
      `/pets/${encodeURIComponent(idPet)}`,
    );
    if (consulta !== consultaAtual) return;
    pet.value = petConsultado;

    if (
      petConsultado.tutorId !== '' &&
      petConsultado.tutorId !== null &&
      petConsultado.tutorId !== undefined
    ) {
      try {
        const tutorConsultado = await apiRequest(
          `/tutores/${encodeURIComponent(petConsultado.tutorId)}`,
        );
        if (consulta !== consultaAtual) return;
        tutor.value = tutorConsultado;
      } catch (falha) {
        if (consulta !== consultaAtual) return;
        erroTutor.value =
          falha.status === 404
            ? 'O tutor vinculado a este pet não foi encontrado.'
            : 'Não foi possível consultar o tutor. Tente novamente.';
      }
    }
  } catch (falha) {
    if (consulta !== consultaAtual) return;
    naoEncontrado.value = falha.status === 404;
    if (!naoEncontrado.value) {
      erro.value =
        'Não foi possível carregar o pet. Verifique a conexão com o servidor e tente novamente.';
    }
  } finally {
    if (consulta === consultaAtual) carregando.value = false;
  }
}

watch(() => route.params.id, carregarPet, { immediate: true });
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Detalhes do Pet</h1>
        <p>Visualize os dados do pet e seu tutor.</p>
      </div>
      <RouterLink
        class="btn btn-outline-primary"
        to="/pets"
      >
        <i
          class="bi bi-arrow-left me-2"
          aria-hidden="true"
        ></i
        >Voltar para Pets
      </RouterLink>
    </header>

    <div
      v-if="carregando"
      class="py-4 text-body-secondary"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      ></span>
      Carregando pet...
    </div>
    <div
      v-else-if="naoEncontrado"
      class="alert alert-warning"
      role="alert"
    >
      Pet não encontrado. O cadastro pode ter sido removido.
    </div>
    <div
      v-else-if="erro"
      class="alert alert-danger"
      role="alert"
    >
      {{ erro }}
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        @click="carregarPet"
      >
        Tentar novamente
      </button>
    </div>
    <template v-else-if="pet">
      <div
        v-if="erroTutor"
        class="alert alert-warning"
        role="alert"
      >
        {{ erroTutor }}
        <button
          class="btn btn-sm btn-outline-secondary ms-2"
          @click="carregarPet"
        >
          Tentar novamente
        </button>
      </div>
      <div class="card">
        <h2 class="card-header h5 mb-0">Informações do Pet</h2>
        <div class="card-body">
          <dl class="row g-3 mb-0">
            <div class="col-sm-6 col-lg-3">
              <dt>ID</dt>
              <dd class="mb-0">{{ pet.id }}</dd>
            </div>
            <div class="col-sm-6 col-lg-3">
              <dt>Nome do Pet</dt>
              <dd class="mb-0">{{ pet.nome }}</dd>
            </div>
            <div class="col-sm-6 col-lg-3">
              <dt>Espécie</dt>
              <dd class="mb-0">{{ pet.especie }}</dd>
            </div>
            <div class="col-sm-6 col-lg-3">
              <dt>Tutor</dt>
              <dd class="mb-0">
                <RouterLink
                  v-if="tutor"
                  :to="`/tutores/${tutor.id}`"
                  >{{ tutor.nome }}</RouterLink
                >
                <span
                  v-else
                  class="text-body-secondary"
                >
                  {{
                    erroTutor ? 'Tutor indisponível' : 'Nenhum tutor vinculado'
                  }}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </template>
  </section>
</template>
