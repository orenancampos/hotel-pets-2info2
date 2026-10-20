<script setup>
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { apiRequest } from '@/services/api';
import { correspondeBusca, correspondeTutor } from '@/utils/filtros';
import {
  consultarDisponibilidade,
  hojeDoHotel,
  periodoValido,
  reservaAtiva,
} from '@/utils/reservas';
import { formatDataNascimento } from '@/utils/tutor';

const reservas = ref([]);
const pets = ref([]);
const tutores = ref([]);
const capacidade = ref(20);
const capacidadeDigitada = ref('20');
const capacidadeVisitada = ref(false);
const carregando = ref(true);
const dadosCarregados = ref(false);
const dadosConfiaveis = ref(false);
const erroCarregamento = ref('');
const erroOperacao = ref('');
const sucesso = ref('');
const operacao = ref('');
const hoje = ref(hojeDoHotel());
const formulario = ref({ petId: '', entrada: '', saida: '' });
const visitados = ref({ petId: false, entrada: false, saida: false });
const busca = ref('');

const ocupado = computed(() => carregando.value || Boolean(operacao.value));
const podeEditar = computed(() => dadosConfiaveis.value && !ocupado.value);
const petsPorId = computed(
  () => new Map(pets.value.map((pet) => [String(pet.id), pet])),
);
const tutoresPorId = computed(
  () => new Map(tutores.value.map((tutor) => [String(tutor.id), tutor])),
);
const ocupacaoHoje = computed(
  () =>
    reservas.value.filter(
      (reserva) =>
        reservaAtiva(reserva) &&
        reserva.entrada <= hoje.value &&
        reserva.saida > hoje.value,
    ).length,
);
const vagasHoje = computed(() =>
  Math.max(0, capacidade.value - ocupacaoHoje.value),
);
const capacidadeValida = computed(
  () =>
    String(capacidadeDigitada.value).trim() !== '' &&
    Number.isInteger(Number(capacidadeDigitada.value)) &&
    Number(capacidadeDigitada.value) >= 1 &&
    Number(capacidadeDigitada.value) <= 999,
);
const petValido = computed(() =>
  petsPorId.value.has(String(formulario.value.petId)),
);
const entradaValida = computed(
  () =>
    periodoValido(
      formulario.value.entrada,
      diaSeguinte(formulario.value.entrada),
    ) && formulario.value.entrada >= hoje.value,
);
const saidaValida = computed(() =>
  periodoValido(formulario.value.entrada, formulario.value.saida),
);
const disponibilidade = computed(() =>
  consultarDisponibilidade(
    reservas.value,
    capacidade.value,
    formulario.value.entrada,
    formulario.value.saida,
    { petId: formulario.value.petId || undefined },
  ),
);
const formularioValido = computed(
  () =>
    petValido.value &&
    entradaValida.value &&
    saidaValida.value &&
    disponibilidade.value.disponivel,
);
const reservasOrdenadas = computed(() =>
  [...reservas.value].sort(
    (a, b) =>
      String(b.entrada).localeCompare(String(a.entrada)) ||
      String(b.id).localeCompare(String(a.id)),
  ),
);
const reservasFiltradas = computed(() =>
  reservasOrdenadas.value.filter((reserva) => {
    const pet = petsPorId.value.get(String(reserva.petId));
    const tutor = tutoresPorId.value.get(String(pet?.tutorId));
    return (
      correspondeBusca(busca.value, nomePet(reserva)) ||
      correspondeTutor(busca.value, tutor)
    );
  }),
);
const saidaMinima = computed(() =>
  entradaValida.value
    ? diaSeguinte(formulario.value.entrada)
    : diaSeguinte(hoje.value),
);
const labelsStatus = {
  reservado: 'Reservado',
  hospedado: 'Hospedado',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};
const coresStatus = {
  reservado: 'text-bg-primary',
  hospedado: 'text-bg-success',
  finalizado: 'text-bg-secondary',
  cancelado: 'text-bg-light border text-body-secondary',
};

function diaSeguinte(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return '';
  const dia = new Date(`${data}T12:00:00`);
  if (Number.isNaN(dia.getTime())) return '';
  dia.setDate(dia.getDate() + 1);
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
}

function nomePet(reserva) {
  return petsPorId.value.get(String(reserva.petId))?.nome || 'Pet indisponível';
}

function limparPesquisa() {
  busca.value = '';
}

function podeRegistrarEntrada(reserva) {
  return (
    reserva.status === 'reservado' &&
    reserva.entrada <= hoje.value &&
    reserva.saida > hoje.value
  );
}

function mensagemErro(error, fallback) {
  return error?.status && error?.message ? error.message : fallback;
}

async function atualizarDados() {
  hoje.value = hojeDoHotel();
  try {
    const [listaReservas, listaPets, listaTutores, configuracoes] =
      await Promise.all([
        apiRequest('/reservas'),
        apiRequest('/pets'),
        apiRequest('/tutores'),
        apiRequest('/configuracoes'),
      ]);
    if (
      !Array.isArray(listaReservas) ||
      !Array.isArray(listaPets) ||
      !Array.isArray(listaTutores) ||
      !Number.isInteger(configuracoes?.capacidade) ||
      configuracoes.capacidade < 1 ||
      configuracoes.capacidade > 999
    ) {
      throw new Error('Dados de reservas inválidos.');
    }
    reservas.value = listaReservas;
    pets.value = listaPets;
    tutores.value = listaTutores;
    capacidade.value = configuracoes.capacidade;
    if (!dadosCarregados.value)
      capacidadeDigitada.value = String(configuracoes.capacidade);
    dadosCarregados.value = true;
    dadosConfiaveis.value = true;
    erroCarregamento.value = '';
    return true;
  } catch {
    dadosConfiaveis.value = false;
    erroCarregamento.value =
      'Não foi possível atualizar as reservas e as vagas. Verifique a conexão e tente novamente para continuar.';
    return false;
  }
}

async function carregarDados() {
  if (operacao.value) return;
  carregando.value = true;
  await atualizarDados();
  carregando.value = false;
}

async function salvarReserva() {
  visitados.value = { petId: true, entrada: true, saida: true };
  if (!podeEditar.value || !formularioValido.value) return;
  operacao.value = 'cadastro';
  erroOperacao.value = '';
  sucesso.value = '';
  try {
    // Atualiza a disponibilidade antes de enviar; a API também valida a reserva.
    if (!(await atualizarDados())) return;
    if (!formularioValido.value) {
      erroOperacao.value = disponibilidade.value.petJaReservado
        ? 'Este pet já possui uma reserva nesse período. Selecione outras datas.'
        : !petValido.value
          ? 'O pet selecionado não está mais disponível. Escolha outro pet.'
          : 'As vagas foram atualizadas. Confira o período antes de reservar.';
      return;
    }
    const pet = petsPorId.value.get(String(formulario.value.petId));
    const reserva = await apiRequest('/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petId: pet.id,
        entrada: formulario.value.entrada,
        saida: formulario.value.saida,
        status: 'reservado',
      }),
    });
    if (reserva?.id !== undefined && reserva?.id !== null)
      reservas.value.push(reserva);
    formulario.value = { petId: '', entrada: '', saida: '' };
    visitados.value = { petId: false, entrada: false, saida: false };
    sucesso.value = `Reserva de ${pet.nome} cadastrada com sucesso.`;
    await atualizarDados();
  } catch (error) {
    erroOperacao.value = mensagemErro(
      error,
      'Não foi possível cadastrar a reserva. Seus dados foram mantidos; tente novamente.',
    );
    await atualizarDados();
  } finally {
    operacao.value = '';
  }
}

async function salvarCapacidade() {
  capacidadeVisitada.value = true;
  if (
    !podeEditar.value ||
    !capacidadeValida.value ||
    Number(capacidadeDigitada.value) === capacidade.value
  )
    return;
  operacao.value = 'capacidade';
  erroOperacao.value = '';
  sucesso.value = '';
  try {
    const configuracoes = await apiRequest('/configuracoes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacidade: Number(capacidadeDigitada.value) }),
    });
    capacidade.value = configuracoes.capacidade;
    capacidadeDigitada.value = String(configuracoes.capacidade);
    sucesso.value = `Capacidade do hotel atualizada para ${configuracoes.capacidade} vagas.`;
    await atualizarDados();
  } catch (error) {
    erroOperacao.value = mensagemErro(
      error,
      'Não foi possível atualizar a capacidade. Tente novamente.',
    );
    await atualizarDados();
  } finally {
    operacao.value = '';
  }
}

async function alterarStatus(reserva, status) {
  if (!podeEditar.value) return;
  const nome = nomePet(reserva);
  if (
    status === 'finalizado' &&
    !window.confirm(`Finalizar a hospedagem de ${nome} e liberar a vaga?`)
  )
    return;
  if (
    status === 'cancelado' &&
    !window.confirm(`Cancelar a reserva de ${nome}? A vaga será liberada.`)
  )
    return;
  operacao.value = `reserva:${reserva.id}`;
  erroOperacao.value = '';
  sucesso.value = '';
  try {
    const atualizada = await apiRequest(
      `/reservas/${encodeURIComponent(reserva.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    );
    reservas.value = reservas.value.map((item) =>
      String(item.id) === String(reserva.id) ? atualizada : item,
    );
    sucesso.value =
      status === 'hospedado'
        ? `Entrada de ${nome} registrada com sucesso.`
        : status === 'finalizado'
          ? `Hospedagem de ${nome} finalizada. A vaga foi liberada.`
          : `Reserva de ${nome} cancelada. A vaga foi liberada.`;
    await atualizarDados();
  } catch (error) {
    erroOperacao.value = mensagemErro(
      error,
      'Não foi possível atualizar a reserva. Tente novamente.',
    );
    await atualizarDados();
  } finally {
    operacao.value = '';
  }
}

onMounted(carregarDados);
</script>

<template>
  <div class="reservas-page">
    <header class="page-header">
      <div>
        <h1>Reservas e vagas</h1>
        <p>Organize as hospedagens e consulte a disponibilidade do hotel.</p>
      </div>
    </header>

    <div
      v-if="erroCarregamento"
      class="alert alert-danger"
      role="alert"
    >
      <p class="mb-2">{{ erroCarregamento }}</p>
      <button
        class="btn btn-outline-danger btn-sm"
        type="button"
        :disabled="ocupado"
        @click="carregarDados"
      >
        Tentar novamente
      </button>
    </div>
    <p
      v-if="erroOperacao"
      class="alert alert-danger"
      role="alert"
    >
      {{ erroOperacao }}
    </p>
    <p
      v-if="sucesso"
      class="alert alert-success"
      role="status"
    >
      {{ sucesso }}
    </p>
    <p
      v-if="carregando"
      class="text-body-secondary"
      role="status"
    >
      <span
        class="spinner-border spinner-border-sm me-2"
        aria-hidden="true"
      ></span>
      Carregando reservas e vagas...
    </p>

    <div
      class="row g-3 mb-4"
      aria-label="Ocupação do hotel hoje"
    >
      <div class="col-sm-4">
        <div class="card resumo-card h-100">
          <div class="card-body">
            <span class="resumo-icone text-primary"
              ><i
                class="bi bi-building"
                aria-hidden="true"
              ></i
            ></span>
            <p class="resumo-label">Capacidade do hotel</p>
            <p
              class="resumo-valor"
              data-testid="capacidade-total"
            >
              {{ dadosCarregados ? capacidade : '—' }}
            </p>
            <span class="resumo-ajuda">vagas no total</span>
          </div>
        </div>
      </div>
      <div class="col-sm-4">
        <div class="card resumo-card h-100">
          <div class="card-body">
            <span class="resumo-icone text-primary"
              ><i
                class="bi bi-house-heart"
                aria-hidden="true"
              ></i
            ></span>
            <p class="resumo-label">Ocupadas hoje</p>
            <p
              class="resumo-valor"
              data-testid="ocupacao-hoje"
            >
              {{ dadosCarregados ? ocupacaoHoje : '—' }}
            </p>
            <span class="resumo-ajuda">reservas e hospedagens ativas</span>
          </div>
        </div>
      </div>
      <div class="col-sm-4">
        <div
          class="card resumo-card h-100"
          :class="{ 'resumo-lotado': dadosCarregados && vagasHoje === 0 }"
        >
          <div class="card-body">
            <span
              class="resumo-icone"
              :class="vagasHoje === 0 ? 'text-danger' : 'text-success'"
              ><i
                class="bi bi-check-circle"
                aria-hidden="true"
              ></i
            ></span>
            <p class="resumo-label">Livres hoje</p>
            <p
              class="resumo-valor"
              :class="vagasHoje === 0 ? 'text-danger' : 'text-success'"
              data-testid="vagas-hoje"
            >
              {{ dadosCarregados ? vagasHoje : '—' }}
            </p>
            <span class="resumo-ajuda">{{
              dadosCarregados && vagasHoje === 0
                ? 'Hotel lotado para hoje'
                : 'Confira também o período da reserva'
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <section
      class="card reserva-card mb-4"
      aria-labelledby="capacidade-titulo"
    >
      <div class="card-body capacidade-panel">
        <div class="capacidade-descricao">
          <h2 id="capacidade-titulo">Capacidade do hotel</h2>
          <p class="text-body-secondary mb-0">
            Defina quantos pets podem ficar hospedados ao mesmo tempo.
          </p>
        </div>
        <form
          class="capacidade-form"
          novalidate
          :aria-busy="operacao === 'capacidade'"
          @submit.prevent="salvarCapacidade"
        >
          <div class="capacidade-campo">
            <label
              for="hotel-capacidade"
              class="form-label"
              >Número de vagas</label
            >
            <input
              id="hotel-capacidade"
              v-model="capacidadeDigitada"
              class="form-control"
              :class="{ 'is-invalid': capacidadeVisitada && !capacidadeValida }"
              type="number"
              min="1"
              max="999"
              step="1"
              required
              :disabled="!podeEditar"
              :aria-invalid="capacidadeVisitada && !capacidadeValida"
              :aria-describedby="
                capacidadeVisitada && !capacidadeValida
                  ? 'capacidade-erro'
                  : undefined
              "
              @blur="capacidadeVisitada = true"
            />
            <div
              v-if="capacidadeVisitada && !capacidadeValida"
              id="capacidade-erro"
              class="invalid-feedback"
            >
              Informe um número inteiro entre 1 e 999.
            </div>
          </div>
          <button
            class="btn btn-outline-primary"
            type="submit"
            data-testid="salvar-capacidade"
            :disabled="
              !podeEditar ||
              !capacidadeValida ||
              Number(capacidadeDigitada) === capacidade
            "
          >
            <span
              v-if="operacao === 'capacidade'"
              class="spinner-border spinner-border-sm me-1"
              aria-hidden="true"
            ></span>
            {{
              operacao === 'capacidade' ? 'Salvando...' : 'Salvar capacidade'
            }}
          </button>
        </form>
      </div>
    </section>

    <section
      class="card reserva-card mb-4"
      aria-labelledby="nova-reserva-titulo"
    >
      <h2
        id="nova-reserva-titulo"
        class="card-header"
      >
        <i
          class="bi bi-calendar-plus me-2"
          aria-hidden="true"
        ></i
        >Nova reserva
      </h2>
      <div class="card-body">
        <p class="text-body-secondary reserva-ajuda">
          Cada pet ocupa uma vaga. A data de saída já fica disponível para outra
          reserva.
        </p>
        <p
          v-if="dadosCarregados && !pets.length"
          class="alert alert-info"
          role="status"
        >
          Cadastre um pet antes de fazer uma reserva.
          <RouterLink
            to="/pets/novo"
            class="alert-link"
            >Cadastrar pet</RouterLink
          >
        </p>
        <form
          novalidate
          :aria-busy="operacao === 'cadastro'"
          @submit.prevent="salvarReserva"
        >
          <div class="row g-3">
            <div class="col-lg-6">
              <label
                for="reserva-pet"
                class="form-label"
                >Pet</label
              >
              <select
                id="reserva-pet"
                v-model="formulario.petId"
                class="form-select"
                :class="{ 'is-invalid': visitados.petId && !petValido }"
                required
                :disabled="!podeEditar || !pets.length"
                :aria-invalid="visitados.petId && !petValido"
                :aria-describedby="
                  visitados.petId && !petValido ? 'reserva-pet-erro' : undefined
                "
                @blur="visitados.petId = true"
                @change="visitados.petId = true"
              >
                <option
                  value=""
                  disabled
                >
                  Selecione um pet
                </option>
                <option
                  v-for="pet in pets"
                  :key="pet.id"
                  :value="pet.id"
                >
                  {{ pet.nome }} — {{ pet.especie }} (ID {{ pet.id }})
                </option>
              </select>
              <div
                v-if="visitados.petId && !petValido"
                id="reserva-pet-erro"
                class="invalid-feedback"
              >
                Selecione um pet cadastrado.
              </div>
            </div>
            <div class="col-sm-6 col-lg-3">
              <label
                for="reserva-entrada"
                class="form-label"
                >Entrada</label
              >
              <input
                id="reserva-entrada"
                v-model="formulario.entrada"
                class="form-control"
                :class="{ 'is-invalid': visitados.entrada && !entradaValida }"
                type="date"
                :min="hoje"
                required
                :disabled="!podeEditar"
                :aria-invalid="visitados.entrada && !entradaValida"
                :aria-describedby="
                  visitados.entrada && !entradaValida
                    ? 'reserva-entrada-erro'
                    : undefined
                "
                @blur="visitados.entrada = true"
                @change="visitados.entrada = true"
              />
              <div
                v-if="visitados.entrada && !entradaValida"
                id="reserva-entrada-erro"
                class="invalid-feedback"
              >
                Informe uma data de entrada a partir de hoje.
              </div>
            </div>
            <div class="col-sm-6 col-lg-3">
              <label
                for="reserva-saida"
                class="form-label"
                >Saída</label
              >
              <input
                id="reserva-saida"
                v-model="formulario.saida"
                class="form-control"
                :class="{ 'is-invalid': visitados.saida && !saidaValida }"
                type="date"
                :min="saidaMinima"
                required
                :disabled="!podeEditar"
                :aria-invalid="visitados.saida && !saidaValida"
                :aria-describedby="
                  visitados.saida && !saidaValida
                    ? 'reserva-saida-erro'
                    : undefined
                "
                @blur="visitados.saida = true"
                @change="visitados.saida = true"
              />
              <div
                v-if="visitados.saida && !saidaValida"
                id="reserva-saida-erro"
                class="invalid-feedback"
              >
                A saída deve ser posterior à entrada.
              </div>
            </div>
          </div>
          <div
            class="disponibilidade alert mt-3 mb-3"
            :class="
              !dadosConfiaveis
                ? 'alert-secondary'
                : entradaValida && saidaValida
                  ? disponibilidade.disponivel
                    ? 'alert-success'
                    : 'alert-danger'
                  : 'alert-info'
            "
            role="status"
            aria-live="polite"
            data-testid="disponibilidade-periodo"
          >
            <i
              class="bi me-2"
              :class="
                entradaValida && saidaValida && dadosConfiaveis
                  ? disponibilidade.disponivel
                    ? 'bi-check-circle-fill'
                    : 'bi-exclamation-circle-fill'
                  : 'bi-info-circle-fill'
              "
              aria-hidden="true"
            ></i>
            <span v-if="!dadosConfiaveis"
              >Aguarde a atualização dos dados para consultar a
              disponibilidade.</span
            >
            <span v-else-if="!entradaValida || !saidaValida"
              >Selecione as datas de entrada e saída para consultar as vagas do
              período.</span
            >
            <span v-else-if="disponibilidade.petJaReservado"
              >Este pet já possui uma reserva nesse período. Selecione outras
              datas.</span
            >
            <span v-else-if="!disponibilidade.disponivel"
              ><strong>Sem vagas no período selecionado.</strong> Escolha outras
              datas para fazer a reserva.</span
            >
            <span v-else
              ><strong
                >{{ disponibilidade.vagasDisponiveis }}
                {{
                  disponibilidade.vagasDisponiveis === 1
                    ? 'vaga disponível'
                    : 'vagas disponíveis'
                }}
                no período.</strong
              >
              {{
                petValido
                  ? 'Tudo pronto para reservar.'
                  : 'Selecione o pet para continuar.'
              }}</span
            >
          </div>
          <div class="d-flex justify-content-end">
            <button
              class="btn btn-primary"
              type="submit"
              data-testid="salvar-reserva"
              :disabled="!podeEditar || !formularioValido"
            >
              <span
                v-if="operacao === 'cadastro'"
                class="spinner-border spinner-border-sm me-1"
                aria-hidden="true"
              ></span>
              <i
                v-else
                class="bi bi-plus-lg me-1"
                aria-hidden="true"
              ></i>
              {{
                operacao === 'cadastro' ? 'Reservando...' : 'Cadastrar reserva'
              }}
            </button>
          </div>
        </form>
      </div>
    </section>

    <section
      class="card reserva-card"
      aria-labelledby="reservas-titulo"
    >
      <div
        class="card-header d-flex align-items-center justify-content-between gap-2"
      >
        <h2
          id="reservas-titulo"
          class="mb-0"
        >
          Reservas do hotel
        </h2>
        <span class="badge rounded-pill text-bg-primary">{{
          reservasFiltradas.length
        }}</span>
      </div>
      <div class="card-body list-filters">
        <div class="row g-3">
          <div class="col-12">
            <label
              for="pesquisa-reserva"
              class="form-label"
              >Pesquisar reservas</label
            >
            <input
              id="pesquisa-reserva"
              v-model="busca"
              class="form-control"
              type="search"
              placeholder="Nome do pet ou tutor, CPF ou telefone"
            />
          </div>
        </div>
        <div
          class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3"
        >
          <p
            class="text-body-secondary mb-0"
            role="status"
            aria-live="polite"
          >
            Exibindo {{ reservasFiltradas.length }} de {{ reservas.length }}
            {{ reservas.length === 1 ? 'reserva' : 'reservas' }}
          </p>
          <button
            id="limpar-pesquisa-reservas"
            class="btn btn-outline-secondary"
            type="button"
            :disabled="!busca"
            @click="limparPesquisa"
          >
            <i
              class="bi bi-x-circle me-1"
              aria-hidden="true"
            ></i>
            Limpar pesquisa
          </button>
        </div>
      </div>
      <div class="table-responsive">
        <table
          class="table table-striped table-hover align-middle reservas-table mb-0"
          data-testid="tabela-reservas"
        >
          <caption class="visually-hidden">
            Reservas do hotel, datas de hospedagem e ações disponíveis
          </caption>
          <thead>
            <tr>
              <th scope="col">Pet</th>
              <th scope="col">Entrada</th>
              <th scope="col">Saída</th>
              <th scope="col">Status</th>
              <th scope="col">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!reservas.length">
              <td
                colspan="5"
                class="text-center text-body-secondary py-4"
              >
                {{
                  carregando
                    ? 'Carregando reservas...'
                    : dadosCarregados
                      ? 'Nenhuma reserva cadastrada. Comece selecionando um pet e as datas acima.'
                      : 'As reservas serão exibidas após carregar os dados.'
                }}
              </td>
            </tr>
            <tr v-else-if="!reservasFiltradas.length">
              <td
                colspan="5"
                class="text-center text-body-secondary py-4"
              >
                Nenhuma reserva encontrada com essa pesquisa.
              </td>
            </tr>
            <tr
              v-for="reserva in reservasFiltradas"
              :key="reserva.id"
            >
              <td>
                <strong class="pet-nome">{{ nomePet(reserva) }}</strong
                ><small class="d-block text-body-secondary">{{
                  petsPorId.get(String(reserva.petId))?.especie ||
                  'Pet removido do cadastro'
                }}</small>
              </td>
              <td class="text-nowrap">
                {{ formatDataNascimento(reserva.entrada) || 'Não informada' }}
              </td>
              <td class="text-nowrap">
                {{ formatDataNascimento(reserva.saida) || 'Não informada' }}
              </td>
              <td>
                <span
                  class="badge"
                  :class="coresStatus[reserva.status] || 'text-bg-secondary'"
                  >{{ labelsStatus[reserva.status] || reserva.status }}</span
                >
              </td>
              <td>
                <div
                  v-if="reservaAtiva(reserva)"
                  class="reserva-acoes"
                >
                  <button
                    v-if="podeRegistrarEntrada(reserva)"
                    class="btn btn-outline-success btn-sm"
                    type="button"
                    :disabled="!podeEditar"
                    :aria-label="`Registrar entrada de ${nomePet(reserva)}`"
                    @click="alterarStatus(reserva, 'hospedado')"
                  >
                    Registrar entrada
                  </button>
                  <button
                    v-if="reserva.status === 'hospedado'"
                    class="btn btn-outline-primary btn-sm"
                    type="button"
                    :disabled="!podeEditar"
                    :aria-label="`Finalizar hospedagem de ${nomePet(reserva)}`"
                    @click="alterarStatus(reserva, 'finalizado')"
                  >
                    Finalizar
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    type="button"
                    :disabled="!podeEditar"
                    :aria-label="`Cancelar reserva de ${nomePet(reserva)}`"
                    @click="alterarStatus(reserva, 'cancelado')"
                  >
                    Cancelar
                  </button>
                  <span
                    v-if="operacao === `reserva:${reserva.id}`"
                    class="spinner-border spinner-border-sm text-primary"
                    role="status"
                    ><span class="visually-hidden"
                      >Atualizando reserva...</span
                    ></span
                  >
                  <small
                    v-if="
                      reserva.status === 'reservado' && reserva.entrada > hoje
                    "
                    class="text-body-secondary entrada-prevista"
                    >Entrada em
                    {{ formatDataNascimento(reserva.entrada) }}</small
                  >
                  <small
                    v-else-if="
                      reserva.status === 'reservado' && reserva.saida <= hoje
                    "
                    class="text-body-secondary entrada-prevista"
                    >Período encerrado</small
                  >
                </div>
                <span
                  v-else
                  class="text-body-secondary"
                  >—</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.resumo-card,
.reserva-card {
  border-color: #dce2e9;
}
.resumo-card .card-body {
  position: relative;
  padding: 20px;
}
.resumo-label {
  margin-bottom: 8px;
  color: #596273;
  font-size: 14px;
  font-weight: 600;
}
.resumo-valor {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.15;
}
.resumo-ajuda {
  display: block;
  margin-top: 6px;
  color: #667085;
  font-size: 12px;
}
.resumo-icone {
  position: absolute;
  top: 17px;
  right: 17px;
  font-size: 22px;
  opacity: 0.8;
}
.resumo-label {
  padding-right: 28px;
}
.resumo-lotado {
  border-color: #f1aeb5;
  background: #fffafb;
}
.reserva-card > .card-header {
  margin: 0;
  padding: 13px 18px;
  background: #f5f6f8;
  font-size: 19px;
  font-weight: 600;
}
.reserva-card > .card-header h2 {
  font-size: inherit;
  font-weight: inherit;
}
.reserva-card > .card-body {
  padding: 18px;
}
.capacidade-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.capacidade-descricao {
  min-width: 0;
}
.capacidade-descricao h2 {
  margin-bottom: 5px;
  font-size: 19px;
  font-weight: 600;
}
.capacidade-descricao p,
.reserva-ajuda {
  font-size: 14px;
}
.capacidade-form {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  gap: 10px;
}
.capacidade-campo {
  width: 155px;
}
.capacidade-form > .btn {
  min-height: 38px;
  margin-top: 26px;
  white-space: nowrap;
}
.disponibilidade {
  display: flex;
  align-items: baseline;
  padding: 12px;
  font-size: 14px;
}
.disponibilidade .bi {
  flex-shrink: 0;
}
.reservas-table {
  min-width: 720px;
  font-size: 14px;
}
.reservas-table th {
  padding: 12px 18px;
  background: #f5f6f8;
  font-weight: 600;
}
.reservas-table td {
  padding: 14px 18px;
}
.reservas-table .badge {
  padding: 6px 9px;
  font-size: 12px;
  font-weight: 500;
}
.pet-nome {
  display: block;
  max-width: 250px;
  overflow-wrap: anywhere;
  font-weight: 600;
}
.reserva-acoes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.reserva-acoes .btn {
  white-space: nowrap;
}
.entrada-prevista {
  flex-basis: 100%;
}
@media (max-width: 1199.98px) {
  .capacidade-panel {
    align-items: flex-start;
    flex-direction: column;
  }
  .capacidade-form {
    flex-wrap: wrap;
  }
}
@media (max-width: 575.98px) {
  .resumo-card .card-body {
    padding: 15px 18px;
  }
  .resumo-valor {
    font-size: 28px;
  }
  .capacidade-form {
    width: 100%;
  }
  .capacidade-campo {
    flex: 1 1 120px;
    width: auto;
  }
  .capacidade-form > .btn {
    flex: 1 1 150px;
  }
  .reserva-card > .card-body {
    padding: 15px;
  }
}
</style>
