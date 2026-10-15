/**
 * Aba "Resumo Geral" — layout do Power BI: quadro CEF × Físico e Análise Econômica à esquerda,
 * três gráficos mês a mês à direita, e custos por unidade, INCC, NH-NU e velocímetro no rodapé.
 */
import { h, montar } from '../core/dom.js';
import {
  classeSinal, fmtData, fmtIndice, fmtMes, fmtMoeda, fmtMoedaCompacta, fmtNumero, fmtPercentual, fmtVariacao, VAZIO,
} from '../core/formato.js';
import { calcularResumoGeral } from '../domain/resumo-geral.js';
import { card, cardTitulo, vazio } from '../ui/componentes.js';
import { grafico } from '../ui/graficos.js';
import { velocimetro } from '../ui/velocimetro.js';
import { abrirInfosObra } from './infos-obra.js';

export function renderResumoGeral(alvo, { base, filtro }) {
  if (!filtro.obras.length) return montar(alvo, vazio('Selecione uma obra no filtro'));
  const r = calcularResumoGeral(base, filtro);
  const nomes = base.obras.filter((o) => filtro.obras.includes(o.chave)).map((o) => o.nome);

  const curva = h('div', { class: 'grafico-area' });
  const barras = h('div', { class: 'grafico-area' });
  const assertividade = h('div', { class: 'grafico-area' });
  const cartao = (titulo, conteudo, extra = null, classe = '') => card({ class: `rg-cartao ${classe}` }, cardTitulo(titulo, extra), conteudo);

  const pagina = h('div', { class: 'rg' },
    h('div', { class: 'rg-titulo' },
      h('h1', {}, nomes.length === 1 ? nomes[0] : `${nomes.length} obras`,
        h('span', { class: 'eyebrow' }, `Fechamento ${fmtMes(r.referencia)}`),
        nomes.length > 1 ? h('small', {}, 'percentuais ponderados pelo orçamento; R$ somados') : null),
      nomes.length === 1 ? h('button', { class: 'btn secondary sm', type: 'button', onclick: () => abrirInfosObra(base, filtro.obras[0]) }, '+ Infos da obra') : null),
    h('div', { class: 'rg-corpo' },
      h('div', { class: 'rg-esquerda' },
        card({ class: 'rg-cartao' }, quadroCefFisico(r.painelFisico)),
        cartao('Análise econômica', analiseEconomica(r.economico), h('span', { class: 'muted small' }, fmtMes(r.referencia)), 'rg-economica')),
      h('div', { class: 'rg-direita' },
        cartao('Curva acumulada atual × original', curva, null, 'rg-grafico'),
        cartao('Realizado × planejado (mês)', barras, null, 'rg-grafico'),
        cartao('Assertividade', assertividade, null, 'rg-grafico'),
        h('div', { class: 'rg-rodape' },
          cartao('Custos por', custosPor(r.custosPor), h('span', { class: 'muted small' }, 'sem correção'), 'rg-custos'),
          cartao('INCC', incc(r.incc)),
          cartao('NH-NU', h('div', { class: 'rg-numero' }, h('b', { class: 'tab' }, fmtNumero(r.nhnu, 1)), h('small', { class: 'muted' }, 'Homens/mês × UH × realizado mês ÷ 100'))),
          cartao('Andamento geral', velocimetro(r.andamento))))));
  montar(alvo, pagina);
  ajustarAlturaATela(pagina);

  const { meses } = r.graficos;
  grafico(curva, {
    tipo: 'line', meses, referencia: r.referencia,
    series: [
      { rotulo: 'Previsto original', valores: r.graficos.curvaAcumulada.previstoOriginal, cor: '--series-3', tracejada: true },
      { rotulo: 'Realizado', valores: r.graficos.curvaAcumulada.realizado, cor: '--series-2', marcadores: true, linha: true },
      { rotulo: 'Planejado atual', valores: r.graficos.curvaAcumulada.planejadoAtual, cor: '--series-1', linha: true },
    ],
  });
  grafico(barras, {
    tipo: 'bar', meses, referencia: r.referencia,
    series: [
      { rotulo: 'Realizado', valores: r.graficos.realizadoPlanejadoMes.realizado, cor: '--series-2' },
      { rotulo: 'Planejado atual', valores: r.graficos.realizadoPlanejadoMes.planejado, cor: '--series-1' },
    ],
  });
  grafico(assertividade, {
    tipo: 'bar', meses, referencia: r.referencia, descricao: 'Assertividade mensal',
    series: [{ rotulo: 'Assertividade', valores: r.graficos.assertividade, cor: '--series-1' }],
  });
}

/**
 * A página ocupa exatamente a altura livre da janela (sem barra de rolagem): os gráficos dividem o
 * espaço que sobra. Em telas pequenas (largura < 1100 px ou altura < 620 px) volta ao fluxo normal com rolagem.
 */
function ajustarAlturaATela(pagina) {
  const ajustar = () => {
    if (!pagina.isConnected) return window.removeEventListener('resize', ajustar);
    const cabe = window.innerWidth >= 1100 && window.innerHeight >= 620;
    pagina.classList.toggle('rg-tela', cabe);
    pagina.style.height = cabe ? `${Math.floor(window.innerHeight - pagina.getBoundingClientRect().top - 16)}px` : '';
    // Se a análise econômica não couber, troca os R$ por valores compactos (R$ 13,5 mi).
    const economica = pagina.querySelector('.rg-economica');
    economica?.classList.remove('compacto');
    if (cabe && economica && economica.scrollHeight > economica.clientHeight + 1) economica.classList.add('compacto');
  };
  window.addEventListener('resize', ajustar);
  requestAnimationFrame(ajustar);
  ajustar();
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
  return h('div', {},
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

/** Valor em R$ completo e compacto; a versão compacta aparece só se o cartão não couber na tela. */
const moeda = (v) => h('span', { title: fmtMoeda(v) }, h('span', { class: 'v-cheio' }, fmtMoeda(v)), h('span', { class: 'v-curto' }, fmtMoedaCompacta(v)));

function analiseEconomica(e) {
  const itens = [
    ['Orçado', moeda(e.orcado)],
    ['Projetado', moeda(e.projetado)],
    ['Desvio R$', moeda(e.desvio), classeSinal(e.desvio)],
    ['IEC', e.iec === null ? VAZIO : fmtNumero(e.iec, 4)],
    ['% de indireto', fmtPercentual(e.percIndireto)],
    ['Custo pago e a pagar', moeda(e.custoPagoAPagar)],
    ['Saldos OCs e contratos', moeda(e.saldosOcContratos)],
    ['Orç. de término', moeda(e.orcamentoTermino)],
    ['R$ passível de reajuste', moeda(e.passivelReajuste)],
    ['Total de aditivos', moeda(e.totalAditivos)],
    ['Aditivos aprovados', moeda(e.aditivosAprovados)],
    ['Aditivos à aprovar', moeda(e.aditivosAAprovar)],
    ['Custos não incidentes', moeda(e.custosNaoIncidentes)],
  ];
  // Grade de 2 colunas (rótulo sobre o valor): cabe na altura da tela junto com o quadro CEF × Físico.
  return h('dl', { class: 'economia-grade' }, itens.map(([rotulo, valor, classe]) => h('div', {}, h('dt', { title: rotulo }, rotulo), h('dd', { class: classe ?? '' }, valor))));
}

function custosPor(c) {
  const item = (sigla, nome, valor) => h('div', { class: 'custo-item', title: `${nome}: ${fmtMoeda(valor)}` }, h('span', { class: 'sigla' }, sigla), h('b', { class: 'tab' }, fmtMoedaCompacta(valor)), h('small', {}, nome));
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
