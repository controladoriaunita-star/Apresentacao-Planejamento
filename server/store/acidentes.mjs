/**
 * Acidentes da Segurança do Trabalho — mesma interface nos dois armazenamentos:
 *   consultar(filtro) → {itens, total} · porChaves(chaves) → Map(chaveDedup → acidente) · obter(id)
 *   inserir(registro) · inserirVarios(registros) → inseridos · atualizar(id, campos) · remover(id) · contarDaObra(obraId)
 *
 * filtro = { obraIds?, de?, ate?, tipos?, nome?, empresa?, ordem?: 'asc'|'desc', limite?, deslocamento?, campos? }
 *
 * - Local (STORE=local): arquivo DATA_DIR/acidentes.json, com escrita atômica e fila (como ColecaoJson).
 * - Supabase: tabela `acidentes` (supabase/migrations/003_seguranca_trabalho.sql) consultada com filtros,
 *   ordenação e paginação no próprio banco — a API não carrega a tabela inteira para listar uma página.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { semAcento } from '../../public/js/domain/normalizar.js';
import { linhaPadrao } from './supabase-store.mjs';

export class ErroDuplicado extends Error {}

const LOTE_SUPABASE = 1000;

const CAMPOS = ['id', 'obraId', 'data', 'faseObra', 'nomeAcidentado', 'funcao', 'empresa', 'tipo', 'parteCorpo', 'diasAfastamento', 'resumo', 'chaveDedup', 'origem', 'criadoPor', 'criadoEm', 'atualizadoPor', 'atualizadoEm'];
const paraSnake = (k) => k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);

/** Filtro em memória (modo local) — mesmas regras da consulta no Supabase. */
function atende(a, f) {
  if (f.obraIds && !f.obraIds.includes(a.obraId)) return false;
  if (f.de && a.data < f.de) return false;
  if (f.ate && a.data > f.ate) return false;
  if (f.tipos?.length && !f.tipos.includes(a.tipo)) return false;
  if (f.nome && !semAcento(a.nomeAcidentado).includes(semAcento(f.nome))) return false;
  if (f.empresa && !semAcento(a.empresa).includes(semAcento(f.empresa))) return false;
  return true;
}

const comparar = (ordem) => (a, b) => (ordem === 'asc' ? 1 : -1) * (a.data.localeCompare(b.data) || String(a.criadoEm).localeCompare(String(b.criadoEm)));

export class RepositorioAcidentesLocal {
  #arquivo;
  #fila = Promise.resolve();

  constructor(dataDir) {
    this.#arquivo = join(dataDir, 'acidentes.json');
    mkdirSync(dirname(this.#arquivo), { recursive: true });
  }

  #ler() {
    if (!existsSync(this.#arquivo)) return [];
    const dados = JSON.parse(readFileSync(this.#arquivo, 'utf8'));
    return Array.isArray(dados) ? dados : [];
  }

  #alterar(alterar) {
    const tarefa = this.#fila.then(async () => {
      const lista = this.#ler();
      const resultado = await alterar(lista);
      mkdirSync(dirname(this.#arquivo), { recursive: true });
      const temporario = `${this.#arquivo}.${process.pid}.tmp`;
      await writeFile(temporario, JSON.stringify(lista, null, 2));
      await rename(temporario, this.#arquivo);
      return resultado;
    });
    this.#fila = tarefa.catch(() => {});
    return tarefa;
  }

  async consultar(f = {}) {
    if (f.obraIds && !f.obraIds.length) return { itens: [], total: 0 };
    const todos = this.#ler().filter((a) => atende(a, f)).sort(comparar(f.ordem));
    const inicio = f.deslocamento ?? 0;
    return { itens: f.limite ? todos.slice(inicio, inicio + f.limite) : todos.slice(inicio), total: todos.length };
  }

  async porChaves(chaves) {
    const procuradas = new Set(chaves);
    return new Map(this.#ler().filter((a) => procuradas.has(a.chaveDedup)).map((a) => [a.chaveDedup, a]));
  }

  async obter(id) {
    return this.#ler().find((a) => a.id === id) ?? null;
  }

  async contarDaObra(obraId) {
    return this.#ler().filter((a) => a.obraId === obraId).length;
  }

  inserir(registro) {
    return this.#alterar((lista) => {
      if (lista.some((a) => a.chaveDedup === registro.chaveDedup)) throw new ErroDuplicado();
      const novo = { id: randomUUID(), criadoEm: new Date().toISOString(), ...registro };
      lista.push(novo);
      return novo;
    });
  }

  /** Grava todos de uma vez (um único arquivo escrito); os já existentes pela chave são pulados. */
  inserirVarios(registros) {
    return this.#alterar((lista) => {
      const chaves = new Set(lista.map((a) => a.chaveDedup));
      const agora = new Date().toISOString();
      const inseridos = [];
      for (const r of registros) {
        if (chaves.has(r.chaveDedup)) continue;
        chaves.add(r.chaveDedup);
        const novo = { id: randomUUID(), criadoEm: agora, ...r };
        lista.push(novo);
        inseridos.push(novo);
      }
      return inseridos;
    });
  }

  atualizar(id, campos) {
    return this.#alterar((lista) => {
      const i = lista.findIndex((a) => a.id === id);
      if (i < 0) return null;
      if (campos.chaveDedup && lista.some((a) => a.id !== id && a.chaveDedup === campos.chaveDedup)) throw new ErroDuplicado();
      lista[i] = { ...lista[i], ...campos, id, atualizadoEm: new Date().toISOString() };
      return lista[i];
    });
  }

  remover(id) {
    return this.#alterar((lista) => {
      const i = lista.findIndex((a) => a.id === id);
      return i < 0 ? null : lista.splice(i, 1)[0];
    });
  }
}

/** Valor entre aspas para `in.(…)` do PostgREST (nomes podem ter vírgula ou parênteses). */
const citar = (v) => `"${String(v).replace(/["\\]/g, (c) => `\\${c}`)}"`;
/** Termo de pesquisa para `ilike` sem os curingas/separadores do PostgREST. */
const termo = (v) => String(v).replace(/[*,()%_\\]/g, ' ').trim();

export class RepositorioAcidentesSupabase {
  constructor(cliente) {
    this.cliente = cliente;
    this.tabela = 'acidentes';
  }

  #de = (linha) => linhaPadrao.deLinha(linha);
  #para = (obj) => linhaPadrao.paraLinha(Object.fromEntries(Object.entries(obj).filter(([k]) => CAMPOS.includes(k))));

  async consultar(f = {}) {
    if (f.obraIds && !f.obraIds.length) return { itens: [], total: 0 };
    const q = new URLSearchParams({ select: f.campos ? f.campos.map(paraSnake).join(',') : '*' });
    if (f.obraIds) q.append('obra_id', `in.(${f.obraIds.map(citar).join(',')})`);
    if (f.de) q.append('data', `gte.${f.de}`);
    if (f.ate) q.append('data', `lte.${f.ate}`);
    if (f.tipos?.length) q.append('tipo', `in.(${f.tipos.map(citar).join(',')})`);
    if (f.nome && termo(f.nome)) q.append('nome_acidentado', `ilike.*${termo(f.nome)}*`);
    if (f.empresa && termo(f.empresa)) q.append('empresa', `ilike.*${termo(f.empresa)}*`);
    q.append('order', `data.${f.ordem === 'asc' ? 'asc' : 'desc'},criado_em.${f.ordem === 'asc' ? 'asc' : 'desc'},id.asc`);
    // O Supabase devolve no máximo 1000 linhas por chamada (db-max-rows): pede em blocos.
    const inicio = f.deslocamento ?? 0;
    const fim = f.limite ? inicio + f.limite : Infinity;
    const itens = [];
    let total = null;
    for (let desde = inicio; desde < fim;) {
      const bloco = Math.min(LOTE_SUPABASE, fim - desde);
      const pagina = new URLSearchParams(q);
      pagina.set('limit', String(bloco));
      if (desde) pagina.set('offset', String(desde));
      const r = await this.cliente.consultar(this.tabela, pagina, { contar: total === null && Boolean(f.limite) });
      if (total === null && f.limite) total = r.total;
      itens.push(...r.linhas.map(this.#de));
      if (r.linhas.length < bloco) break;
      desde += bloco;
    }
    return { itens, total: total ?? itens.length + inicio };
  }

  /** Busca em lotes (a URL tem limite de tamanho). */
  async porChaves(chaves) {
    const mapa = new Map();
    for (let i = 0; i < chaves.length; i += 40) {
      const lote = chaves.slice(i, i + 40);
      const q = new URLSearchParams({ select: 'id,chave_dedup,dias_afastamento' });
      q.append('chave_dedup', `in.(${lote.map(citar).join(',')})`);
      const { linhas } = await this.cliente.consultar(this.tabela, q);
      for (const l of linhas) mapa.set(l.chave_dedup, this.#de(l));
    }
    return mapa;
  }

  async obter(id) {
    const [linha] = await this.cliente.selecionar(this.tabela, { id });
    return linha ? this.#de(linha) : null;
  }

  async contarDaObra(obraId) {
    const q = new URLSearchParams({ select: 'id', obra_id: `eq.${obraId}`, limit: '1' });
    return (await this.cliente.consultar(this.tabela, q, { contar: true })).total;
  }

  async inserir(registro) {
    try {
      return this.#de(await this.cliente.inserir(this.tabela, this.#para({ id: randomUUID(), criadoEm: new Date().toISOString(), ...registro })));
    } catch (e) {
      if (e.status === 409) throw new ErroDuplicado();
      throw e;
    }
  }

  async inserirVarios(registros) {
    const agora = new Date().toISOString();
    const linhas = registros.map((r) => this.#para({ id: randomUUID(), criadoEm: agora, ...r }));
    return (await this.cliente.inserirVarios(this.tabela, linhas, { conflito: 'chave_dedup', ignorarDuplicados: true })).map(this.#de);
  }

  async atualizar(id, campos) {
    try {
      const linha = await this.cliente.atualizar(this.tabela, { id }, this.#para({ ...campos, atualizadoEm: new Date().toISOString() }));
      return linha ? this.#de(linha) : null;
    } catch (e) {
      if (e.status === 409) throw new ErroDuplicado();
      throw e;
    }
  }

  async remover(id) {
    const linha = await this.cliente.remover(this.tabela, { id });
    return linha ? this.#de(linha) : null;
  }
}
