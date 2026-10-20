<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { apiRequest } from '@/services/api';
import { ESPECIES_PET } from '@/utils/pet';

const router = useRouter();
const tutores = ref([]);
const carregando = ref(true);
const salvando = ref(false);
const erroTutores = ref('');
const erroCadastro = ref('');
const novoPet = reactive({ nome: '', especie: '', tutorId: '' });
const tocados = reactive({ nome: false, especie: false });

const nomeValido = computed(() => novoPet.nome.trim().length > 0);
const especieValida = computed(() => ESPECIES_PET.includes(novoPet.especie));
const podeSalvar = computed(
  () =>
    nomeValido.value &&
    especieValida.value &&
    !carregando.value &&
    !erroTutores.value &&
    !salvando.value,
);

async function carregarTutores() {
  carregando.value = true;
  erroTutores.value = '';
  try {
    tutores.value = await apiRequest('/tutores');
  } catch {
    erroTutores.value =
      'Não foi possível carregar os tutores. Verifique a conexão com o servidor e tente novamente.';
  } finally {
    carregando.value = false;
  }
}

async function salvarPet() {
  if (salvando.value) return;
  tocados.nome = true;
  tocados.especie = true;
  if (!podeSalvar.value) return;

  salvando.value = true;
  erroCadastro.value = '';
  try {
    await apiRequest('/pets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: novoPet.nome.trim(),
        especie: novoPet.especie,
        tutorId: novoPet.tutorId,
      }),
    });
    await router.push('/pets');
  } catch {
    erroCadastro.value =
      'Não foi possível cadastrar o pet. Confira a conexão e tente novamente.';
  } finally {
    salvando.value = false;
  }
}

onMounted(carregarTutores);
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Cadastrar Pet</h1>
        <p>Preencha os dados para cadastrar um novo pet.</p>
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
      v-if="erroTutores"
      class="alert alert-danger"
      role="alert"
    >
      {{ erroTutores }}
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        @click="carregarTutores"
      >
        Tentar novamente
      </button>
    </div>
    <div
      v-if="erroCadastro"
      class="alert alert-danger"
      role="alert"
    >
      {{ erroCadastro }}
    </div>

    <form
      novalidate
      @submit.prevent="salvarPet"
    >
      <fieldset
        :disabled="salvando"
        class="border-0 p-0 m-0"
      >
        <legend class="h5 border-bottom pb-2 mb-3">Dados do Pet</legend>
        <div class="row g-3">
          <div class="col-md-6">
            <label
              for="pet-nome"
              class="form-label"
              >Nome do pet</label
            >
            <input
              id="pet-nome"
              v-model="novoPet.nome"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': tocados.nome && !nomeValido }"
              :aria-invalid="tocados.nome && !nomeValido"
              :aria-describedby="
                tocados.nome && !nomeValido ? 'pet-nome-erro' : undefined
              "
              placeholder="Digite o nome do pet"
              required
              @input="tocados.nome = true"
              @blur="tocados.nome = true"
            />
            <div
              id="pet-nome-erro"
              class="invalid-feedback"
            >
              Informe o nome do pet.
            </div>
          </div>
          <div class="col-md-6">
            <label
              class="form-label"
              for="pet-especie"
              >Espécie</label
            >
            <select
              id="pet-especie"
              v-model="novoPet.especie"
              class="form-select"
              :class="{ 'is-invalid': tocados.especie && !especieValida }"
              :aria-invalid="tocados.especie && !especieValida"
              :aria-describedby="
                tocados.especie && !especieValida
                  ? 'pet-especie-erro'
                  : undefined
              "
              required
              @change="tocados.especie = true"
              @blur="tocados.especie = true"
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
              id="pet-especie-erro"
              class="invalid-feedback"
            >
              Selecione a espécie.
            </div>
          </div>
          <div class="col-md-6">
            <label
              for="pet-tutor"
              class="form-label"
              >Tutor</label
            >
            <select
              id="pet-tutor"
              v-model="novoPet.tutorId"
              class="form-select"
              :disabled="carregando || !!erroTutores"
              aria-describedby="pet-tutor-ajuda"
            >
              <option value="">
                {{
                  carregando ? 'Carregando tutores...' : 'Sem tutor vinculado'
                }}
              </option>
              <option
                v-for="tutor in tutores"
                :key="tutor.id"
                :value="tutor.id"
              >
                {{ tutor.nome }}
              </option>
            </select>
            <div
              id="pet-tutor-ajuda"
              class="form-text"
            >
              O vínculo é opcional.
              <RouterLink
                v-if="!carregando && !erroTutores && tutores.length === 0"
                to="/tutores/novo"
              >
                Cadastre um tutor para vinculá-lo ao pet.
              </RouterLink>
            </div>
          </div>
        </div>
        <div class="d-flex justify-content-end gap-2 mt-4">
          <RouterLink
            class="btn btn-outline-secondary"
            to="/pets"
            >Cancelar</RouterLink
          >
          <button
            class="btn btn-success"
            type="submit"
            :disabled="!podeSalvar"
          >
            <span
              v-if="salvando"
              class="spinner-border spinner-border-sm me-2"
              aria-hidden="true"
            ></span>
            {{ salvando ? 'Salvando...' : 'Salvar Pet' }}
          </button>
        </div>
      </fieldset>
    </form>
  </section>
</template>
