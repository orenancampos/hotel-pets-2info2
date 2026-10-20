<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { apiRequest } from '@/services/api';
import { buscarPetsDoTutor } from '@/services/tutores';
import { ESPECIES_PET } from '@/utils/pet';
import {
  formatCep,
  formatDataNascimento,
  formatTelefone,
  maskCpfCnpj,
} from '@/utils/tutor';

const route = useRoute();
const tutor = ref(null);
const pets = ref([]);
const carregandoTutor = ref(true);
const carregandoPets = ref(false);
const salvando = ref(false);
const erroTutor = ref('');
const erroPets = ref('');
const erroCadastro = ref('');
const sucessoCadastro = ref('');
const novoPet = ref({ nome: '', especie: '' });
const camposVisitados = ref({ nome: false, especie: false });
let versaoAtual = 0;
let versaoPetsAtual = 0;

const nomeValido = computed(() => novoPet.value.nome.trim().length > 0);
const especieValida = computed(() =>
  ESPECIES_PET.includes(novoPet.value.especie),
);
const formularioValido = computed(
  () => tutor.value !== null && nomeValido.value && especieValida.value,
);

function informado(valor) {
  return String(valor ?? '').trim() || 'Não informado';
}

async function carregarTutor(tutorId, versao) {
  try {
    const dados = await apiRequest(`/tutores/${encodeURIComponent(tutorId)}`);

    if (versao === versaoAtual) {
      if (dados && dados.id !== undefined && dados.id !== null) {
        tutor.value = dados;
      } else {
        erroTutor.value = 'Tutor não encontrado.';
      }
    }
  } catch (erro) {
    if (versao === versaoAtual) {
      erroTutor.value =
        erro.status === 404
          ? 'Tutor não encontrado.'
          : 'Não foi possível carregar o tutor. Confira a conexão e tente novamente.';
    }
  } finally {
    if (versao === versaoAtual) {
      carregandoTutor.value = false;
    }
  }
}

async function carregarPets(tutorId = route.params.id, versao = versaoAtual) {
  const versaoPets = ++versaoPetsAtual;
  carregandoPets.value = true;
  erroPets.value = '';

  try {
    const dados = await buscarPetsDoTutor(tutorId);

    if (versao === versaoAtual && versaoPets === versaoPetsAtual) {
      pets.value = dados;
    }
  } catch {
    if (versao === versaoAtual && versaoPets === versaoPetsAtual) {
      erroPets.value =
        'Não foi possível atualizar os pets deste tutor. Tente novamente.';
    }
  } finally {
    if (versao === versaoAtual && versaoPets === versaoPetsAtual) {
      carregandoPets.value = false;
    }
  }
}

async function carregarDados() {
  const tutorId = route.params.id;
  const versao = ++versaoAtual;

  tutor.value = null;
  pets.value = [];
  carregandoTutor.value = true;
  carregandoPets.value = true;
  salvando.value = false;
  erroTutor.value = '';
  erroPets.value = '';
  erroCadastro.value = '';
  sucessoCadastro.value = '';
  novoPet.value = { nome: '', especie: '' };
  camposVisitados.value = { nome: false, especie: false };

  await Promise.allSettled([
    carregarTutor(tutorId, versao),
    carregarPets(tutorId, versao),
  ]);
}

async function salvarPet() {
  camposVisitados.value = { nome: true, especie: true };

  if (!formularioValido.value || salvando.value) {
    return;
  }

  // Preserva o tipo do identificador retornado pelo JSON Server.
  const tutorId = tutor.value.id;
  const versao = versaoAtual;
  const dadosPet = {
    nome: novoPet.value.nome.trim(),
    especie: novoPet.value.especie,
    tutorId,
  };
  salvando.value = true;
  erroCadastro.value = '';
  sucessoCadastro.value = '';

  try {
    const petCadastrado = await apiRequest('/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dadosPet),
    });

    if (versao !== versaoAtual) {
      return;
    }

    // Mantém o pet confirmado visível mesmo se a atualização da lista falhar.
    if (petCadastrado?.id !== undefined && petCadastrado?.id !== null) {
      pets.value = [
        ...pets.value.filter(
          (pet) => String(pet.id) !== String(petCadastrado.id),
        ),
        petCadastrado,
      ];
    }
    novoPet.value = { nome: '', especie: '' };
    camposVisitados.value = { nome: false, especie: false };
    sucessoCadastro.value = 'Pet cadastrado com sucesso.';
    await carregarPets(tutorId, versao);
  } catch {
    if (versao === versaoAtual) {
      erroCadastro.value =
        'Não foi possível cadastrar o pet. Confira a conexão e tente novamente.';
    }
  } finally {
    if (versao === versaoAtual) {
      salvando.value = false;
    }
  }
}

watch(() => route.params.id, carregarDados, { immediate: true });

onBeforeUnmount(() => {
  versaoAtual += 1;
});
</script>

<template>
  <div class="tutor-details-page">
    <header class="page-header details-page-header">
      <div>
        <h1>Detalhes do Tutor</h1>
        <p class="text-body-secondary mb-0">
          Visualize os dados do tutor e cadastre pets vinculados.
        </p>
      </div>
      <RouterLink
        class="btn btn-outline-primary back-button"
        to="/tutores"
      >
        <i
          class="bi bi-arrow-left"
          aria-hidden="true"
        ></i>
        Voltar para Tutores
      </RouterLink>
    </header>

    <p
      v-if="carregandoTutor"
      class="loading-state"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      ></span>
      Carregando tutor...
    </p>

    <div
      v-else-if="erroTutor"
      class="alert alert-danger"
      role="alert"
    >
      <p class="mb-2">{{ erroTutor }}</p>
      <button
        class="btn btn-outline-danger btn-sm"
        type="button"
        @click="carregarDados"
      >
        Tentar novamente
      </button>
    </div>

    <template v-else-if="tutor">
      <section
        class="card details-card tutor-information"
        aria-labelledby="informacoes-tutor-titulo"
      >
        <h2
          id="informacoes-tutor-titulo"
          class="card-header"
        >
          Informações do Tutor
        </h2>
        <div class="card-body">
          <section
            class="card information-panel"
            aria-labelledby="dados-tutor-titulo"
          >
            <h3
              id="dados-tutor-titulo"
              class="card-header"
            >
              Dados do Tutor
            </h3>
            <dl class="row g-3 information-grid mb-0">
              <div class="col-sm-6 col-lg-4">
                <dt>ID</dt>
                <dd>{{ tutor.id }}</dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Nome Completo</dt>
                <dd>{{ informado(tutor.nome) }}</dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>CPF / CNPJ</dt>
                <dd :class="{ 'text-body-secondary': !tutor.cpfCnpj }">
                  {{ informado(maskCpfCnpj(tutor.cpfCnpj)) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Telefone / Celular / WhatsApp</dt>
                <dd>{{ informado(formatTelefone(tutor.telefone)) }}</dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>E-mail</dt>
                <dd :class="{ 'text-body-secondary': !tutor.email }">
                  {{ informado(tutor.email) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Data de Nascimento</dt>
                <dd :class="{ 'text-body-secondary': !tutor.dataNascimento }">
                  {{ informado(formatDataNascimento(tutor.dataNascimento)) }}
                </dd>
              </div>
            </dl>
          </section>

          <section
            class="card information-panel"
            aria-labelledby="endereco-tutor-titulo"
          >
            <h3
              id="endereco-tutor-titulo"
              class="card-header"
            >
              Endereço
            </h3>
            <dl class="row g-3 information-grid mb-0">
              <div class="col-sm-6 col-lg-4">
                <dt>Rua</dt>
                <dd :class="{ 'text-body-secondary': !tutor.rua }">
                  {{ informado(tutor.rua) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Número</dt>
                <dd :class="{ 'text-body-secondary': !tutor.numero }">
                  {{ informado(tutor.numero) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Bairro</dt>
                <dd :class="{ 'text-body-secondary': !tutor.bairro }">
                  {{ informado(tutor.bairro) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Cidade</dt>
                <dd :class="{ 'text-body-secondary': !tutor.cidade }">
                  {{ informado(tutor.cidade) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>Estado</dt>
                <dd :class="{ 'text-body-secondary': !tutor.estado }">
                  {{ informado(tutor.estado?.toUpperCase()) }}
                </dd>
              </div>
              <div class="col-sm-6 col-lg-4">
                <dt>CEP</dt>
                <dd :class="{ 'text-body-secondary': !tutor.cep }">
                  {{ informado(formatCep(tutor.cep)) }}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </section>

      <section
        class="card details-card tutor-pets"
        aria-labelledby="pets-tutor-titulo"
      >
        <h2
          id="pets-tutor-titulo"
          class="card-header"
        >
          Pets do Tutor
        </h2>
        <div class="card-body">
          <div class="row g-3 pet-panels">
            <div class="col-lg-6 linked-pets-column">
              <section
                class="card linked-pets-panel h-100"
                aria-labelledby="pets-vinculados-titulo"
                :aria-busy="carregandoPets"
              >
                <div class="card-header d-flex align-items-center gap-2">
                  <h3
                    id="pets-vinculados-titulo"
                    class="mb-0"
                  >
                    Pets vinculados
                  </h3>
                  <span class="badge rounded-pill text-bg-primary">
                    {{ pets.length }} {{ pets.length === 1 ? 'pet' : 'pets' }}
                  </span>
                </div>

                <p
                  v-if="carregandoPets"
                  class="loading-state m-3"
                  role="status"
                >
                  <span
                    class="spinner-border spinner-border-sm me-2"
                    aria-hidden="true"
                  ></span>
                  Carregando pets...
                </p>

                <div
                  v-if="erroPets"
                  class="alert alert-danger m-3"
                  role="alert"
                >
                  <p class="mb-2">{{ erroPets }}</p>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    :disabled="carregandoPets"
                    @click="carregarPets()"
                  >
                    Tentar novamente
                  </button>
                </div>

                <div
                  v-if="!carregandoPets || pets.length"
                  class="table-responsive"
                >
                  <table
                    class="table table-striped align-middle mb-0 linked-pets-table"
                  >
                    <caption class="visually-hidden">
                      Pets vinculados a
                      {{
                        tutor.nome
                      }}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">ID</th>
                        <th scope="col">Nome</th>
                        <th scope="col">Espécie</th>
                        <th scope="col">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="pet in pets"
                        :key="pet.id"
                      >
                        <td>{{ pet.id }}</td>
                        <td>{{ pet.nome }}</td>
                        <td>{{ pet.especie }}</td>
                        <td>
                          <RouterLink
                            class="btn btn-outline-primary btn-sm"
                            :to="{
                              name: 'detalhes-pet',
                              params: { id: pet.id },
                            }"
                            :aria-label="`Visualizar ${pet.nome}`"
                          >
                            Visualizar
                          </RouterLink>
                        </td>
                      </tr>
                      <tr v-if="!pets.length && !erroPets">
                        <td
                          colspan="4"
                          class="text-body-secondary empty-pets"
                        >
                          Nenhum pet vinculado a este tutor.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div class="col-lg-6 new-pet-column">
              <section
                class="card new-pet-panel h-100"
                aria-labelledby="cadastro-pet-titulo"
              >
                <div class="card-body">
                  <h3 id="cadastro-pet-titulo">Cadastrar novo pet</h3>
                  <p
                    id="pet-vinculo-ajuda"
                    class="text-body-secondary new-pet-help"
                  >
                    O pet será vinculado automaticamente a {{ tutor.nome }}.
                  </p>

                  <p
                    v-if="sucessoCadastro"
                    class="alert alert-success py-2"
                    role="status"
                  >
                    {{ sucessoCadastro }}
                  </p>
                  <p
                    v-if="erroCadastro"
                    class="alert alert-danger py-2"
                    role="alert"
                  >
                    {{ erroCadastro }}
                  </p>

                  <form
                    novalidate
                    :aria-busy="salvando"
                    aria-describedby="pet-vinculo-ajuda"
                    @submit.prevent="salvarPet"
                  >
                    <div class="mb-2">
                      <label
                        for="nome-pet"
                        class="form-label"
                        >Nome do pet</label
                      >
                      <input
                        id="nome-pet"
                        v-model="novoPet.nome"
                        class="form-control"
                        :class="{
                          'is-invalid': camposVisitados.nome && !nomeValido,
                        }"
                        type="text"
                        placeholder="Digite o nome do pet"
                        required
                        :disabled="salvando"
                        :aria-invalid="camposVisitados.nome && !nomeValido"
                        :aria-describedby="
                          camposVisitados.nome && !nomeValido
                            ? 'nome-pet-erro'
                            : undefined
                        "
                        @input="camposVisitados.nome = true"
                        @blur="camposVisitados.nome = true"
                      />
                      <div
                        v-if="camposVisitados.nome && !nomeValido"
                        id="nome-pet-erro"
                        class="invalid-feedback"
                      >
                        Ops, campo obrigatório, por favor preencha-o!
                      </div>
                    </div>

                    <div class="mb-2">
                      <label
                        for="especie-pet"
                        class="form-label"
                        >Espécie</label
                      >
                      <select
                        id="especie-pet"
                        v-model="novoPet.especie"
                        class="form-select"
                        :class="{
                          'is-invalid':
                            camposVisitados.especie && !especieValida,
                        }"
                        required
                        :disabled="salvando"
                        :aria-invalid="
                          camposVisitados.especie && !especieValida
                        "
                        :aria-describedby="
                          camposVisitados.especie && !especieValida
                            ? 'especie-pet-erro'
                            : undefined
                        "
                        @change="camposVisitados.especie = true"
                        @blur="camposVisitados.especie = true"
                      >
                        <option
                          value=""
                          disabled
                        >
                          Selecione
                        </option>
                        <option
                          v-for="especie in ESPECIES_PET"
                          :key="especie"
                          :value="especie"
                        >
                          {{ especie }}
                        </option>
                      </select>
                      <div
                        v-if="camposVisitados.especie && !especieValida"
                        id="especie-pet-erro"
                        class="invalid-feedback"
                      >
                        Selecione a espécie do pet.
                      </div>
                    </div>

                    <button
                      class="btn btn-success w-100"
                      type="submit"
                      :disabled="!formularioValido || salvando"
                    >
                      <span
                        v-if="salvando"
                        class="spinner-border spinner-border-sm me-1"
                        aria-hidden="true"
                      ></span>
                      {{ salvando ? 'Cadastrando...' : 'Cadastrar pet' }}
                    </button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.details-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}

.details-card {
  border-color: #dce2e9;
  border-radius: 0.3rem;
}

.details-card + .details-card {
  margin-top: 1rem;
}

.details-card > .card-header {
  padding: 0.65rem 0.85rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.details-card > .card-body {
  padding: 0.65rem 0.85rem;
}

.card-header {
  margin-bottom: 0;
  background-color: #f5f6f8;
  border-color: #e1e6ed;
}

.information-panel,
.linked-pets-panel,
.new-pet-panel {
  border-color: #dce2e9;
  border-radius: 0.3rem;
}

.information-panel + .information-panel {
  margin-top: 0.65rem;
}

.information-panel > .card-header,
.linked-pets-panel > .card-header {
  padding: 0.5rem 0.85rem;
  font-size: 1rem;
  font-weight: 600;
}

.information-grid {
  --bs-gutter-y: 0.65rem;
  padding: 0.65rem 0.85rem;
}

.information-grid dt {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
}

.information-grid dd {
  margin-bottom: 0;
  overflow-wrap: anywhere;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.linked-pets-panel h3,
.new-pet-panel h3 {
  font-size: 1rem;
  font-weight: 600;
}

.linked-pets-panel .badge {
  font-size: 0.75rem;
}

.linked-pets-table {
  font-size: 0.875rem;
}

.linked-pets-table th,
.linked-pets-table td {
  padding: 0.45rem 1rem;
}

.linked-pets-table th {
  background-color: #f5f6f8;
  font-weight: 600;
}

.linked-pets-table .btn {
  white-space: nowrap;
}

.empty-pets {
  padding-block: 1.5rem !important;
}

.new-pet-panel > .card-body {
  padding: 0.5rem 0.85rem;
}

.new-pet-panel h3 {
  margin-bottom: 0.15rem;
}

.new-pet-help {
  margin-bottom: 0.6rem;
  font-size: 0.875rem;
}

.new-pet-panel .form-label {
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.new-pet-panel .form-control,
.new-pet-panel .form-select,
.new-pet-panel .btn {
  font-size: 0.875rem;
}

.new-pet-panel .alert {
  font-size: 0.875rem;
  margin-bottom: 0.65rem;
}

@media (min-width: 992px) {
  .linked-pets-column {
    width: 53%;
  }

  .new-pet-column {
    width: 47%;
  }
}

@media (max-width: 575.98px) {
  .details-page-header {
    flex-direction: column;
  }

  .information-grid > div {
    width: 100%;
  }

  .details-card > .card-body {
    padding: 0.65rem;
  }
}
</style>
