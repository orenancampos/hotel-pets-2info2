import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import test from 'node:test';
import { setTimeout as aguardar } from 'node:timers/promises';
import { Low, Memory } from 'lowdb';
import { criarHandler } from '../server/index.js';
import {
  criarGerenciadorReservas,
  inicializarDadosReservas,
} from '../server/reservas.js';
import {
  normalizarIdsInteiros,
  obterProximoIdSequencial,
} from '../server/index.js';

const hoje = () => '2026-10-20';
const entrada = '2026-10-21';
const saida = '2026-10-23';

class MemoriaLenta extends Memory {
  falhar = false;
  async write(data) {
    await aguardar(2);
    if (this.falhar) {
      this.falhar = false;
      throw new Error('Falha simulada na gravação.');
    }
    return super.write(structuredClone(data));
  }
}

function contexto({
  capacidade = 20,
  reservas = [],
  pets,
  adapter = new Memory(),
} = {}) {
  const db = new Low(adapter, {
    pets:
      pets ??
      Array.from({ length: 25 }, (_, index) => ({ id: String(index + 1) })),
    reservas: structuredClone(reservas),
    configuracoes: { capacidade },
  });
  return { db, gerenciador: criarGerenciadorReservas(db, { hoje }) };
}

function reserva(petId, extras = {}) {
  return { petId, entrada, saida, status: 'reservado', ...extras };
}

function ocupadas(quantidade, extras = {}) {
  return Array.from({ length: quantidade }, (_, index) =>
    reserva(String(index + 1), { id: String(index + 1), ...extras }),
  );
}

test('inicialização inclui 20 vagas sem substituir tutores, pets ou configurações existentes', async () => {
  const db = new Low(new Memory(), {
    pets: [{ id: 'meu-pet', nome: 'Luna' }],
    tutores: [{ id: 'meu-tutor', nome: 'Ana' }],
    configuracoes: { nome: 'Hotel' },
  });
  await inicializarDadosReservas(db);
  assert.deepEqual(db.data.configuracoes, { nome: 'Hotel', capacidade: 20 });
  assert.deepEqual(db.data.reservas, []);
  assert.equal(db.data.pets[0].nome, 'Luna');
  assert.equal(db.data.tutores[0].nome, 'Ana');
  db.data.configuracoes.capacidade = 25;
  await inicializarDadosReservas(db);
  assert.equal(db.data.configuracoes.capacidade, 25);
});

test('IDs de pets e tutores seguem sequência numérica crescente', () => {
  assert.equal(obterProximoIdSequencial([{ id: 1 }, { id: 2 }]), 3);
  assert.equal(obterProximoIdSequencial([{ id: '1' }, { id: '2' }]), 3);
  assert.equal(obterProximoIdSequencial([{ id: 'abc' }, { id: 5 }]), 6);
  assert.equal(obterProximoIdSequencial([]), 1);
});

test('IDs aleatórios são normalizados para sequência numérica e atualizam tutores dos pets', () => {
  const dados = {
    tutores: [
      { id: 'T3NDA4n0BaY', nome: 'Ana' },
      { id: 2, nome: 'Carlos' },
    ],
    pets: [
      { id: '3Ywax5HiKQ4', nome: 'Luna', tutorId: 'T3NDA4n0BaY' },
      { id: '3', nome: 'Nino', tutorId: 2 },
    ],
  };

  const normalizado = normalizarIdsInteiros(dados);

  assert.deepEqual(
    normalizado.tutores.map((item) => ({ id: item.id, nome: item.nome })),
    [
      { id: 1, nome: 'Ana' },
      { id: 2, nome: 'Carlos' },
    ],
  );
  assert.deepEqual(
    normalizado.pets.map((item) => ({
      id: item.id,
      nome: item.nome,
      tutorId: item.tutorId,
    })),
    [
      { id: 1, nome: 'Luna', tutorId: 1 },
      { id: 2, nome: 'Nino', tutorId: 2 },
    ],
  );
});

test('dois cadastros concorrentes disputando a última das 20 vagas só confirmam um', async () => {
  const { db, gerenciador } = contexto({
    reservas: ocupadas(19),
    adapter: new MemoriaLenta(),
  });
  const respostas = await Promise.allSettled([
    gerenciador.criarReserva(reserva('20')),
    gerenciador.criarReserva(reserva('21')),
  ]);
  assert.equal(
    respostas.filter((resposta) => resposta.status === 'fulfilled').length,
    1,
  );
  const falha = respostas.find((resposta) => resposta.status === 'rejected');
  assert.equal(falha.reason.status, 409);
  assert.equal(falha.reason.code, 'HOTEL_LOTADO');
  assert.equal(db.data.reservas.length, 20);
  const persistido = await db.adapter.read();
  assert.equal(persistido.reservas.length, 20);
});

test('redução concorrente da capacidade respeita a reserva confirmada primeiro', async () => {
  const { db, gerenciador } = contexto({
    capacidade: 2,
    reservas: ocupadas(1),
    adapter: new MemoriaLenta(),
  });
  const respostas = await Promise.allSettled([
    gerenciador.criarReserva(reserva('2')),
    gerenciador.atualizarConfiguracoes({ capacidade: 1 }),
  ]);
  assert.equal(respostas[0].status, 'fulfilled');
  assert.equal(respostas[1].reason.code, 'CAPACIDADE_OCUPADA');
  assert.equal(db.data.configuracoes.capacidade, 2);
});

test('reserva concorrente respeita a capacidade reduzida primeiro', async () => {
  const { db, gerenciador } = contexto({
    capacidade: 2,
    reservas: ocupadas(1),
    adapter: new MemoriaLenta(),
  });
  const respostas = await Promise.allSettled([
    gerenciador.atualizarConfiguracoes({ capacidade: 1 }),
    gerenciador.criarReserva(reserva('2')),
  ]);
  assert.equal(respostas[0].status, 'fulfilled');
  assert.equal(respostas[1].reason.code, 'HOTEL_LOTADO');
  assert.equal(db.data.reservas.length, 1);
});

test('a saída libera vaga no próprio dia e canceladas/finalizadas não ocupam vagas', async () => {
  const { gerenciador } = contexto({
    capacidade: 1,
    reservas: [
      ...ocupadas(1, { saida: entrada }),
      reserva('2', { id: 'cancelada', status: 'cancelado' }),
      reserva('3', { id: 'finalizada', status: 'finalizado' }),
    ],
  });
  const criada = await gerenciador.criarReserva(reserva('4'));
  assert.equal(criada.petId, '4');
});

test('pet com IDs numérico e textual não recebe duas reservas sobrepostas', async () => {
  const { gerenciador } = contexto({
    pets: [{ id: 1 }],
    reservas: [reserva(1, { id: 'existente' })],
  });
  await assert.rejects(gerenciador.criarReserva(reserva('1')), {
    status: 409,
    code: 'PET_JA_RESERVADO',
  });
  const criada = await gerenciador.criarReserva(
    reserva(1, { entrada: saida, saida: '2026-10-25' }),
  );
  assert.equal(criada.petId, '1');
  assert.equal(typeof criada.id, 'string');
});

test('ID é gerado pelo servidor e campos extras não alteram a capacidade', async () => {
  const { db, gerenciador } = contexto();
  const criada = await gerenciador.criarReserva({
    ...reserva('1'),
    id: 'forjado',
    capacidade: 999,
    configuracoes: { capacidade: 999 },
  });
  assert.notEqual(criada.id, 'forjado');
  assert.equal(criada.capacidade, undefined);
  assert.equal(db.data.configuracoes.capacidade, 20);
});

test('datas reais, sequência, passado, pet e status são validados sem gravar', async (t) => {
  const casos = [
    [null, 'CORPO_INVALIDO'],
    [[], 'CORPO_INVALIDO'],
    [
      reserva('1', { entrada: '2026-02-30', saida: '2026-03-02' }),
      'PERIODO_INVALIDO',
    ],
    [reserva('1', { entrada: saida }), 'PERIODO_INVALIDO'],
    [reserva('1', { entrada: '2026-10-19' }), 'ENTRADA_PASSADA'],
    [reserva('inexistente'), 'PET_INVALIDO'],
    [reserva(null), 'PET_INVALIDO'],
    [reserva('1', { status: 'qualquer' }), 'STATUS_INVALIDO'],
    [reserva('1', { status: null }), 'STATUS_INVALIDO'],
  ];
  for (const [indice, [body, code]] of casos.entries()) {
    await t.test(`entrada inválida ${indice + 1}`, async () => {
      const { db, gerenciador } = contexto();
      await assert.rejects(gerenciador.criarReserva(body), {
        status: 400,
        code,
      });
      assert.equal(db.data.reservas.length, 0);
    });
  }
});

test('falha de validação não bloqueia as próximas operações da fila', async () => {
  const { db, gerenciador } = contexto();
  const resultados = await Promise.allSettled([
    gerenciador.criarReserva(null),
    gerenciador.criarReserva(reserva('1')),
  ]);
  assert.equal(resultados[0].status, 'rejected');
  assert.equal(resultados[1].status, 'fulfilled');
  assert.equal(db.data.reservas.length, 1);
});

test('falha de gravação não deixa reserva fantasma nem bloqueia a fila', async () => {
  const adapter = new MemoriaLenta();
  const { db, gerenciador } = contexto({ capacidade: 1, adapter });
  adapter.falhar = true;
  const resultados = await Promise.allSettled([
    gerenciador.criarReserva(reserva('1')),
    gerenciador.criarReserva(reserva('2')),
  ]);
  assert.equal(resultados[0].status, 'rejected');
  assert.equal(resultados[1].status, 'fulfilled');
  assert.deepEqual(
    db.data.reservas.map((item) => item.petId),
    ['2'],
  );
});

test('PATCH e PUT não reativam uma reserva quando o hotel já está lotado', async () => {
  const { db, gerenciador } = contexto({
    capacidade: 1,
    reservas: [
      ...ocupadas(1),
      reserva('2', { id: 'cancelada', status: 'cancelado' }),
    ],
  });
  await assert.rejects(
    gerenciador.atualizarReserva('cancelada', { status: 'hospedado' }),
    {
      code: 'HOTEL_LOTADO',
    },
  );
  await assert.rejects(
    gerenciador.atualizarReserva('cancelada', reserva('2'), {
      substituir: true,
    }),
    { code: 'HOTEL_LOTADO' },
  );
  assert.equal(db.data.reservas[1].status, 'cancelado');
});

test('alterar datas ou pet também revalida disponibilidade e duplicidade', async () => {
  const { gerenciador } = contexto({
    capacidade: 2,
    reservas: [
      reserva('1', { id: 1 }),
      reserva('2', { id: 2 }),
      reserva('3', { id: 3, entrada: '2026-10-25', saida: '2026-10-28' }),
    ],
  });
  await assert.rejects(gerenciador.atualizarReserva('3', { entrada, saida }), {
    code: 'HOTEL_LOTADO',
  });
  await assert.rejects(gerenciador.atualizarReserva('2', { petId: '1' }), {
    code: 'PET_JA_RESERVADO',
  });
  const mantida = await gerenciador.atualizarReserva('1', {
    status: 'hospedado',
  });
  assert.equal(mantida.status, 'hospedado');
});

test('cancelar, finalizar e excluir liberam a vaga para outra reserva', async (t) => {
  for (const operacao of ['cancelado', 'finalizado', 'excluir']) {
    await t.test(operacao, async () => {
      const { gerenciador } = contexto({
        capacidade: 1,
        reservas: ocupadas(1),
      });
      if (operacao === 'excluir') await gerenciador.removerReserva('1');
      else await gerenciador.atualizarReserva('1', { status: operacao });
      const criada = await gerenciador.criarReserva(reserva('2'));
      assert.equal(criada.petId, '2');
    });
  }
});

test('reduzir capacidade considera estadias já iniciadas e picos futuros; ignora as encerradas', async () => {
  const { db, gerenciador } = contexto({
    capacidade: 20,
    reservas: [
      reserva('1', {
        id: 'antiga',
        entrada: '2026-10-01',
        saida: '2026-10-19',
      }),
      reserva('2', {
        id: 'hospedada',
        entrada: '2026-10-18',
        status: 'hospedado',
      }),
      reserva('3', { id: 'futura' }),
    ],
  });
  await assert.rejects(gerenciador.atualizarConfiguracoes({ capacidade: 1 }), {
    code: 'CAPACIDADE_OCUPADA',
  });
  await gerenciador.atualizarConfiguracoes({ capacidade: 2 });
  assert.equal(db.data.configuracoes.capacidade, 2);
  await gerenciador.atualizarReserva('futura', { status: 'cancelado' });
  await gerenciador.atualizarConfiguracoes({ capacidade: 1 });
  assert.equal(db.data.configuracoes.capacidade, 1);
});

test('capacidade inválida não é aceita e falha de gravação restaura o limite anterior', async () => {
  const adapter = new MemoriaLenta();
  const { db, gerenciador } = contexto({ adapter });
  for (const capacidade of [0, -1, 1.5, 1000, '20', null]) {
    await assert.rejects(gerenciador.atualizarConfiguracoes({ capacidade }), {
      status: 400,
      code: 'CAPACIDADE_INVALIDA',
    });
  }
  adapter.falhar = true;
  await assert.rejects(gerenciador.atualizarConfiguracoes({ capacidade: 2 }));
  assert.equal(db.data.configuracoes.capacidade, 20);
  await gerenciador.atualizarConfiguracoes({ capacidade: 3 });
  assert.equal(db.data.configuracoes.capacidade, 3);
});

test('PATCH preserva ID e PUT exige os dados completos da reserva', async () => {
  const { gerenciador } = contexto({ reservas: ocupadas(1) });
  const atualizada = await gerenciador.atualizarReserva('1', {
    id: 'outro',
    status: 'hospedado',
  });
  assert.equal(atualizada.id, '1');
  await assert.rejects(
    gerenciador.atualizarReserva(
      '1',
      { status: 'reservado' },
      { substituir: true },
    ),
    { code: 'PERIODO_INVALIDO' },
  );
  await assert.rejects(gerenciador.atualizarReserva('inexistente', {}), {
    status: 404,
    code: 'RESERVA_NAO_ENCONTRADA',
  });
});

test('pet com reserva ativa não pode ser removido até ela ser cancelada ou finalizada', async () => {
  const { db, gerenciador } = contexto({ reservas: ocupadas(1) });
  await assert.rejects(gerenciador.removerPet('1'), {
    status: 409,
    code: 'PET_COM_RESERVAS',
  });
  await gerenciador.atualizarReserva('1', { status: 'cancelado' });
  const removido = await gerenciador.removerPet('1');
  assert.equal(removido.id, '1');
  assert.equal(
    db.data.pets.some((pet) => pet.id === '1'),
    false,
  );
  assert.equal(db.data.reservas[0].petId, '1');
});

test('remover pet disputa a mesma fila com uma nova reserva', async () => {
  const { db, gerenciador } = contexto({ adapter: new MemoriaLenta() });
  const resultados = await Promise.allSettled([
    gerenciador.removerPet('1'),
    gerenciador.criarReserva(reserva('1')),
  ]);
  assert.equal(resultados[0].status, 'fulfilled');
  assert.equal(resultados[1].reason.code, 'PET_INVALIDO');
  assert.equal(db.data.reservas.length, 0);
});

test('reserva legada sem pet pode ser encerrada, mas não reativada', async () => {
  const { db, gerenciador } = contexto({
    capacidade: 1,
    reservas: [reserva(null, { id: 'legada' })],
  });
  const encerrada = await gerenciador.atualizarReserva('legada', {
    status: 'finalizado',
  });
  assert.equal(encerrada.petId, null);
  assert.equal(encerrada.status, 'finalizado');
  await assert.rejects(
    gerenciador.atualizarReserva('legada', { status: 'reservado' }),
    {
      code: 'PET_INVALIDO',
    },
  );
  await gerenciador.criarReserva(reserva('1'));
  assert.equal(db.data.reservas.length, 2);
});

test('falha ao remover pet restaura o pet e preserva o histórico de reservas', async () => {
  const adapter = new MemoriaLenta();
  const { db, gerenciador } = contexto({
    adapter,
    reservas: [reserva('1', { id: 'cancelada', status: 'cancelado' })],
  });
  adapter.falhar = true;
  await assert.rejects(gerenciador.removerPet('1'));
  assert.equal(db.data.pets[0].id, '1');
  assert.equal(db.data.reservas[0].petId, '1');
});

async function requisitar(
  handler,
  { method, path, body, raw, contentType = 'application/json' },
) {
  const req = Readable.from([Buffer.from(raw ?? JSON.stringify(body) ?? '')]);
  req.method = method;
  req.url = path;
  req.headers = { 'content-type': contentType };
  const headers = {};
  let resposta;
  const res = {
    statusCode: 200,
    setHeader(nome, valor) {
      headers[nome.toLowerCase()] = valor;
    },
    end(texto) {
      resposta = JSON.parse(texto);
    },
  };
  await handler(req, res);
  return { status: res.statusCode, body: resposta, headers };
}

test('camada HTTP bloqueia rotas alternativas de escrita que burlariam a validação', async (t) => {
  const { db } = contexto({ reservas: ocupadas(20) });
  const handler = criarHandler(db, { hoje });
  for (const [method, path] of [
    ['PUT', '/reservas'],
    ['PATCH', '/reservas'],
    ['DELETE', '/reservas'],
    ['POST', '/reservas/1'],
    ['POST', '/configuracoes'],
    ['DELETE', '/configuracoes'],
    ['PATCH', '/configuracoes/1'],
  ]) {
    await t.test(`${method} ${path}`, async () => {
      const resposta = await requisitar(handler, {
        method,
        path,
        body: { capacidade: 999 },
      });
      assert.equal(resposta.status, 405);
      assert.equal(resposta.headers['access-control-allow-origin'], '*');
    });
  }
  const resposta = await requisitar(handler, {
    method: 'POST',
    path: '/reservas',
    body: reserva('21'),
  });
  assert.equal(resposta.status, 409);
  assert.equal(resposta.body.code, 'HOTEL_LOTADO');
  assert.equal(db.data.configuracoes.capacidade, 20);
  assert.equal(db.data.reservas.length, 20);
});

test('camada HTTP informa JSON inválido, tipo incorreto e objeto inválido com CORS', async () => {
  const { db } = contexto();
  const handler = criarHandler(db, { hoje });
  for (const opcoes of [
    { raw: '{' },
    { body: null },
    { body: [] },
    { body: reserva('1'), contentType: 'text/plain' },
  ]) {
    const resposta = await requisitar(handler, {
      method: 'POST',
      path: '/reservas',
      ...opcoes,
    });
    assert.equal(resposta.status, 400);
    assert.equal(typeof resposta.body.message, 'string');
    assert.equal(resposta.headers['access-control-allow-origin'], '*');
  }
  const resposta = await requisitar(handler, {
    method: 'POST',
    path: '/reservas',
    body: reserva('1'),
  });
  assert.equal(resposta.status, 201);
  assert.equal(resposta.body.petId, '1');
});
