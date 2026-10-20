const API_URL = (
  import.meta.env?.VITE_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);

  if (!response.ok) {
    let detalhes;
    try {
      detalhes = await response.json();
    } catch {
      // Respostas sem JSON continuam identificadas pelo status HTTP.
    }
    const error = new Error(
      typeof detalhes?.error === 'string'
        ? detalhes.error
        : `A requisição falhou (HTTP ${response.status}).`,
    );
    error.status = response.status;
    error.code = detalhes?.code;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
