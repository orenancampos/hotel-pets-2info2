<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { apiRequest } from '@/services/api';
import { buscarEnderecoPorCep } from '@/services/cep';
import {
  formatCep,
  formatCpfCnpj,
  formatTelefone,
  isCepValido,
  isCpfCnpjValido,
  isDataNascimentoValida,
  isEmailValido,
  isTelefoneValido,
  onlyDigits,
  todayLocalISO,
} from '@/utils/tutor';

const router = useRouter();
const formulario = reactive({
  nome: '',
  telefone: '',
  cpfCnpj: '',
  email: '',
  dataNascimento: '',
  rua: '',
  numero: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
});
const interagidos = reactive({});
const tentativaEnvio = ref(false);
const salvando = ref(false);
const erro = ref('');
const consultandoCep = ref(false);
const erroCep = ref('');
const mensagemCep = ref('');
let controladorCep;
let consultaCepAtual = 0;
const hoje = todayLocalISO();
const campoObrigatorio = 'Ops, campo obrigatório, por favor preencha-o!';

const estados = [
  ['AC', 'Acre'],
  ['AL', 'Alagoas'],
  ['AP', 'Amapá'],
  ['AM', 'Amazonas'],
  ['BA', 'Bahia'],
  ['CE', 'Ceará'],
  ['DF', 'Distrito Federal'],
  ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'],
  ['MA', 'Maranhão'],
  ['MT', 'Mato Grosso'],
  ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'],
  ['PA', 'Pará'],
  ['PB', 'Paraíba'],
  ['PR', 'Paraná'],
  ['PE', 'Pernambuco'],
  ['PI', 'Piauí'],
  ['RJ', 'Rio de Janeiro'],
  ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'],
  ['RO', 'Rondônia'],
  ['RR', 'Roraima'],
  ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'],
  ['SE', 'Sergipe'],
  ['TO', 'Tocantins'],
];

const secoes = [
  {
    id: 'dados-tutor',
    titulo: 'Dados do Tutor',
    campos: [
      {
        nome: 'id',
        label: 'ID',
        placeholder: 'Gerado automaticamente',
        coluna: 'col-md-4',
      },
      {
        nome: 'nome',
        label: 'Nome Completo',
        placeholder: 'Digite o nome completo',
        coluna: 'col-md-8',
        autocomplete: 'name',
        obrigatorio: true,
      },
      {
        nome: 'cpfCnpj',
        label: 'CPF / CNPJ',
        placeholder: 'Digite o CPF ou CNPJ',
        inputmode: 'numeric',
        maxlength: 18,
      },
      {
        nome: 'telefone',
        label: 'Telefone / Celular / WhatsApp',
        placeholder: '(00) 00000-0000',
        tipo: 'tel',
        inputmode: 'numeric',
        autocomplete: 'tel-national',
        maxlength: 15,
        obrigatorio: true,
      },
      {
        nome: 'email',
        label: 'E-mail',
        placeholder: 'nome@example.com',
        tipo: 'email',
        autocomplete: 'email',
      },
      {
        nome: 'dataNascimento',
        label: 'Data de Nascimento',
        placeholder: 'dd/mm/aaaa',
        tipo: 'date',
        autocomplete: 'bday',
      },
    ],
  },
  {
    id: 'endereco-tutor',
    titulo: 'Endereço',
    campos: [
      {
        nome: 'rua',
        label: 'Rua',
        placeholder: 'Digite o nome da rua',
        coluna: 'col-md-8',
        autocomplete: 'address-line1',
      },
      {
        nome: 'numero',
        label: 'Número',
        placeholder: 'Número',
        coluna: 'col-md-4',
      },
      {
        nome: 'bairro',
        label: 'Bairro',
        placeholder: 'Digite o bairro',
        autocomplete: 'address-level3',
      },
      {
        nome: 'cidade',
        label: 'Cidade',
        placeholder: 'Digite a cidade',
        autocomplete: 'address-level2',
      },
      { nome: 'estado', label: 'Estado', autocomplete: 'address-level1' },
      {
        nome: 'cep',
        label: 'CEP',
        placeholder: '00000-000',
        inputmode: 'numeric',
        autocomplete: 'postal-code',
        maxlength: 9,
      },
    ],
  },
];

const erros = computed(() => ({
  nome: formulario.nome.trim() ? '' : campoObrigatorio,
  telefone: !onlyDigits(formulario.telefone)
    ? campoObrigatorio
    : isTelefoneValido(formulario.telefone)
      ? ''
      : 'Informe um telefone válido com DDD e 10 ou 11 dígitos.',
  cpfCnpj:
    formulario.cpfCnpj && !isCpfCnpjValido(formulario.cpfCnpj)
      ? 'Informe um CPF ou CNPJ válido.'
      : '',
  email:
    formulario.email.trim() && !isEmailValido(formulario.email)
      ? 'Informe um e-mail válido.'
      : '',
  dataNascimento:
    formulario.dataNascimento &&
    !isDataNascimentoValida(formulario.dataNascimento, hoje)
      ? 'Informe uma data válida que não seja futura.'
      : '',
  cep:
    formulario.cep && !isCepValido(formulario.cep)
      ? 'Informe um CEP com 8 dígitos.'
      : '',
}));

const formularioValido = computed(() =>
  Object.values(erros.value).every((mensagem) => !mensagem),
);
const houveInteracao = computed(
  () => tentativaEnvio.value || Object.values(interagidos).some(Boolean),
);
const mostrarAviso = computed(
  () =>
    houveInteracao.value && Boolean(erros.value.nome || erros.value.telefone),
);

function mostrarErro(campo) {
  return Boolean(
    (tentativaEnvio.value || interagidos[campo]) && erros.value[campo],
  );
}

function idCampo(campo) {
  return `tutor-${campo.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`)}`;
}

function ajudaCampo(campo) {
  if (!interagidos[campo] && !tentativaEnvio.value) return '';
  if (campo === 'cpfCnpj') {
    return 'A máscara muda conforme 11 dígitos (CPF) ou 14 dígitos (CNPJ).';
  }
  if (campo === 'telefone')
    return 'Formato: (00) 00000-0000 ou (00) 0000-0000.';
  return '';
}

function descricaoCampo(campo) {
  return (
    [
      mostrarErro(campo) ? `${idCampo(campo)}-erro` : '',
      ajudaCampo(campo) ? `${idCampo(campo)}-ajuda` : '',
      campo === 'cep' ? 'tutor-cep-consulta' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function atualizarCampo(campo, event) {
  let valor = event.target.value;
  if (campo === 'telefone') valor = formatTelefone(valor);
  if (campo === 'cpfCnpj') valor = formatCpfCnpj(valor);
  if (campo === 'cep') valor = formatCep(valor);
  formulario[campo] = valor;
  event.target.value = valor;
  interagidos[campo] = true;
}

async function consultarCep() {
  const consulta = ++consultaCepAtual;
  controladorCep?.abort();
  consultandoCep.value = false;
  erroCep.value = '';
  mensagemCep.value = '';

  const cep = onlyDigits(formulario.cep);
  if (!isCepValido(cep) || salvando.value) return;

  const controlador = new AbortController();
  controladorCep = controlador;
  const enderecoInicial = {
    rua: formulario.rua,
    bairro: formulario.bairro,
    cidade: formulario.cidade,
    estado: formulario.estado,
  };
  consultandoCep.value = true;

  try {
    const endereco = await buscarEnderecoPorCep(cep, {
      signal: controlador.signal,
    });
    if (
      consulta !== consultaCepAtual ||
      cep !== onlyDigits(formulario.cep) ||
      salvando.value
    )
      return;

    for (const campo of Object.keys(enderecoInicial)) {
      // Preserva alterações manuais feitas enquanto a consulta estava em andamento.
      if (formulario[campo] === enderecoInicial[campo]) {
        formulario[campo] = endereco[campo];
      }
    }
    mensagemCep.value =
      'Endereço consultado. Confira os dados e informe o número.';
  } catch (falha) {
    if (consulta !== consultaCepAtual || falha.name === 'AbortError') return;
    erroCep.value =
      falha.code === 'CEP_NAO_ENCONTRADO'
        ? 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.'
        : 'Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.';
  } finally {
    if (consulta === consultaCepAtual) consultandoCep.value = false;
  }
}

watch(() => onlyDigits(formulario.cep), consultarCep, { flush: 'sync' });

onBeforeUnmount(() => {
  consultaCepAtual += 1;
  controladorCep?.abort();
});

async function salvarTutor() {
  if (salvando.value || consultandoCep.value) return;
  tentativaEnvio.value = true;
  if (!formularioValido.value) {
    const primeiroInvalido = Object.keys(erros.value).find(
      (campo) => erros.value[campo],
    );
    document.getElementById(idCampo(primeiroInvalido))?.focus();
    return;
  }

  salvando.value = true;
  erro.value = '';
  const tutor = {
    nome: formulario.nome.trim(),
    telefone: onlyDigits(formulario.telefone),
  };

  for (const campo of [
    'cpfCnpj',
    'email',
    'dataNascimento',
    'rua',
    'numero',
    'bairro',
    'cidade',
    'estado',
    'cep',
  ]) {
    const valor = formulario[campo].trim();
    if (valor)
      tutor[campo] = ['cpfCnpj', 'cep'].includes(campo)
        ? onlyDigits(valor)
        : valor;
  }

  try {
    await apiRequest('/tutores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tutor),
    });
    await router.push('/tutores');
  } catch {
    erro.value =
      'Não foi possível cadastrar o tutor. Verifique sua conexão e tente novamente.';
  } finally {
    salvando.value = false;
  }
}
</script>

<template>
  <div>
    <header class="page-header mb-4">
      <div>
        <h1>Cadastrar Tutor</h1>
        <p class="text-body-secondary mb-0">
          Preencha os dados para cadastrar um novo tutor.
        </p>
      </div>
    </header>

    <div
      v-if="erro"
      class="alert alert-danger"
      role="alert"
    >
      {{ erro }}
    </div>

    <form
      class="tutor-form"
      novalidate
      :aria-busy="salvando || consultandoCep"
      @submit.prevent="salvarTutor"
    >
      <fieldset
        v-for="secao in secoes"
        :key="secao.id"
        class="tutor-form-section border-0 p-0"
        :class="secao.id === 'endereco-tutor' ? 'mb-2' : 'mb-4'"
        :aria-labelledby="secao.id"
        :disabled="salvando"
      >
        <h2 :id="secao.id">{{ secao.titulo }}</h2>
        <div class="row g-3">
          <div
            v-for="campo in secao.campos"
            :key="campo.nome"
            class="col-12"
            :class="campo.coluna || 'col-md-6'"
          >
            <label
              :for="idCampo(campo.nome)"
              class="form-label"
              >{{ campo.label }}</label
            >
            <select
              v-if="campo.nome === 'estado'"
              :id="idCampo(campo.nome)"
              :value="formulario.estado"
              class="form-select"
              name="estado"
              :autocomplete="campo.autocomplete"
              @change="atualizarCampo('estado', $event)"
              @blur="interagidos.estado = true"
            >
              <option value="">Selecione</option>
              <option
                v-for="[sigla, nome] in estados"
                :key="sigla"
                :value="sigla"
              >
                {{ sigla }} - {{ nome }}
              </option>
            </select>
            <input
              v-else
              :id="idCampo(campo.nome)"
              :value="formulario[campo.nome] || ''"
              class="form-control"
              :class="{ 'is-invalid': mostrarErro(campo.nome) }"
              :type="campo.tipo || 'text'"
              :name="campo.nome"
              :placeholder="campo.placeholder"
              :autocomplete="campo.autocomplete"
              :inputmode="campo.inputmode"
              :maxlength="campo.maxlength"
              :max="campo.tipo === 'date' ? hoje : undefined"
              :required="campo.obrigatorio"
              :disabled="campo.nome === 'id'"
              :aria-invalid="mostrarErro(campo.nome) ? 'true' : undefined"
              :aria-describedby="descricaoCampo(campo.nome)"
              :aria-busy="
                campo.nome === 'cep' && consultandoCep ? 'true' : undefined
              "
              @input="atualizarCampo(campo.nome, $event)"
              @blur="interagidos[campo.nome] = true"
            />
            <div
              v-if="mostrarErro(campo.nome)"
              :id="`${idCampo(campo.nome)}-erro`"
              class="invalid-feedback"
              aria-live="polite"
            >
              {{ erros[campo.nome] }}
            </div>
            <div
              v-if="ajudaCampo(campo.nome)"
              :id="`${idCampo(campo.nome)}-ajuda`"
              class="form-text"
            >
              {{ ajudaCampo(campo.nome) }}
            </div>
            <div
              v-if="campo.nome === 'cep'"
              id="tutor-cep-consulta"
              class="form-text"
              :class="{ 'text-danger': erroCep }"
              role="status"
              aria-live="polite"
            >
              <template v-if="consultandoCep">
                <span
                  class="spinner-border spinner-border-sm me-1"
                  aria-hidden="true"
                ></span>
                Buscando endereço...
              </template>
              <template v-else-if="erroCep">
                {{ erroCep }}
                <button
                  class="btn btn-link p-0 align-baseline"
                  type="button"
                  :disabled="salvando"
                  @click="consultarCep"
                >
                  Tentar novamente
                </button>
              </template>
              <template v-else>
                {{
                  mensagemCep ||
                  'Digite o CEP para preencher o endereço automaticamente.'
                }}
              </template>
            </div>
          </div>
        </div>
      </fieldset>

      <div
        v-if="mostrarAviso"
        class="alert alert-primary tutor-form-notice mb-2"
        role="status"
      >
        <i
          class="bi bi-info-circle-fill me-2"
          aria-hidden="true"
        ></i>
        Preencha corretamente Nome e Telefone para habilitar o cadastro.
      </div>

      <div class="d-flex justify-content-end gap-2">
        <RouterLink
          class="btn btn-outline-secondary"
          to="/tutores"
          >Cancelar</RouterLink
        >
        <button
          class="btn btn-primary"
          type="submit"
          :disabled="!formularioValido || salvando || consultandoCep"
        >
          <span
            v-if="salvando"
            class="spinner-border spinner-border-sm me-1"
            aria-hidden="true"
          ></span>
          {{ salvando ? 'Cadastrando...' : 'Cadastrar Tutor' }}
        </button>
      </div>
    </form>
  </div>
</template>
