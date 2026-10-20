import { onlyDigits } from './tutor.js';

export function normalizarBusca(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
    .replace(/\s+/g, ' ');
}

export function correspondeBusca(termo, ...valores) {
  const busca = normalizarBusca(termo);
  return (
    !busca || valores.some((valor) => normalizarBusca(valor).includes(busca))
  );
}

export function correspondeTutor(termo, tutor) {
  const busca = normalizarBusca(termo);
  if (!busca) return true;
  if (!tutor) return false;
  if (correspondeBusca(busca, tutor.nome)) return true;

  const digitos = onlyDigits(busca);
  if (!digitos || !/^[\d.\-/\s()+]+$/.test(busca)) return false;

  return [tutor.cpfCnpj, tutor.telefone].some((valor) =>
    onlyDigits(valor).includes(digitos),
  );
}
