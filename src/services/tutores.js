import { apiRequest } from './api';

export function buscarPetsDoTutor(tutorId) {
  const id = String(tutorId);
  const filtros = [{ tutorId: { eq: id } }];
  const idNumerico = Number(id);

  if (Number.isFinite(idNumerico) && String(idNumerico) === id) {
    filtros.push({ tutorId: { eq: idNumerico } });
  }

  // O JSON Server beta converte filtros como tutorId=1 em números. O _where
  // preserva o tipo e também encontra os vínculos salvos como strings.
  const parametros = new URLSearchParams({
    tutorId: id,
    _where: JSON.stringify({ or: filtros }),
  });

  return apiRequest(`/pets?${parametros}`);
}
