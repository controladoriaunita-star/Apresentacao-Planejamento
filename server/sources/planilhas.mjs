/**
 * Planilhas do SharePoint com cache em memória e no armazém (disco local ou Storage do Supabase).
 *
 * - Cada aba fica em cache por CACHE_MINUTOS; "Atualizar dados" força nova leitura.
 * - Instância nova (ex.: função da Vercel recém-iniciada) começa pelo cache do armazém em vez de reler o
 *   SharePoint; se estiver vencido, responde com ele e atualiza em segundo plano.
 * - Se o SharePoint falhar, devolve o último cache gravado e avisa (`aviso`), para a
 *   apresentação não cair no meio de uma reunião.
 * - Duas requisições simultâneas pela mesma aba compartilham a mesma leitura.
 * - Em DATA_SOURCE=exemplo, lê tests/fixtures/planilhas-exemplo.json (dados fictícios).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ABAS } from '../../public/js/domain/colunas.js';
import { chaveObra } from '../../public/js/domain/normalizar.js';
import { RAIZ } from '../config.mjs';
import { ArmazemLocal } from '../store/armazem.mjs';
import { ClienteGraph } from './graph.mjs';

/** O Graph às vezes devolve 429/5xx ou estoura o tempo em abas grandes: tenta mais uma vez após 2 s. */
async function comNovaTentativa(ler) {
  try {
    return await ler();
  } catch (e) {
    if (e.status === 401 || e.status === 403 || e.status === 404) throw e; // permissão/aba errada: não adianta repetir
    await new Promise((r) => setTimeout(r, 2000));
    return ler();
  }
}

export class FontePlanilhas {
  #memoria = new Map(); // aba → {valores, lidoEm}
  #emAndamento = new Map();

  constructor(config, fetchImpl, armazem = new ArmazemLocal(config.dataDir)) {
    this.config = config;
    this.armazem = armazem;
    this.graph = config.fonteDados === 'graph' ? new ClienteGraph(config.graph, fetchImpl) : null;
    this.aviso = null;
  }

  get descricao() {
    return this.config.fonteDados === 'graph' ? 'SharePoint (Microsoft Graph)' : 'Dados de exemplo (fictícios)';
  }

  /** Matriz {colunas, linhas} da aba. */
  async aba(nome, { forcar = false } = {}) {
    const { valores, lidoEm } = await this.#valores(nome, forcar);
    return { colunas: valores[0] ?? [], linhas: valores.slice(1), lidoEm };
  }

  /** Linhas do BD_Físico por atividade de uma obra (a aba inteira tem ~25 mil linhas). */
  async fisicoDaObra(nomeObra) {
    const matriz = await this.aba(ABAS.fisicoAtividade);
    const iNome = matriz.colunas.findIndex((c) => chaveObra(c) === 'nome da obra');
    const chave = chaveObra(nomeObra);
    return { colunas: matriz.colunas, linhas: matriz.linhas.filter((l) => chaveObra(l[iNome]) === chave), lidoEm: matriz.lidoEm };
  }

  /**
   * Pré-carga em segundo plano: a aba BD_Físico por atividade (~25 mil linhas, ~10 MB) leva ~10 s na
   * primeira leitura; carregando ao subir o servidor, o Resumo Físico abre na hora.
   */
  preCarregar() {
    for (const aba of Object.values(ABAS)) this.#valores(aba, false).catch(() => {});
  }

  /** Relê todas as abas agora (botão "Atualizar dados"). */
  async atualizarTudo() {
    await Promise.all(Object.values(ABAS).map((aba) => this.#valores(aba, true)));
  }

  async #valores(nome, forcar) {
    const emMemoria = this.#memoria.get(nome);
    const validade = this.config.cacheMinutos * 60_000;
    if (!forcar && emMemoria && Date.now() - Date.parse(emMemoria.lidoEm) < validade) return emMemoria;
    if (!forcar && !emMemoria && this.graph) {
      const guardado = await this.armazem.ler(this.#nomeCache(nome)).catch(() => null);
      if (guardado?.valores) {
        this.#memoria.set(nome, guardado);
        return this.#valores(nome, false); // fresco: devolve; vencido: devolve e atualiza em segundo plano
      }
    }
    const leitura = this.#emAndamento.get(nome) ?? this.#ler(nome).finally(() => this.#emAndamento.delete(nome));
    this.#emAndamento.set(nome, leitura);
    // Cache vencido: responde já com o anterior e atualiza em segundo plano (o próximo pedido pega o novo).
    if (!forcar && emMemoria) {
      leitura.catch(() => {});
      return emMemoria;
    }
    return leitura;
  }

  async #ler(nome) {
    try {
      const valores = this.graph ? await comNovaTentativa(() => this.graph.valoresDaAba(nome)) : this.#exemplo(nome);
      const registro = { valores, lidoEm: new Date().toISOString() };
      this.#memoria.set(nome, registro);
      if (this.graph) await this.armazem.gravar(this.#nomeCache(nome), registro).catch((e) => console.warn(`[cache] não gravou ${nome}: ${e.message}`));
      this.aviso = null;
      return registro;
    } catch (e) {
      const anterior = this.#memoria.get(nome) ?? (await this.armazem.ler(this.#nomeCache(nome)).catch(() => null));
      if (!anterior) throw e;
      this.aviso = `Não foi possível atualizar do SharePoint (${e.message}). Exibindo dados de ${new Date(anterior.lidoEm).toLocaleString('pt-BR')}.`;
      this.#memoria.set(nome, anterior);
      return anterior;
    }
  }

  #nomeCache = (aba) => `cache/${aba}`;

  #exemplo(nome) {
    this.exemploCache ??= JSON.parse(readFileSync(join(RAIZ, 'tests', 'fixtures', 'planilhas-exemplo.json'), 'utf8'));
    return this.exemploCache[nome] ?? [];
  }
}
