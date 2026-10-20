import assert from 'node:assert/strict';
import test from 'node:test';
import { buscarEnderecoPorCep } from '../src/services/cep.js';

const endereco = {
  logradouro: 'Praça da Sé',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
};

function mockResposta(t, data, { status = 200 } = {}) {
  return t.mock.method(globalThis, 'fetch', async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }));
}

test('consulta ViaCEP com CEP normalizado e mapeia os campos do endereço', async (t) => {
  const fetchMock = mockResposta(t, endereco);
  assert.deepEqual(await buscarEnderecoPorCep('01001-000'), {
    rua: 'Praça da Sé',
    bairro: 'Sé',
    cidade: 'São Paulo',
    estado: 'SP',
  });
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
  assert.equal(options.signal instanceof AbortSignal, true);
});

test('CEP geral sem rua ou bairro mantém esses campos vazios', async (t) => {
  mockResposta(t, { localidade: 'Joinville', uf: 'SC' });
  assert.deepEqual(await buscarEnderecoPorCep('89200000'), {
    rua: '',
    bairro: '',
    cidade: 'Joinville',
    estado: 'SC',
  });
});

test('CEP incompleto ou longo é rejeitado sem acessar a rede', async (t) => {
  const fetchMock = mockResposta(t, endereco);
  for (const cep of ['', '01001-00', '010010000']) {
    await assert.rejects(buscarEnderecoPorCep(cep), { code: 'CEP_INVALIDO' });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('retorno de CEP inexistente aceita erro booleano ou string', async (t) => {
  for (const erro of [true, 'true']) {
    await t.test(String(erro), async (st) => {
      mockResposta(st, { erro });
      await assert.rejects(buscarEnderecoPorCep('99999999'), {
        code: 'CEP_NAO_ENCONTRADO',
      });
    });
  }
});

test('HTTP 404 é tratado como CEP não encontrado', async (t) => {
  mockResposta(t, null, { status: 404 });
  await assert.rejects(buscarEnderecoPorCep('99999999'), {
    code: 'CEP_NAO_ENCONTRADO',
  });
});

test('falhas HTTP e de rede produzem uma mensagem que permite cadastro manual', async (t) => {
  await t.test('HTTP', async (st) => {
    mockResposta(st, null, { status: 503 });
    await assert.rejects(buscarEnderecoPorCep('01001000'), {
      code: 'CEP_INDISPONIVEL',
      message: /preencha o endereço manualmente/,
    });
  });
  await t.test('rede', async (st) => {
    st.mock.method(globalThis, 'fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await assert.rejects(buscarEnderecoPorCep('01001000'), {
      code: 'CEP_INDISPONIVEL',
      message: /preencha o endereço manualmente/,
    });
  });
});

test('respostas sem cidade, UF válida ou campos textuais são rejeitadas', async (t) => {
  const invalidas = [
    null,
    [],
    {},
    { uf: 'SP' },
    { ...endereco, localidade: '' },
    { ...endereco, uf: 'ZZ' },
    { ...endereco, logradouro: 123 },
    { ...endereco, bairro: {} },
  ];
  for (const [index, resposta] of invalidas.entries()) {
    await t.test(`resposta ${index + 1}`, async (st) => {
      mockResposta(st, resposta);
      await assert.rejects(buscarEnderecoPorCep('01001000'), {
        code: 'CEP_INDISPONIVEL',
      });
    });
  }
});

test('JSON malformado produz falha amigável', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  }));
  await assert.rejects(buscarEnderecoPorCep('01001000'), {
    code: 'CEP_INDISPONIVEL',
  });
});

test('sinal já cancelado evita a consulta e preserva o motivo', async (t) => {
  const fetchMock = mockResposta(t, endereco);
  const controller = new AbortController();
  const reason = new DOMException('Cancelado pelo formulário.', 'AbortError');
  controller.abort(reason);
  await assert.rejects(
    buscarEnderecoPorCep('01001000', { signal: controller.signal }),
    (error) => error === reason,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('cancelamento externo interrompe a consulta e preserva AbortError', async (t) => {
  let receivedSignal;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    receivedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      });
    });
  });
  const controller = new AbortController();
  const reason = new DOMException('CEP alterado.', 'AbortError');
  const consulta = buscarEnderecoPorCep('01001000', {
    signal: controller.signal,
  });
  controller.abort(reason);
  await assert.rejects(consulta, (error) => error === reason);
  assert.equal(receivedSignal.aborted, true);
});

test('AbortError do fetch permanece um cancelamento', async (t) => {
  const reason = new DOMException('Consulta cancelada.', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => {
    throw reason;
  });
  await assert.rejects(
    buscarEnderecoPorCep('01001000'),
    (error) => error === reason,
  );
});

test('tempo limite cancela a consulta e oferece preenchimento manual', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let receivedSignal;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    receivedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      });
    });
  });
  const consulta = buscarEnderecoPorCep('01001000');
  t.mock.timers.tick(9000);
  await assert.rejects(consulta, {
    code: 'CEP_INDISPONIVEL',
    message: /demorou demais/,
  });
  assert.equal(receivedSignal.aborted, true);
});
