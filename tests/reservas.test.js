import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STATUS_RESERVA,
  calcularOcupacaoMaxima,
  consultarDisponibilidade,
  hojeDoHotel,
  periodoValido,
  reservaAtiva,
} from '../src/utils/reservas.js';

function reserva(id, entrada, saida, extras = {}) {
  return { id, petId: id, entrada, saida, status: 'reservado', ...extras };
}

test('hoje do hotel usa o mesmo calendário de São Paulo na API e na tela', () => {
  assert.equal(hojeDoHotel(new Date('2026-10-21T01:00:00Z')), '2026-10-20');
  assert.equal(hojeDoHotel(new Date('2026-10-21T03:00:00Z')), '2026-10-21');
  assert.equal(hojeDoHotel(new Date('2027-01-01T01:00:00Z')), '2026-12-31');
});

test('somente reservas e hospedagens ativas ocupam vagas', () => {
  assert.deepEqual(STATUS_RESERVA, [
    'reservado',
    'hospedado',
    'finalizado',
    'cancelado',
  ]);
  for (const status of STATUS_RESERVA) {
    assert.equal(
      reservaAtiva({ status }),
      ['reservado', 'hospedado'].includes(status),
    );
  }
  assert.equal(reservaAtiva(null), false);
  assert.equal(reservaAtiva({ status: 'desconhecido' }), false);
  const reservas = STATUS_RESERVA.map((status, id) =>
    reserva(id, '2026-10-20', '2026-10-24', { status }),
  );
  assert.equal(calcularOcupacaoMaxima(reservas), 2);
});

test('períodos exigem datas reais, formato ISO e saída posterior à entrada', () => {
  assert.equal(periodoValido('2026-10-20', '2026-10-21'), true);
  assert.equal(periodoValido('2000-02-29', '2000-03-01'), true);
  assert.equal(periodoValido('2028-02-29', '2028-03-01'), true);
  for (const [entrada, saida] of [
    ['2026-10-20', '2026-10-20'],
    ['2026-10-21', '2026-10-20'],
    ['2026-02-29', '2026-03-01'],
    ['1900-02-29', '1900-03-01'],
    ['2026-04-31', '2026-05-02'],
    ['2026-13-01', '2027-01-01'],
    ['0000-01-01', '2026-10-21'],
    ['2026-1-01', '2026-10-21'],
    ['20/10/2026', '2026-10-21'],
    ['2026-10-20', '2026-10-21T00:00:00Z'],
    [null, '2026-10-21'],
    [undefined, undefined],
    [123, '2026-10-21'],
  ]) {
    assert.equal(periodoValido(entrada, saida), false, `${entrada} / ${saida}`);
  }
});

test('ocupação usa o pico simultâneo, sem somar todas as estadias do período', () => {
  const reservas = [
    reserva(1, '2026-10-20', '2026-10-22'),
    reserva(2, '2026-10-22', '2026-10-24'),
    reserva(3, '2026-10-24', '2026-10-26'),
    reserva(4, '2026-10-21', '2026-10-25'),
  ];
  assert.equal(calcularOcupacaoMaxima(reservas), 2);
  const resultado = consultarDisponibilidade(
    reservas,
    3,
    '2026-10-20',
    '2026-10-26',
  );
  assert.equal(resultado.ocupacaoMaxima, 2);
  assert.equal(resultado.vagasDisponiveis, 1);
  assert.equal(resultado.disponivel, true);
});

test('saída e entrada no mesmo dia reutilizam uma vaga, independentemente da ordem', () => {
  const reservas = [
    reserva(2, '2026-10-22', '2026-10-24'),
    reserva(1, '2026-10-20', '2026-10-22'),
  ];
  assert.equal(calcularOcupacaoMaxima(reservas), 1);
  assert.equal(
    consultarDisponibilidade([reservas[1]], 1, '2026-10-22', '2026-10-24')
      .disponivel,
    true,
  );
  assert.equal(
    consultarDisponibilidade([reservas[0]], 1, '2026-10-20', '2026-10-22')
      .disponivel,
    true,
  );
});

test('ocupação recorta os intervalos e considera reservas que abrangem toda a consulta', () => {
  const reservas = [
    reserva(1, '2026-10-01', '2026-11-01'),
    reserva(2, '2026-10-02', '2026-10-05'),
    reserva(3, '2026-10-03', '2026-10-04'),
    reserva(4, '2026-10-20', '2026-10-22'),
  ];
  assert.equal(calcularOcupacaoMaxima(reservas), 3);
  assert.equal(calcularOcupacaoMaxima(reservas, '2026-10-20', '2026-10-21'), 2);
  assert.equal(calcularOcupacaoMaxima(reservas, '2026-10-22', '2026-10-24'), 1);
  assert.equal(calcularOcupacaoMaxima(reservas, '2026-11-01', '2026-11-05'), 0);
});

test('a vigésima vaga pode ser reservada, mas a vigésima primeira é bloqueada', () => {
  const reservas = Array.from({ length: 19 }, (_, id) =>
    reserva(id, '2026-10-20', '2026-10-24'),
  );
  const ultimaVaga = consultarDisponibilidade(
    reservas,
    20,
    '2026-10-21',
    '2026-10-23',
  );
  assert.equal(ultimaVaga.vagasDisponiveis, 1);
  assert.equal(ultimaVaga.disponivel, true);
  reservas.push(reserva(20, '2026-10-20', '2026-10-24'));
  const lotado = consultarDisponibilidade(
    reservas,
    20,
    '2026-10-21',
    '2026-10-23',
  );
  assert.equal(lotado.ocupacaoMaxima, 20);
  assert.equal(lotado.vagasDisponiveis, 0);
  assert.equal(lotado.disponivel, false);
  reservas.push(reserva(21, '2026-10-20', '2026-10-24'));
  assert.equal(
    consultarDisponibilidade(reservas, 20, '2026-10-21', '2026-10-23')
      .vagasDisponiveis,
    0,
  );
});

test('cancelamento e finalização liberam vagas e a reserva do mesmo pet', () => {
  for (const status of ['cancelado', 'finalizado']) {
    const resultado = consultarDisponibilidade(
      [reserva(1, '2026-10-20', '2026-10-24', { petId: 9, status })],
      1,
      '2026-10-21',
      '2026-10-23',
      { petId: 9 },
    );
    assert.deepEqual(resultado, {
      periodoValido: true,
      ocupacaoMaxima: 0,
      vagasDisponiveis: 1,
      petJaReservado: false,
      disponivel: true,
    });
  }
});

test('o mesmo pet não pode ter estadias sobrepostas, mesmo com IDs de tipos diferentes', () => {
  const reservas = [reserva(1, '2026-10-20', '2026-10-24', { petId: 9 })];
  for (const [entrada, saida] of [
    ['2026-10-21', '2026-10-23'],
    ['2026-10-19', '2026-10-25'],
    ['2026-10-19', '2026-10-21'],
    ['2026-10-23', '2026-10-25'],
  ]) {
    const resultado = consultarDisponibilidade(reservas, 20, entrada, saida, {
      petId: '9',
    });
    assert.equal(resultado.vagasDisponiveis, 19);
    assert.equal(resultado.petJaReservado, true);
    assert.equal(resultado.disponivel, false);
  }
  assert.equal(
    consultarDisponibilidade(reservas, 20, '2026-10-24', '2026-10-26', {
      petId: '9',
    }).disponivel,
    true,
  );
  assert.equal(
    consultarDisponibilidade(reservas, 20, '2026-10-21', '2026-10-23', {
      petId: '10',
    }).disponivel,
    true,
  );
});

test('ignorar a própria reserva permite atualizar sem contar a vaga duas vezes', () => {
  const reservas = [reserva(7, '2026-10-20', '2026-10-24', { petId: 9 })];
  assert.deepEqual(
    consultarDisponibilidade(reservas, 1, '2026-10-21', '2026-10-23', {
      petId: '9',
      ignorarReservaId: '7',
    }),
    {
      periodoValido: true,
      ocupacaoMaxima: 0,
      vagasDisponiveis: 1,
      petJaReservado: false,
      disponivel: true,
    },
  );
  assert.equal(
    consultarDisponibilidade(reservas, 1, '2026-10-21', '2026-10-23', {
      ignorarReservaId: '8',
    }).disponivel,
    false,
  );
});

test('reservas com datas inválidas não corrompem os cálculos', () => {
  const reservas = [
    reserva(1, '2026-02-29', '2026-03-02'),
    reserva(2, '2026-10-25', '2026-10-20'),
    reserva(3, '2026-10-20', '2026-10-20'),
    reserva(4, '2026-10-20', '2026-10-24'),
    null,
  ];
  assert.equal(calcularOcupacaoMaxima(reservas), 1);
  assert.equal(calcularOcupacaoMaxima([], '2026-10-20', '2026-10-24'), 0);
  assert.equal(calcularOcupacaoMaxima([]), 0);
});

test('consultas com períodos ou capacidades inválidos nunca autorizam reservas', () => {
  const reservas = [reserva(1, '2026-10-20', '2026-10-24')];
  for (const [entrada, saida] of [
    ['2026-10-24', '2026-10-20'],
    ['2026-10-20', '2026-10-20'],
    ['2026-02-29', '2026-03-02'],
    ['2026-10-20', undefined],
  ]) {
    assert.equal(calcularOcupacaoMaxima(reservas, entrada, saida), 0);
    assert.deepEqual(
      consultarDisponibilidade(reservas, 20, entrada, saida, { petId: 1 }),
      {
        periodoValido: false,
        ocupacaoMaxima: 0,
        vagasDisponiveis: 0,
        petJaReservado: false,
        disponivel: false,
      },
    );
  }
  for (const capacidade of [0, -1, 1.5, '20', NaN, Infinity, undefined]) {
    const resultado = consultarDisponibilidade(
      reservas,
      capacidade,
      '2026-10-20',
      '2026-10-24',
    );
    assert.equal(resultado.periodoValido, true);
    assert.equal(resultado.vagasDisponiveis, 0);
    assert.equal(resultado.disponivel, false);
  }
});
