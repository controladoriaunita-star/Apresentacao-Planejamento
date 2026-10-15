/**
 * Roteador mínimo: método + caminho com parâmetros (`/api/midias/:id`).
 * Cada rota declara a permissão exigida; a checagem fica centralizada aqui.
 */
import { erro } from './respostas.mjs';

export class Roteador {
  #rotas = [];

  /**
   * @param {string} metodo  GET | POST | PUT | DELETE
   * @param {string} caminho  ex.: "/api/midias/:id"
   * @param {{permissao?: string|null}} opcoes  permissao null = rota pública; string = capacidade exigida
   * @param {(ctx: object) => Promise<void>} tratador
   */
  adicionar(metodo, caminho, opcoes, tratador) {
    const nomes = [];
    const padrao = new RegExp(`^${caminho.replace(/:([a-zA-Z]+)/g, (_, nome) => { nomes.push(nome); return '([^/]+)'; })}$`);
    this.#rotas.push({ metodo, padrao, nomes, permissao: opcoes.permissao, tratador });
  }

  encontrar(metodo, caminho) {
    let caminhoExiste = false;
    for (const rota of this.#rotas) {
      const m = caminho.match(rota.padrao);
      if (!m) continue;
      caminhoExiste = true;
      if (rota.metodo !== metodo) continue;
      const params = Object.fromEntries(rota.nomes.map((nome, i) => [nome, decodeURIComponent(m[i + 1])]));
      return { rota, params };
    }
    if (caminhoExiste) throw erro(405, 'Método não permitido.');
    return null;
  }
}
