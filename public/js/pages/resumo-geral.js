/**
 * Aba "Resumo Geral" — layout do Power BI: quadro CEF × Físico e Análise Econômica, três gráficos mês a mês,
 * custos por unidade, INCC, NH-NU e velocímetro. Em tela cheia os quadros ficam numa grade de 24 × 24 que
 * cobre a tela toda; o Dev move e redimensiona os quadros ("Editar layout") e o layout vale para todas as
 * apresentações (domain/layout-resumo.js, ui/editor-layout.js).
 *
 * v27 — Quadros responsivos: na grade, cada quadro de valores usa a maior fonte com que o conteúdo cabe no
 * tamanho dele (rótulos quebram linha; Análise econômica em 1, 2 ou 3 colunas e Custos por em 4, 2 × 2 ou 1,
 * o arranjo que permitir a fonte maior) e recalcula ao mudar de tamanho — inclusive enquanto o Dev redimensiona.
 * Os gráficos ajustam a fonte dos eixos ao próprio tamanho. A exportação em PDF usa o mesmo ajuste.
 *
 * v29 — Fonte única na página: todos os quadros de valores usam a mesma fonte (a maior com que todos cabem) e
 * os três gráficos também (ui/graficos.js), em vez de cada quadro ter um tamanho diferente.
 */
import { h, montar } from '../core/dom.js';
import { api } from '../core/api.js';
import { estado } from '../core/estado.js';
import {
  classeSinal, fmtData, fmtIndice, fmtMes, fmtMoeda, fmtNumero, fmtPercentual, fmtVariacao, VAZIO,
} from '../core/formato.js';
import { LAYOUT_PADRAO, normalizarLayout, QUADROS } from '../domain/layout-resumo.js';
import { pode } from '../domain/permissoes.js';
import { calcularResumoGeral } from '../domain/resumo-geral.js';
import { card, cardTitulo, seloCompetencia, toast, vazio } from '../ui/componentes.js';
import { aplicarLayout, editarLayout } from '../ui/editor-layout.js';
import { grafico } from '../ui/graficos.js';
import { velocimetro } from '../ui/velocimetro.js';
import { icone } from '../ui/icones.js';
import { abrirInfosObra } from './infos-obra.js';

export function renderResumoGeral(alvo, { base, filtro, usuario }) {
  if (!filtro.obras.length) return montar(alvo, vazio('Selecione uma obra no filtro'));
  const r = calcularResumoGeral(base, filtro);
  const nomes = base.obras.filter((o) => filtro.obras.includes(o.chave)).map((o) => o.nome);

  const curva = h('div', { class: 'grafico-area' });
  const barras = h('div', { class: 'grafico-area' });
  const assertividade = h('div', { class: 'grafico-area' });
  const cartao = (id, titulo, conteudo, extra = null, classe = '') => {
    conteudo.classList.add('rg-conteudo'); // v27: é a fonte deste bloco que se ajusta ao tamanho do quadro
    return card({ class: `rg-cartao ${classe}`, dataset: { quadro: id } }, titulo ? cardTitulo(titulo, extra) : null, conteudo);
  };
  const quadros = {
    cef: cartao('cef', null, quadroCefFisico(r.painelFisico), null, 'rg-cef'),
    economica: cartao('economica', 'Análise econômica', analiseEconomica(r.economico), h('span', { class: 'muted small' }, fmtMes(r.referencia)), 'rg-economica'),
    curva: cartao('curva', 'Curva acumulada atual × original', curva, null, 'rg-grafico'),
    barras: cartao('barras', 'Realizado × planejado (mês)', barras, null, 'rg-grafico'),
    assertividade: cartao('assertividade', 'Assertividade', assertividade, null, 'rg-grafico'),
    custos: cartao('custos', 'Custos por (R$)', custosPor(r.custosPor), h('span', { class: 'muted small' }, 'sem correção'), 'rg-custos'),
    incc: cartao('incc', 'INCC', incc(r.incc), null, 'rg-incc'),
    nhnu: cartao('nhnu', 'NH-NU', h('div', { class: 'rg-numero' }, h('b', { class: 'tab' }, fmtNumero(r.nhnu, 1)), h('small', { class: 'muted' }, 'Homens/mês × UH × realizado mês ÷ 100')), null, 'rg-nhnu'),
    andamento: cartao('andamento', 'Andamento geral', velocimetro(r.andamento), null, 'rg-andamento'),
  };
  const corpo = h('div', { class: 'rg-corpo' }, QUADROS.map((q) => quadros[q.id]));
  let layout = normalizarLayout(estado.bruto?.layoutResumoGeral ?? LAYOUT_PADRAO);
  aplicarLayout(corpo, layout);

  const acoes = h('div', { class: 'row' },
    seloCompetencia(r.referencia, { compacto: true }),
    nomes.length === 1 ? h('button', { class: 'btn secondary sm', type: 'button', onclick: () => abrirInfosObra(base, filtro.obras[0]) }, '+ Infos da obra') : null);
  const pagina = h('div', { class: 'rg' },
    h('div', { class: 'rg-titulo' },
      h('h1', {}, nomes.length === 1 ? nomes[0] : `${nomes.length} obras`,
        nomes.length > 1 ? h('small', {}, 'percentuais ponderados pelo orçamento; R$ somados') : null),
      acoes),
    corpo);

  // Dev: "Editar layout" troca as ações do título pela barra de edição até salvar ou cancelar.
  if (pode(usuario?.papel, 'administrar')) {
    const botaoEditar = h('button', {
      class: 'btn ghost sm so-edicao rg-editar', type: 'button', 'data-teste': 'editar-layout',
      onclick: () => {
        const barra = editarLayout({
          pagina, corpo, layout,
          aoMudar: ajustar,
          aoSalvar: async (novo) => {
            try {
              const { layout: gravado } = await api.put('/layouts/resumo-geral', { layout: novo });
              if (estado.bruto) estado.bruto.layoutResumoGeral = gravado;
              toast('success', 'Layout salvo para todas as apresentações');
              return true;
            } catch (e) {
              toast('error', 'Não foi possível salvar o layout', e.message);
              return false;
            }
          },
          aoTerminar: (final) => { layout = final; barra.replaceWith(acoes); },
        });
        acoes.replaceWith(barra);
      },
    }, icone('grade', { tamanho: 16 }), 'Editar layout');
    acoes.prepend(botaoEditar);
  }

  montar(alvo, pagina);
  const ajustar = ajustarAlturaATela(pagina);

  const { meses } = r.graficos;
  grafico(curva, {
    tipo: 'line', meses, referencia: r.referencia, fonteProporcional: true,
    series: [
      { rotulo: 'Previsto original', valores: r.graficos.curvaAcumulada.previstoOriginal, cor: '--series-3', tracejada: true },
      { rotulo: 'Realizado', valores: r.graficos.curvaAcumulada.realizado, cor: '--series-2', marcadores: true, linha: true, rotulos: 'acima' },
      { rotulo: 'Planejado atual', valores: r.graficos.curvaAcumulada.planejadoAtual, cor: '--series-1', linha: true, rotulos: 'abaixo' },
    ],
  });
  grafico(barras, {
    tipo: 'bar', meses, referencia: r.referencia, fonteProporcional: true,
    series: [
      { rotulo: 'Realizado', valores: r.graficos.realizadoPlanejadoMes.realizado, cor: '--series-2' },
      { rotulo: 'Planejado atual', valores: r.graficos.realizadoPlanejadoMes.planejado, cor: '--series-1' },
    ],
  });
  grafico(assertividade, {
    tipo: 'bar', meses, referencia: r.referencia, descricao: 'Assertividade mensal', minimoMax: 1, fonteProporcional: true, // eixo vai ao menos a 100%
    series: [{ rotulo: 'Assertividade', valores: r.graficos.assertividade, cor: '--series-1' }],
  });
}

/**
 * A página ocupa exatamente a altura livre da janela (sem barra de rolagem) e a grade dos quadros cobre todo
 * o espaço. Em telas pequenas (largura < 1100 px ou altura < 620 px) os quadros voltam a ficar um abaixo do
 * outro, com rolagem (e sem a edição de layout).
 */
function ajustarAlturaATela(pagina) {
  // Exportação em PDF: sempre a grade, com a altura de uma página A4 paisagem (css/impressao.css); a fonte dos
  // quadros é ajustada pelo exportar-pdf.js (enquadrarResumoGeral), que conhece o tamanho final da página.
  if (pagina.closest('.impressao')) {
    pagina.classList.add('rg-tela');
    return () => {};
  }
  // v27/v29: quando um quadro muda de tamanho (janela, edição do layout), a fonte única da página é recalculada.
  let agendado = false;
  const observador = new ResizeObserver(() => {
    if (!pagina.isConnected) return observador.disconnect();
    if (!pagina.classList.contains('rg-tela') || agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; ajustarQuadros(pagina); });
  });
  for (const c of pagina.querySelectorAll('.rg-cartao')) observador.observe(c);
  const ajustar = () => {
    if (!pagina.isConnected) return window.removeEventListener('resize', ajustar);
    const cabe = window.innerWidth >= 1100 && window.innerHeight >= 620;
    pagina.classList.toggle('rg-tela', cabe);
    pagina.style.height = cabe ? `${Math.floor(window.innerHeight - pagina.getBoundingClientRect().top - 16)}px` : '';
    if (cabe) ajustarQuadros(pagina);
    else limparAjuste(pagina);
  };
  window.addEventListener('resize', ajustar);
  requestAnimationFrame(ajustar);
  ajustar();
  return ajustar;
}

/**
 * v27 — Fonte (px) dos quadros de valores: entre o mínimo legível e o máximo, a maior com que o conteúdo cabe.
 * Na impressão os limites são menores (a página A4 é mais densa que a tela).
 */
export const FONTE_QUADRO = Object.freeze({ tela: { min: 10, max: 24 }, impressao: { min: 9, max: 18 } });

/** Arranjos alternativos por quadro (classe no conteúdo); o primeiro é o padrão, usado em caso de empate. */
const ARRANJOS = {
  economica: ['colunas-2', 'colunas-3', 'colunas-1'],
  custos: ['', 'custos-2x2', 'custos-1'],
};
/** Quadros sem texto a ajustar: gráficos (ajustam a própria fonte) e o velocímetro (SVG que acompanha o quadro). */
const SEM_AJUSTE = new Set(['curva', 'barras', 'assertividade', 'andamento']);

const cortado = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
/** Valores que não quebram linha (ex.: Custos por) podem vazar da própria célula sem cortar o quadro. */
const vazaCelula = (conteudo) => [...conteudo.querySelectorAll('.custo-item, dd, td')].some((el) => el.scrollWidth > el.clientWidth + 1);

function aplicarArranjo(conteudo, arranjos, escolhido) {
  for (const a of arranjos) if (a) conteudo.classList.toggle(a, a === escolhido);
}

/** Maior fonte em que nada do quadro fica cortado, ou null se nem a mínima couber. */
function maiorFonte(cartao, conteudo, { min, max }) {
  const cabe = (f) => {
    conteudo.style.fontSize = `${f}px`;
    return !cortado(cartao) && !cortado(conteudo) && !vazaCelula(conteudo);
  };
  if (!cabe(min)) return null;
  let [menor, maior] = [min, max];
  if (cabe(max)) return max;
  while (maior - menor > 0.25) {
    const meio = (menor + maior) / 2;
    if (cabe(meio)) menor = meio;
    else maior = meio;
  }
  return Math.floor(menor * 4) / 4;
}

/** Maior fonte de um quadro em cada arranjo: [{ arranjo, fonte | null }] (null = nem a mínima coube). */
function fontesDoQuadro(cartao, conteudo, limites) {
  const arranjos = ARRANJOS[cartao.dataset.quadro] ?? [''];
  return arranjos.map((arranjo) => {
    aplicarArranjo(conteudo, arranjos, arranjo);
    return { arranjo, fonte: maiorFonte(cartao, conteudo, limites) };
  });
}

/**
 * Ajusta todos os quadros de valores da página à mesma fonte: a maior com que todos cabem (v29). Cada quadro
 * fica no primeiro arranjo em que essa fonte cabe. Quadro que não coube nem na fonte mínima ganha a classe
 * `apertado` (na tela, rolagem por dentro; no PDF a página é ampliada até caber). Devolve true se todos couberam.
 */
export function ajustarQuadros(pagina, limites = FONTE_QUADRO.tela) {
  const quadros = [...pagina.querySelectorAll('.rg-cartao')]
    .filter((c) => !SEM_AJUSTE.has(c.dataset.quadro))
    .map((cartao) => ({ cartao, conteudo: cartao.querySelector(':scope > .rg-conteudo') }))
    .filter((q) => q.conteudo);
  for (const q of quadros) q.opcoes = fontesDoQuadro(q.cartao, q.conteudo, limites);
  const maximos = quadros.map((q) => Math.max(...q.opcoes.map((o) => o.fonte ?? -1))).filter((f) => f >= 0);
  const fonte = maximos.length ? Math.min(...maximos) : limites.min;
  let todos = true;
  for (const { cartao, conteudo, opcoes } of quadros) {
    const arranjos = opcoes.map((o) => o.arranjo);
    const escolhido = opcoes.find((o) => o.fonte !== null && o.fonte >= fonte) ?? null;
    aplicarArranjo(conteudo, arranjos, escolhido?.arranjo ?? arranjos[0]);
    conteudo.style.fontSize = `${fonte}px`;
    cartao.classList.toggle('apertado', !escolhido);
    todos = todos && Boolean(escolhido);
  }
  return todos;
}

/** Telas pequenas (um quadro abaixo do outro): volta à fonte e ao arranjo padrão. */
function limparAjuste(pagina) {
  for (const c of pagina.querySelectorAll('.rg-cartao')) {
    c.classList.remove('apertado');
    const conteudo = c.querySelector(':scope > .rg-conteudo');
    if (!conteudo) continue;
    conteudo.style.fontSize = '';
    aplicarArranjo(conteudo, ARRANJOS[c.dataset.quadro] ?? [''], null);
  }
}

/** Quadro CEF × Físico — mês de referência e mês seguinte. */
/** Desvio como selo colorido com seta (status nunca só pela cor). */
function seloDesvio(v) {
  if (typeof v !== 'number') return VAZIO;
  const tipo = Math.abs(v) < 0.0005 ? 'neutro' : v > 0 ? 'ok' : 'ruim';
  return h('span', { class: `selo-desvio ${tipo}`, title: tipo === 'ok' ? 'Adiantado' : tipo === 'ruim' ? 'Atrasado' : 'No planejado' },
    tipo === 'ok' ? '▲' : tipo === 'ruim' ? '▼' : '■', fmtPercentual(Math.abs(v), 1));
}

function quadroCefFisico(p) {
  const linha = (rotulo, cef, fisico, desvio = false) => h('tr', { class: desvio ? 'desvio' : '' },
    h('td', { class: 'rot' }, rotulo),
    h('td', {}, desvio ? seloDesvio(cef) : fmtPercentual(cef, 1)),
    h('td', {}, desvio ? seloDesvio(fisico) : fmtPercentual(fisico, 1)));
  const grupo = (texto, linhas) => [
    h('tr', {}, h('th', { class: 'grupo', rowspan: linhas.length + 1, scope: 'rowgroup' }, texto)),
    ...linhas,
  ];
  const { atual, proximo } = p;
  return h('div', { class: 'rg-cef-conteudo' },
    h('table', { class: 'cef-fisico', 'aria-label': 'Quadro CEF e Físico' },
      h('thead', {}, h('tr', {}, h('th', {}), h('th', {}),
        h('th', { scope: 'col' }, h('span', { class: 'pilula cef' }, 'CEF')),
        h('th', { scope: 'col' }, h('span', { class: 'pilula fisico' }, 'Físico')))),
      h('tbody', {},
        grupo(fmtMes(p.referencia), [
          linha('Avanço mês', atual.cef.avancoMes, atual.fisico.avancoMes),
          linha('Avanço acm', atual.cef.avancoAcm, atual.fisico.avancoAcm),
          linha('Cronograma', atual.cef.cronograma, atual.fisico.cronograma),
          linha('Previsto (rep1) acm', atual.cef.previsto, atual.fisico.previsto),
          linha('Desvio', atual.cef.desvio, atual.fisico.desvio, true),
        ]),
        grupo(fmtMes(p.seguinte), [
          linha('Projetado mês', proximo.cef.projetadoMes, proximo.fisico.projetadoMes),
          linha('Projetado acm', proximo.cef.projetadoAcm, proximo.fisico.projetadoAcm),
          linha('Cronograma', proximo.cef.cronograma, proximo.fisico.cronograma),
          linha('Previsto (rep1) acm', proximo.cef.previsto, proximo.fisico.previsto),
          linha('Desvio', proximo.cef.desvio, proximo.fisico.desvio, true),
        ]))),
    p.temCef ? null : h('p', { class: 'muted small', style: { marginTop: '6px' } }, 'Obra sem curva CEF: valores CEF zerados.'));
}

function analiseEconomica(e) {
  const itens = [
    ['Orçado (R$)', fmtMoeda(e.orcado)],
    ['Projetado (R$)', fmtMoeda(e.projetado)],
    ['Desvio (R$)', fmtMoeda(e.desvio), classeSinal(e.desvio)],
    ['IEC', e.iec === null ? VAZIO : fmtNumero(e.iec, 4)],
    ['% de indireto', fmtPercentual(e.percIndireto)],
    ['Custo pago e a pagar (R$)', fmtMoeda(e.custoPagoAPagar)],
    ['Saldos OCs e contratos (R$)', fmtMoeda(e.saldosOcContratos)],
    ['Orç. de término (R$)', fmtMoeda(e.orcamentoTermino)],
    ['Passível de reajuste (R$)', fmtMoeda(e.passivelReajuste)],
    ['Total de aditivos (R$)', fmtMoeda(e.totalAditivos)],
    ['Aditivos aprovados (R$)', fmtMoeda(e.aditivosAprovados)],
    ['Aditivos à aprovar (R$)', fmtMoeda(e.aditivosAAprovar)],
    ['Custos não incidentes (R$)', fmtMoeda(e.custosNaoIncidentes)],
  ];
  // Grade de 2 colunas (rótulo sobre o valor): cabe na altura da tela junto com o quadro CEF × Físico.
  return h('dl', { class: 'economia-grade' }, itens.map(([rotulo, valor, classe]) => h('div', {}, h('dt', { title: rotulo }, rotulo), h('dd', { class: classe ?? '' }, valor))));
}

function custosPor(c) {
  const item = (sigla, nome, valor) => h('div', { class: 'custo-item', title: `${nome}: ${fmtMoeda(valor)}` }, h('span', { class: 'sigla' }, sigla), h('b', { class: 'tab' }, fmtMoeda(valor)), h('small', {}, nome));
  return h('div', {},
    h('div', { class: 'custos-por' },
      item('UH', 'por unidade', c.uh), item('AE', 'por m² equivalente', c.ae), item('AP', 'por m² privativo', c.ap), item('AC', 'por m² construído', c.ac)),
    c.uh === null && c.ae === null ? h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'Preencha Nº de UH e áreas no cadastro da obra.') : null);
}

function incc(i) {
  return h('dl', { class: 'lista-valores' },
    h('dt', {}, 'Base'), h('dd', {}, fmtIndice(i.base)),
    h('dt', {}, `Atual (${fmtMes(i.mesAtual)})`), h('dd', {}, fmtIndice(i.atual)),
    h('dt', {}, '% reajuste'), h('dd', {}, typeof i.reajuste === 'number' ? h('span', { class: 'selo-desvio info' }, fmtVariacao(i.reajuste)) : VAZIO),
    i.dataBase ? [h('dt', { class: 'muted small' }, 'Data-base'), h('dd', { class: 'muted small' }, fmtData(i.dataBase))] : null);
}
