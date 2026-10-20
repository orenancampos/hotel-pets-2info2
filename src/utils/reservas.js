import { isDataNascimentoValida } from './tutor.js';

export const STATUS_RESERVA = Object.freeze([
  'reservado',
  'hospedado',
  'finalizado',
  'cancelado',
]);

export function hojeDoHotel(data = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);
  const valor = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function reservaAtiva(reserva) {
  return reserva?.status === 'reservado' || reserva?.status === 'hospedado';
}

function dataValida(value) {
  return (
    typeof value === 'string' && isDataNascimentoValida(value, '9999-12-31')
  );
}

export function periodoValido(entrada, saida) {
  return dataValida(entrada) && dataValida(saida) && entrada < saida;
}

function reservasValidas(reservas) {
  return (Array.isArray(reservas) ? reservas : []).filter(
    (reserva) =>
      reservaAtiva(reserva) && periodoValido(reserva.entrada, reserva.saida),
  );
}

function sobrepoe(reserva, entrada, saida) {
  // A saída libera a vaga: duas estadias podem se encontrar no mesmo dia.
  return reserva.entrada < saida && reserva.saida > entrada;
}

export function calcularOcupacaoMaxima(reservas, entrada, saida) {
  const limitarPeriodo = entrada !== undefined || saida !== undefined;
  if (limitarPeriodo && !periodoValido(entrada, saida)) return 0;

  const eventos = [];
  for (const reserva of reservasValidas(reservas)) {
    if (limitarPeriodo && !sobrepoe(reserva, entrada, saida)) continue;
    const inicio =
      limitarPeriodo && reserva.entrada < entrada ? entrada : reserva.entrada;
    const fim = limitarPeriodo && reserva.saida > saida ? saida : reserva.saida;
    eventos.push([inicio, 1], [fim, -1]);
  }

  // Nos empates, processar saídas antes de entradas evita contar vagas em dobro.
  eventos.sort(([dataA, variacaoA], [dataB, variacaoB]) =>
    dataA === dataB ? variacaoA - variacaoB : dataA < dataB ? -1 : 1,
  );

  let ocupacao = 0;
  let maxima = 0;
  for (const [, variacao] of eventos) {
    ocupacao += variacao;
    maxima = Math.max(maxima, ocupacao);
  }
  return maxima;
}

export function consultarDisponibilidade(
  reservas,
  capacidade,
  entrada,
  saida,
  { petId, ignorarReservaId } = {},
) {
  const periodoCorreto = periodoValido(entrada, saida);
  const capacidadeCorreta = Number.isInteger(capacidade) && capacidade > 0;
  const consideradas = reservasValidas(reservas).filter(
    (reserva) =>
      ignorarReservaId === undefined ||
      ignorarReservaId === null ||
      String(reserva.id) !== String(ignorarReservaId),
  );
  const ocupacaoMaxima = periodoCorreto
    ? calcularOcupacaoMaxima(consideradas, entrada, saida)
    : 0;
  const vagasDisponiveis =
    periodoCorreto && capacidadeCorreta
      ? Math.max(0, capacidade - ocupacaoMaxima)
      : 0;
  const petJaReservado =
    periodoCorreto &&
    petId !== undefined &&
    petId !== null &&
    petId !== '' &&
    consideradas.some(
      (reserva) =>
        String(reserva.petId) === String(petId) &&
        sobrepoe(reserva, entrada, saida),
    );

  return {
    periodoValido: periodoCorreto,
    ocupacaoMaxima,
    vagasDisponiveis,
    petJaReservado,
    disponivel: vagasDisponiveis > 0 && !petJaReservado,
  };
}
