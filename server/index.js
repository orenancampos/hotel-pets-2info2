import { Buffer } from 'node:buffer';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp } from 'json-server/lib/app.js';
import { NormalizedAdapter } from 'json-server/lib/adapters/normalized-adapter.js';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import {
  criarGerenciadorReservas,
  ErroReserva,
  inicializarDadosReservas,
} from './reservas.js';

function responderJson(res, status, dados) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(dados));
}

async function lerJson(req) {
  if (
    !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')
  ) {
    throw new ErroReserva(
      400,
      'CORPO_INVALIDO',
      'Envie os dados no formato application/json.',
    );
  }
  let tamanho = 0;
  const partes = [];
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > 102400) {
      throw new ErroReserva(
        413,
        'CORPO_MUITO_GRANDE',
        'Os dados enviados excedem o tamanho permitido.',
      );
    }
    partes.push(parte);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}');
  } catch {
    throw new ErroReserva(400, 'JSON_INVALIDO', 'O JSON enviado não é válido.');
  }
}

export function normalizarIdInteiro(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  if (typeof valor === 'number') {
    return Number.isInteger(valor) && valor > 0 ? valor : null;
  }

  if (typeof valor === 'string') {
    const texto = valor.trim();
    if (!/^\d+$/.test(texto)) {
      return null;
    }

    const numero = Number(texto);
    return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
  }

  return null;
}

export function obterProximoIdSequencial(itens = []) {
  const maiorValor = Array.isArray(itens)
    ? itens.reduce((maior, item) => {
        const valor = normalizarIdInteiro(item?.id);
        return valor !== null && valor > maior ? valor : maior;
      }, 0)
    : 0;

  return maiorValor + 1;
}

export function normalizarIdsInteiros(dados = {}) {
  const resultado = { ...dados };
  const tutores = Array.isArray(resultado.tutores) ? resultado.tutores : [];
  const pets = Array.isArray(resultado.pets) ? resultado.pets : [];

  const mapaTutor = new Map();
  let proximoTutor = 1;

  resultado.tutores = tutores.map((item) => {
    const idNormalizado = proximoTutor;
    mapaTutor.set(String(item?.id ?? ''), idNormalizado);
    proximoTutor += 1;
    return { ...item, id: idNormalizado };
  });

  let proximoPet = 1;
  resultado.pets = pets.map((item) => {
    const idNormalizado = proximoPet;
    proximoPet += 1;

    const tutorIdOriginal = item?.tutorId;
    const tutorIdNormalizado =
      tutorIdOriginal !== undefined && tutorIdOriginal !== null
        ? (mapaTutor.get(String(tutorIdOriginal)) ??
          normalizarIdInteiro(tutorIdOriginal) ??
          tutorIdOriginal)
        : tutorIdOriginal;

    return {
      ...item,
      id: idNormalizado,
      tutorId: tutorIdNormalizado,
    };
  });

  return resultado;
}

export function criarHandler(db, opcoes = {}) {
  const gerenciador = criarGerenciadorReservas(db, opcoes);
  const app = createApp(db);

  return async (req, res) => {
    let partes;
    try {
      partes = new URL(req.url, 'http://localhost').pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
    } catch {
      responderJson(res, 400, {
        error: 'Endereço inválido.',
        code: 'URL_INVALIDA',
      });
      return;
    }
    const [recurso, id] = partes;
    const remocaoPet =
      recurso === 'pets' && req.method === 'DELETE' && partes.length === 2;
    const protegido =
      recurso === 'reservas' || recurso === 'configuracoes' || remocaoPet;

    if (
      ['pets', 'tutores'].includes(recurso) &&
      req.method === 'POST' &&
      partes.length === 1
    ) {
      try {
        const dados = await lerJson(req);
        const lista = Array.isArray(db.data?.[recurso]) ? db.data[recurso] : [];
        const novoId = obterProximoIdSequencial(lista);
        const itemSemId = { ...dados };
        delete itemSemId.id;

        const item = {
          ...itemSemId,
          id: novoId,
        };

        if (recurso === 'pets') {
          const tutorId = normalizarIdInteiro(item.tutorId);
          item.tutorId = tutorId ?? item.tutorId;
        }

        db.data ??= {};
        db.data[recurso] = [...lista, item];
        await db.write();
        responderJson(res, 201, item);
      } catch (erro) {
        const conhecido = erro instanceof ErroReserva;
        const message = conhecido
          ? erro.message
          : 'Não foi possível salvar os dados. Tente novamente.';
        responderJson(res, conhecido ? erro.status : 500, {
          error: message,
          message,
          code: conhecido ? erro.code : 'ERRO_INTERNO',
        });
      }
      return;
    }

    if (!protegido || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      app.attach(req, res);
      return;
    }

    try {
      let dados;
      let status = 200;
      if (remocaoPet) {
        dados = await gerenciador.removerPet(id);
      } else if (
        recurso === 'reservas' &&
        partes.length === 1 &&
        req.method === 'POST'
      ) {
        dados = await gerenciador.criarReserva(await lerJson(req));
        status = 201;
      } else if (
        recurso === 'reservas' &&
        partes.length === 2 &&
        ['PUT', 'PATCH'].includes(req.method)
      ) {
        dados = await gerenciador.atualizarReserva(id, await lerJson(req), {
          substituir: req.method === 'PUT',
        });
      } else if (
        recurso === 'reservas' &&
        partes.length === 2 &&
        req.method === 'DELETE'
      ) {
        dados = await gerenciador.removerReserva(id);
      } else if (
        recurso === 'configuracoes' &&
        partes.length === 1 &&
        ['PUT', 'PATCH'].includes(req.method)
      ) {
        dados = await gerenciador.atualizarConfiguracoes(await lerJson(req), {
          substituir: req.method === 'PUT',
        });
      } else {
        throw new ErroReserva(
          405,
          'METODO_NAO_PERMITIDO',
          'Operação não permitida neste endereço.',
        );
      }
      responderJson(res, status, dados);
    } catch (erro) {
      const conhecido = erro instanceof ErroReserva;
      const message = conhecido
        ? erro.message
        : 'Não foi possível salvar os dados. Tente novamente.';
      responderJson(res, conhecido ? erro.status : 500, {
        error: message,
        message,
        code: conhecido ? erro.code : 'ERRO_INTERNO',
      });
    }
  };
}

export async function iniciarServidor({
  arquivo = fileURLToPath(new URL('../db.json', import.meta.url)),
  porta = Number(process.env.PORT ?? 3000),
  host = process.env.HOST || 'localhost',
} = {}) {
  const db = new Low(new NormalizedAdapter(new JSONFile(arquivo)), {});
  await db.read();
  db.data = normalizarIdsInteiros(db.data);
  await inicializarDadosReservas(db);
  const servidor = createServer(criarHandler(db));
  await new Promise((resolveInicio, reject) => {
    servidor.once('error', reject);
    servidor.listen(porta, host, resolveInicio);
  });
  console.log(
    `API PetSchool disponível em http://${host}:${servidor.address().port}`,
  );
  return servidor;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    await iniciarServidor();
  } catch (erro) {
    console.error(`Não foi possível iniciar a API: ${erro.message}`);
    process.exitCode = 1;
  }
}
