/**
 * Administração → Segurança do Trabalho → **Dashboard Segurança** (sub-aba, rota #/admin/seguranca-dashboard).
 * Indicadores das abas Dashboard-01 e Dashboard-02 da planilha "Controle de Acidentes-Dashboard.xlsx".
 * Cálculo no servidor (GET /api/seguranca/indicadores → domain/seguranca.js → calcularIndicadores), só com os
 * acidentes gravados.
 *
 * Layout: quadro de totais, botões com um indicador por vez e o indicador ocupando o resto da tela
 * (gráfico + ranking com a participação de cada item). Filtros: obras do Cadastro de obras e segmentador Ano.
 */
import { api } from '../core/api.js';
import { h, montar, token } from '../core/dom.js';
import { fmtNumero, fmtPercentual } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { TIPOS_ACIDENTE } from '../domain/seguranca.js';
import { alerta, card, carregando, ocuparAteRodape, vazio } from '../ui/componentes.js';
import { filtroExcel } from '../ui/filtro-excel.js';
import { graficoCategorias } from '../ui/graficos.js';
import { icone } from '../ui/icones.js';

const TIPO = Object.fromEntries(TIPOS_ACIDENTE.map((t) => [t.sigla, t]));

/** Indicadores na ordem dos botões. `dados(ind)` → [{rotulo, valor}]. */
const INDICADORES = [
  { id: 'periodo', nome: 'Nº de acidentes por período', dica: 'Acidentes por mês do ano (jan–dez), somando os anos selecionados', dados: (i) => i.porMes, tipo: 'line', ranking: false },
  { id: 'tipo', nome: 'Classificação do acidente', dica: 'CPT, SPT, TRJ e FT', dados: (i) => i.porTipo, cores: true },
  { id: 'fase', nome: 'Acidentes por fase de obra', dica: 'Fase em que a obra estava no dia do acidente', dados: (i) => i.porFase },
  { id: 'ano', nome: 'Acidentes por ano', dica: 'Total de acidentes em cada ano', dados: (i) => i.porAno },
  { id: 'parte', nome: 'Parte do corpo atingida', dica: '10 partes do corpo mais atingidas (empates incluídos)', dados: (i) => i.porParteCorpo },
  { id: 'obra', nome: 'Nº de acidentes por obra', dica: '10 obras com mais acidentes (empates incluídos)', dados: (i) => i.porObra, horizontal: true },
  { id: 'funcao', nome: 'Função', dica: '10 funções com mais acidentes (empates incluídos)', dados: (i) => i.porFuncao, horizontal: true },
  { id: 'empresa', nome: 'Acidentes por empresa contratada', dica: '10 empresas com mais acidentes (empates incluídos)', dados: (i) => i.porEmpresa, horizontal: true },
];

const preferencias = { obras: null, anos: [], indicador: 'periodo' }; // lembradas enquanto o app estiver aberto

export async function renderDashboardSeguranca(alvo) {
  const cadastros = estado.cadastros().filter((c) => c.id).sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR'));
  const q = new URLSearchParams();
  if (preferencias.obras) q.set('obras', preferencias.obras.join(','));
  if (preferencias.anos.length) q.set('anos', preferencias.anos.join(','));
  const redesenhar = () => renderDashboardSeguranca(alvo);

  const filtros = h('div', { class: 'row seg-controles' });
  const corpo = h('div', {}, carregando(6));
  const nomes = preferencias.obras ? cadastros.filter((c) => preferencias.obras.includes(c.id)).map((c) => c.obra) : null;
  montar(alvo,
    h('div', { class: 'titulo-pagina seg-dash-topo' },
      h('div', {},
        h('a', { class: 'seg-voltar', href: '#/admin/seguranca' }, icone('direita', { tamanho: 14 }), 'Segurança do Trabalho'),
        h('h1', {}, 'Dashboard Segurança'),
        h('p', {}, nomes ? (nomes.length === 1 ? nomes[0] : `${nomes.length} obras selecionadas`) : 'Todas as obras')),
      filtros),
    corpo);

  let r;
  try {
    r = await api.get(`/seguranca/indicadores?${q}`);
  } catch (e) {
    return montar(corpo, alerta('error', 'Não foi possível carregar os indicadores', e.message));
  }
  if (!alvo.isConnected) return;

  const itensObras = cadastros.map((c) => ({ valor: c.id, rotulo: c.obra, grupo: c.cliente ?? 'Sem cliente' }));
  montar(filtros,
    filtroExcel({
      rotulo: 'Obras', itens: itensObras, multiplo: true, largura: 340,
      selecionados: preferencias.obras ?? itensObras.map((i) => i.valor),
      aoAplicar: (v) => { preferencias.obras = v.length === itensObras.length ? null : v; redesenhar(); },
    }),
    r.anosDisponiveis.length ? filtroExcel({
      rotulo: 'Ano', multiplo: true, largura: 220,
      itens: r.anosDisponiveis.map((a) => ({ valor: a, rotulo: a })),
      selecionados: r.anos.length ? r.anos : r.anosDisponiveis,
      aoAplicar: (v) => { preferencias.anos = v.length === r.anosDisponiveis.length ? [] : v; redesenhar(); },
    }) : null);

  const ind = r.indicadores;
  if (!ind.total) return montar(corpo, vazio('Nenhum acidente registrado', 'Não há acidentes para as obras e anos selecionados.'));

  // ── Quadro de totais ──
  const periodo = r.anos.length ? `em ${r.anos.join(', ')}` : 'todos os anos';
  const totais = h('div', { class: 'seg-totais' },
    card({ class: 'seg-total destaque' },
      h('span', { class: 'seg-total-icone' }, icone('alerta', { tamanho: 22 })),
      h('div', {}, h('p', { class: 'l' }, 'Total de acidentes'), h('b', { class: 'v' }, fmtNumero(ind.total)), h('small', {}, periodo))),
    card({ class: 'seg-total' },
      h('span', { class: 'seg-total-icone' }, icone('calendario', { tamanho: 22 })),
      h('div', {}, h('p', { class: 'l' }, 'Média de dias de afastamento'), h('b', { class: 'v' }, fmtNumero(ind.mediaDias, 1)), h('small', {}, `${fmtNumero(ind.totalDias)} dia(s) de afastamento no total`))),
    card({ class: 'seg-total seg-total-tipos' },
      h('p', { class: 'l' }, 'Classificação'),
      h('div', { class: 'seg-tipos' }, ind.porTipo.map((t) => h('div', { class: 'seg-tipo-item', title: TIPO[t.rotulo].nome },
        h('i', { class: `seg-marca seg-${t.rotulo.toLowerCase()}` }), h('span', {}, t.rotulo), h('b', {}, fmtNumero(t.valor)))))));

  // ── Botões dos indicadores ──
  const atual = INDICADORES.find((i) => i.id === preferencias.indicador) ?? INDICADORES[0];
  const botoes = h('div', { class: 'seg-botoes', role: 'tablist', 'aria-label': 'Indicadores' }, INDICADORES.map((i) => h('button', {
    type: 'button', role: 'tab', 'aria-selected': String(i.id === atual.id),
    onclick: () => { preferencias.indicador = i.id; desenharIndicador(); },
  }, i.nome)));

  const painel = card({ class: 'seg-painel' });
  montar(corpo, totais, botoes, painel);
  ocuparAteRodape(painel, { minimo: 420 });

  function desenharIndicador() {
    const def = INDICADORES.find((i) => i.id === preferencias.indicador) ?? INDICADORES[0];
    for (const b of botoes.children) b.setAttribute('aria-selected', String(b.textContent === def.nome));
    const itens = def.dados(ind);
    // Barras horizontais com o dobro da grossura: o quadro cresce com o número de itens (rola a página se preciso).
    painel.style.minHeight = def.horizontal ? `${Math.max(420, itens.length * 52 + 150)}px` : '';
    const area = h('div', { class: 'grafico-area seg-painel-grafico' });
    const coresCategorias = def.cores ? itens.map((t) => TIPO[t.rotulo].cor) : null;
    montar(painel,
      h('div', { class: 'seg-painel-titulo' }, h('div', {}, h('h3', {}, def.nome), h('p', { class: 'muted small' }, def.dica)), h('span', { class: 'badge b-neutral' }, periodo)),
      h('div', { class: `seg-painel-corpo ${def.ranking === false ? 'sem-ranking' : ''}` },
        area,
        def.ranking === false ? null : ranking(itens, ind.total, coresCategorias)));
    graficoCategorias(area, {
      tipo: def.tipo ?? 'bar', horizontal: def.horizontal, area: def.tipo === 'line',
      categorias: itens.map((i) => i.rotulo),
      rotulosLegenda: def.cores ? itens.map((t) => `${t.rotulo} – ${TIPO[t.rotulo].nome}`) : null,
      coresCategorias,
      // Mesmo tamanho dos números da classificação no quadro de totais (tokens.css → --seg-fonte-numero).
      fonte: parseInt(token('--seg-fonte-numero'), 10) || 22,
      espessura: 2,
      series: [{ rotulo: 'Acidentes', valores: itens.map((i) => i.valor), cor: '--series-1' }],
      descricao: def.nome,
    });
  }
  desenharIndicador();
}

/** Ranking ao lado do gráfico: os mesmos valores, com a participação no total de acidentes. */
function ranking(itens, total, cores) {
  const maior = Math.max(1, ...itens.map((i) => i.valor));
  return h('ol', { class: 'seg-ranking' }, itens.map((i, k) => h('li', {},
    h('div', { class: 'seg-ranking-topo' },
      h('span', {}, cores ? h('i', { class: 'seg-marca', style: { background: `var(${cores[k]})` } }) : null, i.rotulo),
      h('b', {}, fmtNumero(i.valor), h('small', {}, fmtPercentual(total ? i.valor / total : null, 1)))),
    h('span', { class: 'seg-ranking-barra' }, h('i', { style: { width: `${(i.valor / maior) * 100}%`, background: cores ? `var(${cores[k]})` : null } })))));
}
