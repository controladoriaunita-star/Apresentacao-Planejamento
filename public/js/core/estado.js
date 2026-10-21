/**
 * Estado global da apresentação: usuário, dados carregados, base de cálculo por visão e filtro.
 * Componentes se inscrevem com `estado.ouvir(fn)`; qualquer mudança no filtro redesenha a página.
 */
import { api } from './api.js';
import { criarBase, criarFisicoAtividade } from '../domain/base.js';
import { chaveObra } from '../domain/normalizar.js';
import { mesAtual, periodoPadrao } from '../domain/periodo.js';

const CHAVE_FILTRO = 'apresentacao.filtro';

const ouvintes = new Set();
const bases = new Map(); // visão → base
const fisicos = new Map(); // `${visao}|${obra}` → Promise<Map>

export const estado = {
  usuario: null,
  bruto: null,
  filtro: lerFiltroSalvo(),
  carregando: false,
  erro: null,

  ouvir(fn) {
    ouvintes.add(fn);
    return () => ouvintes.delete(fn);
  },

  avisar() {
    for (const fn of ouvintes) fn(this);
  },

  /** Base de cálculo da visão (obra/cliente), criada uma vez por carga de dados. */
  base(visao) {
    if (!this.bruto) return null;
    if (!bases.has(visao)) bases.set(visao, criarBase(this.bruto, visao));
    return bases.get(visao);
  },

  async carregarDados({ forcarServidor = false } = {}) {
    this.carregando = true;
    this.erro = null;
    this.avisar();
    try {
      this.bruto = forcarServidor ? await api.post('/dados/atualizar') : await api.get('/dados/resumo');
      bases.clear();
      fisicos.clear();
      ajustarFiltro(this);
    } catch (e) {
      this.erro = e.message;
    } finally {
      this.carregando = false;
      this.avisar();
    }
  },

  /** BD_Físico por atividade de uma obra (sob demanda, em cache). */
  fisicoDaObra(visao, nomeObra) {
    const chave = `${visao}|${chaveObra(nomeObra)}`;
    if (!fisicos.has(chave)) {
      fisicos.set(chave, api.get(`/dados/fisico?obra=${encodeURIComponent(nomeObra)}`)
        .then((matriz) => criarFisicoAtividade(matriz, visao))
        .catch((e) => { fisicos.delete(chave); throw e; }));
    }
    return fisicos.get(chave);
  },

  definirFiltro(parcial) {
    this.filtro = { ...this.filtro, ...parcial };
    if (parcial.obras) Object.assign(this.filtro, periodoDasObras(this, this.filtro.obras, true));
    salvarFiltro(this.filtro);
    this.avisar();
  },
};

/** Garante que o filtro aponta para obras existentes e um período válido. */
function ajustarFiltro(est) {
  const base = est.base('obra');
  const existentes = new Set(base.obras.map((o) => o.chave));
  let obras = (est.filtro.obras ?? []).filter((o) => existentes.has(o));
  if (!obras.length) obras = base.obras.filter((o) => base.infos.has(o.chave)).slice(0, 1).map((o) => o.chave);
  est.filtro = { ...est.filtro, obras, ...periodoDasObras(est, obras, Boolean(est.filtro.referencia)) };
  salvarFiltro(est.filtro);
}

/** Intervalo dos gráficos = meses das obras; referência = último mês fechado (ou a escolhida). */
function periodoDasObras(est, obras, manterReferencia) {
  const padrao = periodoPadrao(est.base('obra'), obras, mesAtual());
  const referencia = manterReferencia && est.filtro.referencia ? est.filtro.referencia : padrao.referencia;
  return { de: padrao.de, ate: padrao.ate, referencia };
}

function lerFiltroSalvo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_FILTRO)) ?? {};
  } catch {
    return {};
  }
}

function salvarFiltro(filtro) {
  try {
    localStorage.setItem(CHAVE_FILTRO, JSON.stringify({ obras: filtro.obras, referencia: filtro.referencia }));
  } catch {
    /* navegador sem armazenamento: o filtro só não é lembrado */
  }
}
