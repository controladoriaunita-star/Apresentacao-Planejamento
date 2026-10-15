/**
 * INCC-DI mês a mês.
 *
 * - Base: números-índice da FGV (server/seed/incc-di.json, AGO/1994 → AGO/2026, o mesmo histórico do
 *   APP-PROJEÇÃO).
 * - Atualização: série 192 do SGS/Banco Central (variação % mensal do INCC-DI, API pública sem chave).
 *   Cada mês novo = índice do mês anterior × (1 + variação/100). Conferido: jul→ago/26 = +0,66% nas duas fontes.
 * - Índices digitados manualmente (dev/planejamento) prevalecem sobre os calculados.
 * Resultado gravado no armazém (local: DATA_DIR/incc.json; Supabase: Storage); online no máximo 1× por dia.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../config.mjs';
import { somarMeses } from '../../public/js/domain/normalizar.js';
import { ArmazemLocal } from '../store/armazem.mjs';

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export class FonteIncc {
  constructor(config, fetchImpl = fetch, armazem = new ArmazemLocal(config.dataDir)) {
    this.config = config;
    this.fetch = fetchImpl;
    this.armazem = armazem; // documento "incc" (local: DATA_DIR/incc.json; Supabase: Storage)
  }

  #historicoBase() {
    const seed = JSON.parse(readFileSync(join(RAIZ, 'server', 'seed', 'incc-di.json'), 'utf8'));
    return seed.items.map((i) => ({ mes: i.month.slice(0, 7), indice: Number(i.index), origem: 'FGV' }));
  }

  async #estado() {
    return (await this.armazem.ler('incc')) ?? { atualizadoEm: null, itens: this.#historicoBase(), manuais: {} };
  }

  /** Série completa (manuais aplicados), ordenada por mês. */
  async listar() {
    const estado = await this.#estado();
    const porMes = new Map(estado.itens.map((i) => [i.mes, i]));
    for (const [mes, indice] of Object.entries(estado.manuais ?? {})) porMes.set(mes, { mes, indice, origem: 'manual' });
    return { atualizadoEm: estado.atualizadoEm, itens: [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes)) };
  }

  /** Busca no Banco Central os meses que faltam. Falhas não derrubam nada: mantém a série atual. */
  async atualizar({ forcar = false } = {}) {
    const estado = await this.#estado();
    if (!forcar && estado.atualizadoEm && Date.now() - Date.parse(estado.atualizadoEm) < UM_DIA_MS) return { novos: 0 };
    if (!this.config.incc.atualizarOnline) return { novos: 0 };

    const ultimo = estado.itens.at(-1);
    const [ano, mes] = somarMeses(ultimo.mes, 1).split('-');
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${encodeURIComponent(this.config.incc.serieSgs)}/dados?formato=json&dataInicial=01/${mes}/${ano}`;
    const res = await this.fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Banco Central respondeu ${res.status}`);
    const variacoes = await res.json();

    let anterior = ultimo;
    let novos = 0;
    for (const { data, valor } of Array.isArray(variacoes) ? variacoes : []) {
      const [, m, a] = String(data).split('/');
      const mesItem = `${a}-${m}`;
      if (mesItem !== somarMeses(anterior.mes, 1)) break; // só encadeia meses consecutivos
      const indice = Math.round(anterior.indice * (1 + Number(valor) / 100) * 1e6) / 1e6;
      anterior = { mes: mesItem, indice, origem: 'BCB/SGS', variacao: Number(valor) };
      estado.itens.push(anterior);
      novos++;
    }
    estado.atualizadoEm = new Date().toISOString();
    await this.armazem.gravar('incc', estado);
    return { novos };
  }

  async definirManual(mes, indice) {
    const estado = await this.#estado();
    estado.manuais = { ...estado.manuais, [mes]: indice };
    await this.armazem.gravar('incc', estado);
  }
}
