import { onlyDigits } from '../utils/tutor.js';

const ESTADOS = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);
const TEMPO_LIMITE_MS = 9000;

function erroCep(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function indisponivel(cause) {
  return erroCep(
    'CEP_INDISPONIVEL',
    'Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.',
    cause,
  );
}

function naoEncontrado() {
  return erroCep(
    'CEP_NAO_ENCONTRADO',
    'CEP não encontrado. Confira os números ou preencha o endereço manualmente.',
  );
}

function motivoCancelamento(signal) {
  return signal.reason ?? new DOMException('Consulta cancelada.', 'AbortError');
}

export async function buscarEnderecoPorCep(cep, { signal } = {}) {
  const digits = onlyDigits(cep);
  if (!/^\d{8}$/.test(digits)) {
    throw erroCep('CEP_INVALIDO', 'Digite um CEP com 8 dígitos.');
  }
  if (signal?.aborted) throw motivoCancelamento(signal);

  const controller = new AbortController();
  const cancelar = () => controller.abort(motivoCancelamento(signal));
  signal?.addEventListener('abort', cancelar, { once: true });

  let tempoEsgotado = false;
  const timer = setTimeout(() => {
    tempoEsgotado = true;
    controller.abort();
  }, TEMPO_LIMITE_MS);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) throw naoEncontrado();
    if (!response.ok) throw indisponivel();

    const data = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw indisponivel();
    }
    if (data.erro === true || data.erro === 'true') throw naoEncontrado();

    const estado =
      typeof data.uf === 'string' ? data.uf.trim().toUpperCase() : '';
    if (
      typeof data.localidade !== 'string' ||
      !data.localidade.trim() ||
      !ESTADOS.has(estado) ||
      (data.logradouro != null && typeof data.logradouro !== 'string') ||
      (data.bairro != null && typeof data.bairro !== 'string')
    ) {
      throw indisponivel();
    }

    return {
      rua: data.logradouro?.trim() || '',
      bairro: data.bairro?.trim() || '',
      cidade: data.localidade.trim(),
      estado,
    };
  } catch (error) {
    if (signal?.aborted) throw motivoCancelamento(signal);
    if (tempoEsgotado) {
      throw erroCep(
        'CEP_INDISPONIVEL',
        'A consulta do CEP demorou demais. Tente novamente ou preencha o endereço manualmente.',
        error,
      );
    }
    if (
      error?.name === 'AbortError' ||
      ['CEP_NAO_ENCONTRADO', 'CEP_INDISPONIVEL'].includes(error?.code)
    ) {
      throw error;
    }
    throw indisponivel(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelar);
  }
}
