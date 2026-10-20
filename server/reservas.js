import { Service } from 'json-server/lib/service.js';
import {
  calcularOcupacaoMaxima,
  consultarDisponibilidade,
  hojeDoHotel,
  periodoValido,
  reservaAtiva,
} from '../src/utils/reservas.js';

const STATUS_VALIDOS = new Set([
  'reservado',
  'hospedado',
  'finalizado',
  'cancelado',
]);

export class ErroReserva extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ErroReserva';
    this.status = status;
    this.code = code;
  }
}

export { hojeDoHotel };

function objetoValido(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function exigirObjeto(body) {
  if (!objetoValido(body)) {
    throw new ErroReserva(
      400,
      'CORPO_INVALIDO',
      'Envie os dados como um objeto JSON.',
    );
  }
}

function capacidadeValida(capacidade) {
  return Number.isInteger(capacidade) && capacidade >= 1 && capacidade <= 999;
}

function prepararDados(db) {
  let alterado = false;
  if (db.data.reservas === undefined) {
    db.data.reservas = [];
    alterado = true;
  }
  if (!Array.isArray(db.data.reservas)) {
    throw new Error('A coleção reservas do banco precisa ser uma lista.');
  }
  if (db.data.configuracoes === undefined) {
    db.data.configuracoes = { capacidade: 20 };
    alterado = true;
  }
  if (!objetoValido(db.data.configuracoes)) {
    throw new Error('As configurações do banco precisam ser um objeto.');
  }
  if (db.data.configuracoes.capacidade === undefined) {
    db.data.configuracoes.capacidade = 20;
    alterado = true;
  }
  if (!capacidadeValida(db.data.configuracoes.capacidade)) {
    throw new Error(
      'A capacidade do hotel precisa ser um inteiro entre 1 e 999.',
    );
  }
  return alterado;
}

export async function inicializarDadosReservas(db) {
  if (prepararDados(db)) await db.write();
}

// Uma única fila cobre a consulta, a alteração e a gravação. Assim, duas
// requisições na mesma instância não conseguem reservar a última vaga juntas.
export function criarGerenciadorReservas(db, { hoje = hojeDoHotel } = {}) {
  prepararDados(db);
  const service = new Service(db);
  let pendente = Promise.resolve();

  function serializar(acao) {
    const atual = pendente.then(acao);
    pendente = atual.catch(() => {});
    return atual;
  }

  async function gravar(recurso, acao) {
    const anterior = structuredClone(db.data[recurso]);
    try {
      return await acao();
    } catch (erro) {
      db.data[recurso] = anterior;
      throw erro;
    }
  }

  function encontrarReserva(id) {
    const reserva = db.data.reservas.find(
      (item) => String(item.id) === String(id),
    );
    if (!reserva) {
      throw new ErroReserva(
        404,
        'RESERVA_NAO_ENCONTRADA',
        'Reserva não encontrada.',
      );
    }
    return reserva;
  }

  function validarReserva(body, { atual, nova = false } = {}) {
    exigirObjeto(body);
    const status =
      body.status === undefined && nova ? 'reservado' : body.status;
    if (!STATUS_VALIDOS.has(status)) {
      throw new ErroReserva(
        400,
        'STATUS_INVALIDO',
        'Selecione um status válido para a reserva.',
      );
    }
    if (!periodoValido(body.entrada, body.saida)) {
      throw new ErroReserva(
        400,
        'PERIODO_INVALIDO',
        'Informe datas válidas; a saída deve ser posterior à entrada.',
      );
    }
    if (nova && body.entrada < hoje()) {
      throw new ErroReserva(
        400,
        'ENTRADA_PASSADA',
        'A entrada deve ser hoje ou uma data futura.',
      );
    }

    const idValido =
      (typeof body.petId === 'string' && body.petId.trim() !== '') ||
      (typeof body.petId === 'number' && Number.isFinite(body.petId));
    const pet = idValido
      ? db.data.pets?.find((item) => String(item.id) === String(body.petId))
      : undefined;
    const cancelarLegada =
      atual &&
      !reservaAtiva({ status }) &&
      String(body.petId) === String(atual.petId);
    if (!pet && !cancelarLegada) {
      throw new ErroReserva(
        400,
        'PET_INVALIDO',
        'Selecione um pet cadastrado.',
      );
    }

    const reserva = {
      petId: pet ? String(pet.id) : atual.petId,
      entrada: body.entrada,
      saida: body.saida,
      status,
    };
    if (reservaAtiva(reserva)) {
      const disponibilidade = consultarDisponibilidade(
        db.data.reservas,
        db.data.configuracoes.capacidade,
        reserva.entrada,
        reserva.saida,
        { petId: reserva.petId, ignorarReservaId: atual?.id },
      );
      if (disponibilidade.petJaReservado) {
        throw new ErroReserva(
          409,
          'PET_JA_RESERVADO',
          'Este pet já tem uma reserva ativa nesse período.',
        );
      }
      if (!disponibilidade.disponivel) {
        throw new ErroReserva(
          409,
          'HOTEL_LOTADO',
          'Não há vagas disponíveis em todas as datas desse período. Escolha outras datas.',
        );
      }
    }
    return reserva;
  }

  return {
    criarReserva(body) {
      return serializar(async () => {
        const reserva = validarReserva(body, { nova: true });
        return gravar('reservas', () => service.create('reservas', reserva));
      });
    },

    atualizarReserva(id, body, { substituir = false } = {}) {
      return serializar(async () => {
        exigirObjeto(body);
        const atual = encontrarReserva(id);
        const reserva = validarReserva(
          substituir ? body : { ...atual, ...body },
          { atual },
        );
        return gravar('reservas', () =>
          service.updateById('reservas', atual.id, reserva),
        );
      });
    },

    removerReserva(id) {
      return serializar(async () => {
        const atual = encontrarReserva(id);
        return gravar('reservas', () =>
          service.destroyById('reservas', atual.id),
        );
      });
    },

    removerPet(id) {
      return serializar(async () => {
        const pet = db.data.pets?.find(
          (item) => String(item.id) === String(id),
        );
        if (!pet) {
          throw new ErroReserva(
            404,
            'PET_NAO_ENCONTRADO',
            'Pet não encontrado.',
          );
        }
        const temReserva = db.data.reservas.some(
          (reserva) =>
            String(reserva.petId) === String(id) &&
            reservaAtiva(reserva) &&
            reserva.saida > hoje(),
        );
        if (temReserva) {
          throw new ErroReserva(
            409,
            'PET_COM_RESERVAS',
            'Este pet possui reservas ativas. Cancele ou finalize essas reservas antes de remover o pet.',
          );
        }
        return gravar('pets', async () => {
          // Preservar o petId nas reservas encerradas mantém o vínculo histórico.
          db.data.pets = db.data.pets.filter((item) => item !== pet);
          await db.write();
          return pet;
        });
      });
    },

    atualizarConfiguracoes(body, { substituir = false } = {}) {
      return serializar(async () => {
        exigirObjeto(body);
        if (!capacidadeValida(body.capacidade)) {
          throw new ErroReserva(
            400,
            'CAPACIDADE_INVALIDA',
            'Informe uma capacidade inteira entre 1 e 999 vagas.',
          );
        }
        const pico = calcularOcupacaoMaxima(
          db.data.reservas,
          hoje(),
          '9999-12-31',
        );
        if (body.capacidade < pico) {
          throw new ErroReserva(
            409,
            'CAPACIDADE_OCUPADA',
            `Há ${pico} reservas simultâneas confirmadas. A capacidade não pode ser menor que ${pico} vagas.`,
          );
        }
        const configuracao = { capacidade: body.capacidade };
        return gravar('configuracoes', () =>
          substituir
            ? service.update('configuracoes', configuracao)
            : service.patch('configuracoes', configuracao),
        );
      });
    },
  };
}
