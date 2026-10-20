<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { apiRequest } from '@/services/api';
import { buscarPetsDoTutor } from '@/services/tutores';
import { correspondeTutor } from '@/utils/filtros';
import { formatTelefone, maskCpfCnpj } from '@/utils/tutor';

const tutores = ref([]);
const pets = ref([]);
const carregando = ref(true);
const erro = ref('');
const aviso = ref('');
const excluindoId = ref(null);
const pesquisa = ref('');
const temPesquisa = computed(() => Boolean(pesquisa.value));

function limparPesquisa() {
  pesquisa.value = '';
}

const tutoresFiltrados = computed(() =>
  tutores.value.filter((tutor) => correspondeTutor(pesquisa.value, tutor)),
);

const petsPorTutor = computed(() => {
  const grupos = new Map();

  for (const pet of pets.value) {
    const tutorId = String(pet.tutorId);
    if (!grupos.has(tutorId)) {
      grupos.set(tutorId, []);
    }
    grupos.get(tutorId).push(pet);
  }

  return grupos;
});

function petsDoTutor(tutorId) {
  return petsPorTutor.value.get(String(tutorId)) || [];
}

async function carregarDados() {
  carregando.value = true;
  erro.value = '';

  try {
    const [listaTutores, listaPets] = await Promise.all([
      apiRequest('/tutores'),
      apiRequest('/pets'),
    ]);
    tutores.value = listaTutores;
    pets.value = listaPets;
  } catch {
    erro.value =
      'Não foi possível carregar os tutores e seus pets. Verifique se a API está disponível e tente novamente.';
  } finally {
    carregando.value = false;
  }
}

async function excluirTutor(tutor) {
  if (excluindoId.value !== null) return;

  erro.value = '';
  aviso.value = '';

  if (!window.confirm('Deseja realmente remover este tutor?')) return;

  excluindoId.value = tutor.id;

  try {
    // Consulte a API novamente para incluir vínculos criados após a listagem.
    const petsVinculados = await buscarPetsDoTutor(tutor.id);

    if (petsVinculados.length > 0) {
      pets.value = [
        ...pets.value.filter((pet) => String(pet.tutorId) !== String(tutor.id)),
        ...petsVinculados,
      ];
      aviso.value = `Não é possível remover ${tutor.nome}: há pets vinculados. Remova ou transfira os pets primeiro.`;
      return;
    }

    await apiRequest(`/tutores/${encodeURIComponent(tutor.id)}`, {
      method: 'DELETE',
    });
    tutores.value = tutores.value.filter(
      (item) => String(item.id) !== String(tutor.id),
    );
    pets.value = pets.value.filter(
      (pet) => String(pet.tutorId) !== String(tutor.id),
    );
    aviso.value = 'Tutor removido com sucesso.';
  } catch {
    erro.value =
      'Não foi possível remover o tutor. Verifique se a API está disponível e tente novamente.';
  } finally {
    excluindoId.value = null;
  }
}

onMounted(carregarDados);
</script>

<template>
  <div>
    <header class="page-header tutor-list-header">
      <div>
        <h1>Listagem de Tutores</h1>
        <p>Consulte os tutores cadastrados e seus pets.</p>
      </div>
      <RouterLink
        class="btn btn-primary new-tutor-button"
        to="/tutores/novo"
      >
        <i
          class="bi bi-plus-lg"
          aria-hidden="true"
        ></i>
        Cadastrar Tutor
      </RouterLink>
    </header>

    <div class="list-filters">
      <div class="row g-3 align-items-end">
        <div class="col-12 col-lg-9">
          <label
            for="pesquisa-tutor"
            class="form-label"
            >Pesquisar por nome, CPF ou telefone</label
          >
          <div class="tutor-search">
            <i
              class="bi bi-search"
              aria-hidden="true"
            ></i>
            <input
              id="pesquisa-tutor"
              v-model="pesquisa"
              class="form-control"
              type="search"
              placeholder="Digite o nome, CPF ou telefone do tutor"
              aria-controls="tabela-tutores"
            />
          </div>
        </div>
        <div
          class="col-12 col-lg-3 d-flex align-items-end justify-content-lg-end"
        >
          <button
            id="limpar-pesquisa-tutores"
            class="btn btn-outline-secondary"
            type="button"
            :disabled="!temPesquisa"
            @click="limparPesquisa"
          >
            <i
              class="bi bi-x-circle"
              aria-hidden="true"
            ></i>
            Limpar pesquisa
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="erro"
      class="alert alert-danger"
      role="alert"
    >
      {{ erro }}
      <button
        class="btn btn-outline-danger btn-sm ms-2"
        type="button"
        :disabled="carregando || excluindoId !== null"
        @click="carregarDados"
      >
        Tentar novamente
      </button>
    </div>

    <p
      v-if="aviso"
      class="alert alert-info"
      role="status"
    >
      {{ aviso }}
    </p>

    <p
      v-if="carregando"
      class="text-body-secondary py-3"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      ></span>
      Carregando tutores...
    </p>

    <div
      v-else-if="!erro || tutores.length"
      class="table-frame"
    >
      <div class="table-responsive">
        <table
          id="tabela-tutores"
          class="table table-bordered table-striped table-hover align-middle data-table tutor-table"
        >
          <caption class="visually-hidden">
            Tutores cadastrados e seus pets vinculados
          </caption>
          <colgroup>
            <col style="width: 3.2%" />
            <col style="width: 12.3%" />
            <col style="width: 11.4%" />
            <col style="width: 13.3%" />
            <col style="width: 13.7%" />
            <col style="width: 12.5%" />
            <col style="width: 14.8%" />
            <col style="width: 18.8%" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Nome Completo</th>
              <th scope="col">CPF / CNPJ</th>
              <th scope="col">Telefone / Celular / WhatsApp</th>
              <th scope="col">E-mail</th>
              <th
                scope="col"
                class="text-nowrap"
              >
                Pets (Quantidade)
              </th>
              <th scope="col">Nomes dos Pets</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!tutoresFiltrados.length">
              <td
                colspan="8"
                class="text-center text-body-secondary py-4"
              >
                {{
                  tutores.length
                    ? 'Nenhum tutor encontrado para esta pesquisa.'
                    : 'Nenhum tutor cadastrado.'
                }}
                <button
                  v-if="temPesquisa && tutores.length"
                  class="btn btn-link d-block mx-auto mt-2"
                  type="button"
                  @click="limparPesquisa"
                >
                  Limpar pesquisa
                </button>
              </td>
            </tr>
            <tr
              v-for="tutor in tutoresFiltrados"
              :key="tutor.id"
            >
              <td class="tutor-id">{{ tutor.id }}</td>
              <td>{{ tutor.nome }}</td>
              <td class="text-nowrap">
                {{ maskCpfCnpj(tutor.cpfCnpj) || 'Não informado' }}
              </td>
              <td class="text-nowrap">{{ formatTelefone(tutor.telefone) }}</td>
              <td class="tutor-email">{{ tutor.email || 'Não informado' }}</td>
              <td class="text-center">{{ petsDoTutor(tutor.id).length }}</td>
              <td>
                {{
                  petsDoTutor(tutor.id)
                    .map((pet) => pet.nome)
                    .join(' / ') || 'Nenhum pet vinculado'
                }}
              </td>
              <td>
                <div class="d-flex gap-2">
                  <RouterLink
                    class="btn btn-outline-primary text-nowrap"
                    :to="`/tutores/${encodeURIComponent(tutor.id)}`"
                    :aria-label="`Visualizar tutor ${tutor.nome}`"
                  >
                    <i
                      class="bi bi-eye-fill"
                      aria-hidden="true"
                    ></i>
                    Visualizar
                  </RouterLink>
                  <button
                    class="btn btn-outline-danger text-nowrap"
                    type="button"
                    :disabled="excluindoId !== null"
                    :aria-label="`Remover tutor ${tutor.nome}`"
                    @click="excluirTutor(tutor)"
                  >
                    <span
                      v-if="excluindoId === tutor.id"
                      class="spinner-border spinner-border-sm"
                      aria-hidden="true"
                    ></span>
                    <i
                      v-else
                      class="bi bi-trash"
                      aria-hidden="true"
                    ></i>
                    {{ excluindoId === tutor.id ? 'Removendo...' : 'Remover' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p
      v-if="!carregando && (!erro || tutores.length)"
      class="tutor-list-count"
      role="status"
    >
      Exibindo {{ tutoresFiltrados.length }} de {{ tutores.length }}
      {{ tutores.length === 1 ? 'tutor' : 'tutores' }}
    </p>
  </div>
</template>

<style scoped>
.tutor-list-header {
  padding-top: 12px;
  margin-bottom: 30px;
}

.tutor-list-header h1 {
  font-size: 44px;
}

.tutor-list-header p {
  font-size: 20px;
}

.new-tutor-button {
  min-height: 52px;
  padding-inline: 18px;
  font-size: 18px;
}

.new-tutor-button .bi {
  margin-right: 4px;
  font-size: 22px;
}

.tutor-search {
  position: relative;
  width: 66.666667%;
}

.tutor-search > .bi {
  position: absolute;
  top: 50%;
  left: 16px;
  z-index: 1;
  color: #596273;
  font-size: 20px;
  transform: translateY(-50%);
  pointer-events: none;
}

.tutor-search .form-control {
  min-height: 52px;
  padding-left: 48px;
  font-size: 18px;
}

.tutor-table {
  min-width: 1380px;
  table-layout: fixed;
  font-size: 18px;
}

.tutor-table .btn {
  padding-inline: 10px;
  font-size: 16px;
}

.tutor-table th:nth-child(2),
.tutor-table td:nth-child(2) {
  min-width: 150px;
  white-space: nowrap;
}

.tutor-table th:nth-child(4) {
  min-width: 167px;
}

.tutor-table th:nth-child(7) {
  min-width: 160px;
}

.tutor-id {
  max-width: 110px;
  overflow-wrap: anywhere;
}

.tutor-email {
  white-space: nowrap;
}

.tutor-list-count {
  margin: 16px 0 0;
  padding-top: 16px;
  border-top: 1px solid #e1e6ed;
  color: #667085;
}

@media (max-width: 991.98px) {
  .tutor-search {
    width: 100%;
  }
}

@media (max-width: 767.98px) {
  .tutor-list-header {
    padding-top: 0;
  }

  .tutor-list-header h1 {
    font-size: 30px;
  }

  .tutor-list-header p {
    font-size: 16px;
  }

  .tutor-search .form-control {
    min-height: 46px;
    font-size: 14px;
  }
}
</style>
