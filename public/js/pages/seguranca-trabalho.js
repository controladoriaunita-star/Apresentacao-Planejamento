/**
 * Aba "Segurança do Trabalho" (apresentações Obra e Cliente) — reproduz o "Modelo - Indicador Segurança do
 * Trabalho": tabela por período (mês) com SPT/CPT/TRJ/FT, dias perdidos e resumo, e o gráfico de colunas
 * "Nº de Acidentes Ocorridos no Mês" por tipo, mês a mês no período da obra.
 *
 * Filtro: no modo apresentação (tela cheia) vale sempre a obra do filtro geral (a mesma do Resumo Geral).
 * Fora dele, o seletor "Obra exibida" permite outra obra do cadastro ou todas as obras.
 * Apresentação Cliente: a aba é opcional por obra (Cadastro de obras → "Segurança do Trabalho na apresentação
 * Cliente"); só as obras marcadas aparecem, tanto no filtro geral quanto no seletor.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtData, fmtMes, fmtNumero } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { mesesDoGrafico, ORDEM_MODELO, serieMensalPorTipo, tabelaPorPeriodo, TIPOS_ACIDENTE } from '../domain/seguranca.js';
import { alerta, card, cardTitulo, carregando, ocuparAteRodape, seloCompetencia, vazio } from '../ui/componentes.js';
import { filtroExcel } from '../ui/filtro-excel.js';
import { graficoCategorias } from '../ui/graficos.js';

const FILTRO = '__filtro';
const TODAS = '__todas';
let escolha = FILTRO; // fora do modo apresentação; volta ao filtro geral sempre que ele muda
let filtroVisto = '';
const TIPO = Object.fromEntries(TIPOS_ACIDENTE.map((t) => [t.sigla, t]));

const apresentando = () => document.body.classList.contains('apresentando');

export async function renderSegurancaTrabalho(alvo, contexto) {
  const { base, filtro, visao } = contexto;
  // Filtro geral mudou (ex.: outra obra no Resumo): a tela acompanha.
  const assinatura = `${visao}|${filtro.obras.join('|')}`;
  if (assinatura !== filtroVisto) { filtroVisto = assinatura; escolha = FILTRO; }
  // Exportação em PDF (`impressao`): sempre a obra exportada, como no modo apresentação.
  const modo = apresentando() || contexto.impressao ? FILTRO : escolha;
  const cliente = visao === 'cliente';
  const cadastros = (estado.bruto?.cadastro ?? []).filter((c) => c.id && (!cliente || c.segurancaCliente === 'sim'));
  const permitidas = new Set(cadastros.map((c) => c.chave));

  let chaves;
  let titulo;
  if (modo === TODAS) { chaves = cliente ? [...permitidas] : null; titulo = 'Todas as obras'; } else if (modo === FILTRO) {
    chaves = cliente ? filtro.obras.filter((c) => permitidas.has(c)) : filtro.obras;
    const nomes = base.obras.filter((o) => chaves.includes(o.chave)).map((o) => o.nome);
    titulo = nomes.length === 1 ? nomes[0] : `${nomes.length} obras do filtro`;
  } else {
    chaves = [modo];
    titulo = cadastros.find((c) => c.chave === modo)?.obra ?? modo;
  }

  const seletor = filtroExcel({
    rotulo: 'Obra exibida', multiplo: false, largura: 320,
    itens: [
      { valor: FILTRO, rotulo: 'Obras do filtro geral', grupo: 'Filtro' },
      { valor: TODAS, rotulo: 'Todas as obras', grupo: 'Filtro' },
      ...cadastros.map((c) => ({ valor: c.chave, rotulo: c.obra, grupo: c.cliente ?? 'Sem cliente' })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')),
    ],
    selecionados: modo,
    aoAplicar: (v) => { escolha = v; renderSegurancaTrabalho(alvo, contexto); },
  });

  const corpo = h('div', { class: 'stack' }, carregando(6));
  montar(alvo, h('div', { class: 'rg seg-modelo' },
    h('div', { class: 'rg-titulo' },
      h('h1', {}, 'Segurança do Trabalho', h('small', {}, titulo)),
      h('div', { class: 'row' }, h('div', { class: 'so-edicao' }, seletor), seloCompetencia(filtro.referencia, { compacto: true }))),
    corpo));
  if (!contexto.impressao) acompanharTelaCheia(alvo, contexto);

  const q = new URLSearchParams({ tamanho: 'todos', ordem: 'asc' });
  if (chaves) q.set('chaves', chaves.join(','));
  let r;
  try {
    r = await api.get(`/seguranca/acidentes?${q}`);
  } catch (e) {
    return montar(corpo, alerta('error', 'Não foi possível carregar os acidentes', e.message));
  }
  if (!alvo.isConnected) return;
  const acidentes = r.itens;
  const variasObras = modo === TODAS || (chaves?.length ?? 0) > 1;

  // Eixo: 1 mês antes do primeiro acidente até 1 mês depois do último, mínimo de 12 meses (domain → mesesDoGrafico).
  const meses = mesesDoGrafico(acidentes, { referencia: filtro.referencia });
  const series = serieMensalPorTipo(acidentes, meses);

  const grafico = h('div', { class: 'grafico-area' });
  const quadro = card({ class: 'rg-cartao seg-cartao seg-grafico-mes' },
    cardTitulo('Nº de acidentes ocorridos no mês', h('span', { class: 'muted small' }, `${fmtMes(meses[0])} a ${fmtMes(meses.at(-1))}`)), grafico);
  montar(corpo,
    acidentes.length ? tabelaModelo(tabelaPorPeriodo(acidentes, { referencia: filtro.referencia }), variasObras)
      : vazio('Nenhum acidente registrado', 'Sem acidentes para esta obra — o gráfico mostra os últimos 12 meses sem ocorrências.'),
    quadro);
  ocuparAteRodape(quadro, { minimo: 320 }); // o quadro do gráfico vai até o pé da tela
  graficoCategorias(grafico, {
    categorias: meses.map(fmtMes),
    empilhado: true,
    legendaSempre: true,
    // Eixo Y sempre de 0 ao maior mês (todos os tipos somados) + 2 acidentes.
    max: Math.max(0, ...meses.map((_, i) => ORDEM_MODELO.reduce((s, t) => s + series[t][i], 0))) + 2,
    fonte: 16,
    descricao: 'Número de acidentes por mês e tipo',
    series: ORDEM_MODELO.map((s) => ({ rotulo: `${s} – ${TIPO[s].nome}`, valores: series[s], cor: TIPO[s].cor })),
  });
}

/** Tabela do modelo: período mesclado por mês, contagem por tipo mesclada no mês, uma linha por acidente. */
function tabelaModelo(periodos, variasObras) {
  const linhas = [];
  for (const p of periodos) {
    const n = Math.max(1, p.acidentes.length);
    const mesclada = (conteudo, classe = '') => h('td', { rowspan: n, class: `seg-mesclada ${classe}` }, conteudo);
    const contagens = ORDEM_MODELO.map((s) => mesclada(p.porTipo[s] ? fmtNumero(p.porTipo[s]) : '', `seg-tipo seg-${s.toLowerCase()}`));
    if (!p.acidentes.length) {
      linhas.push(h('tr', { class: 'seg-periodo seg-vazio' }, mesclada(fmtMes(p.mes), 'seg-mes'),
        h('td', { colspan: variasObras ? 5 : 4 }), ORDEM_MODELO.map(() => h('td', {})), h('td', {}), h('td', {}), h('td', {})));
      continue;
    }
    p.acidentes.forEach((a, i) => {
      linhas.push(h('tr', { class: i === 0 ? 'seg-periodo' : '' },
        i === 0 ? mesclada(fmtMes(p.mes), 'seg-mes') : null,
        h('td', { class: 'esq' }, fmtData(a.data)),
        variasObras ? h('td', { class: 'esq' }, a.obra) : null,
        h('td', { class: 'esq seg-col-nome' }, a.nomeAcidentado),
        h('td', { class: 'esq' }, a.funcao),
        h('td', { class: 'esq' }, a.empresa),
        i === 0 ? contagens : null,
        h('td', { class: 'esq' }, a.parteCorpo),
        h('td', {}, fmtNumero(a.diasAfastamento)),
        h('td', { class: 'texto' }, a.resumo)));
    });
  }
  return h('div', { class: 'sheet seg-tabela-modelo' }, h('table', {},
    h('thead', {}, h('tr', {},
      h('th', {}, 'Período'), h('th', {}, 'Data do acidente'), variasObras ? h('th', {}, 'Obra') : null, h('th', {}, 'Colaborador acidentado'),
      h('th', {}, 'Função'), h('th', {}, 'Empresa'),
      ORDEM_MODELO.map((s) => h('th', { class: 'seg-tipo', title: TIPO[s].nome }, h('i', { class: `seg-marca seg-${s.toLowerCase()}` }), s)),
      h('th', {}, 'Parte do corpo atingida'), h('th', {}, 'Dias perdidos (DP)'), h('th', {}, 'Resumo do acidente'))),
    h('tbody', {}, linhas)));
}

/** Entrar ou sair da tela cheia troca entre o filtro geral e a obra escolhida: redesenha esta aba. */
let ouvinte = null;
function acompanharTelaCheia(alvo, contexto) {
  if (ouvinte) document.removeEventListener('fullscreenchange', ouvinte);
  ouvinte = () => {
    if (!alvo.isConnected) { document.removeEventListener('fullscreenchange', ouvinte); ouvinte = null; return; }
    // A classe "apresentando" é trocada pelo main.js no mesmo evento; espera o próximo quadro.
    requestAnimationFrame(() => renderSegurancaTrabalho(alvo, contexto));
  };
  document.addEventListener('fullscreenchange', ouvinte);
}
