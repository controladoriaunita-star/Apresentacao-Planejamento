/**
 * Rotas por hash (#/obra/resumo-geral). Não exige reescrita de URL no servidor — funciona igual no
 * Node e no Apache/PHP da Hostinger.
 */
const rotas = [];

/** @param {string} padrao ex.: "/cliente/tela/:id" */
export function rota(padrao, tratador) {
  const nomes = [];
  const regex = new RegExp(`^${padrao.replace(/:(\w+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; })}$`);
  rotas.push({ padrao, regex, nomes, tratador });
}

export function caminhoAtual() {
  return location.hash.replace(/^#/, '') || '/';
}

export function resolver(caminho = caminhoAtual()) {
  for (const r of rotas) {
    const m = caminho.match(r.regex);
    if (m) return { ...r, params: Object.fromEntries(r.nomes.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

export const ir = (caminho) => { location.hash = `#${caminho}`; };
