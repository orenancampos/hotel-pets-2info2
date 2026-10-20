<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { apiRequest } from '@/services/api';
import { correspondeBusca, correspondeTutor } from '@/utils/filtros';

const pets = ref([]);
const tutores = ref([]);
const carregando = ref(true);
const erro = ref('');
const erroExclusao = ref('');
const removendoId = ref(null);
const pesquisa = ref('');

const tutoresPorId = computed(
  () => new Map(tutores.value.map((tutor) => [String(tutor.id), tutor])),
);
const petsFiltrados = computed(() =>
  pets.value.filter(
    (pet) =>
      correspondeBusca(pesquisa.value, pet.nome) ||
      correspondeTutor(pesquisa.value, tutorDoPet(pet.tutorId)),
  ),
);

function limparPesquisa() {
  pesquisa.value = '';
}

async function carregarDados() {
  carregando.value = true;
  erro.value = '';

  try {
    const [listaPets, listaTutores] = await Promise.all([
      apiRequest('/pets'),
      apiRequest('/tutores'),
    ]);
    pets.value = listaPets;
    tutores.value = listaTutores;
  } catch {
    erro.value =
      'Não foi possível carregar os pets. Verifique a conexão com o servidor e tente novamente.';
  } finally {
    carregando.value = false;
  }
}

function tutorDoPet(tutorId) {
  return tutoresPorId.value.get(String(tutorId));
}

async function excluirPet(id) {
  if (removendoId.value !== null) return;
  if (!window.confirm('Deseja realmente excluir o pet?')) return;

  removendoId.value = id;
  erroExclusao.value = '';

  try {
    await apiRequest(`/pets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    pets.value = pets.value.filter((pet) => String(pet.id) !== String(id));
  } catch (falha) {
    erroExclusao.value =
      falha?.status === 409
        ? falha.message
        : 'Não foi possível excluir o pet. Tente novamente.';
  } finally {
    removendoId.value = null;
  }
}

onMounted(carregarDados);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Listagem de Pets</h1>
        <p>Consulte os pets cadastrados e seus tutores.</p>
      </div>
      <RouterLink
        class="btn btn-primary"
        to="/pets/novo"
      >
        <i
          class="bi bi-plus-lg me-2"
          aria-hidden="true"
        ></i
        >Novo pet
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
      Carregando pets...
    </div>
    <div
      v-else-if="erro"
      class="alert alert-danger"
      role="alert"
    >
      {{ erro }}
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        @click="carregarDados"
      >
        Tentar novamente
      </button>
    </div>
    <template v-else>
      <div class="list-filters">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-sm-9">
            <label
              class="form-label"
              for="pesquisa-pet"
              >Pesquisar por nome, CPF ou telefone</label
            >
            <input
              id="pesquisa-pet"
              v-model="pesquisa"
              class="form-control"
              type="search"
              placeholder="Nome do pet ou tutor, CPF ou telefone"
              aria-controls="tabela-pets"
            />
          </div>
          <div class="col-12 col-sm-auto">
            <button
              id="limpar-pesquisa-pets"
              class="btn btn-outline-secondary w-100"
              type="button"
              :disabled="!pesquisa"
              @click="limparPesquisa"
            >
              Limpar pesquisa
            </button>
          </div>
        </div>
      </div>
      <div
        v-if="erroExclusao"
        class="alert alert-danger"
        role="alert"
      >
        {{ erroExclusao }}
      </div>
      <div class="table-responsive table-frame">
        <table
          id="tabela-pets"
          class="table table-bordered table-striped table-hover align-middle data-table"
        >
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Nome</th>
              <th scope="col">Espécie</th>
              <th scope="col">Tutor</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pet in petsFiltrados"
              :key="pet.id"
            >
              <td>{{ pet.id }}</td>
              <td>{{ pet.nome }}</td>
              <td>{{ pet.especie }}</td>
              <td>
                <RouterLink
                  v-if="tutorDoPet(pet.tutorId)"
                  :to="`/tutores/${pet.tutorId}`"
                >
                  {{ tutorDoPet(pet.tutorId).nome }}
                </RouterLink>
                <span
                  v-else
                  class="text-body-secondary"
                  >Nenhum tutor vinculado</span
                >
              </td>
              <td>
                <div class="d-flex gap-2 flex-wrap">
                  <RouterLink
                    class="btn btn-outline-primary btn-sm"
                    :to="`/pets/${pet.id}`"
                  >
                    <i
                      class="bi bi-eye-fill me-1"
                      aria-hidden="true"
                    ></i
                    >Visualizar
                  </RouterLink>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    :disabled="removendoId !== null"
                    @click="excluirPet(pet.id)"
                  >
                    <i
                      class="bi bi-trash me-1"
                      aria-hidden="true"
                    ></i>
                    {{ removendoId === pet.id ? 'Excluindo...' : 'Excluir' }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="petsFiltrados.length === 0">
              <td
                colspan="5"
                class="text-center text-body-secondary py-4"
              >
                {{
                  pets.length === 0
                    ? 'Nenhum pet cadastrado.'
                    : 'Nenhum pet encontrado para esta pesquisa.'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        class="text-body-secondary border-top mt-3 pt-3 mb-0"
        aria-live="polite"
      >
        Exibindo {{ petsFiltrados.length }} de {{ pets.length }}
        {{ pets.length === 1 ? 'pet' : 'pets' }}
      </p>
    </template>
  </section>
</template>
