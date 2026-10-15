/**
 * Aba "Início" — capa do app: marca, mês de fechamento, os quatro indicadores da empresa
 * (obras ativas, assertividade média, unidades construídas no mês, maior assertividade) e atalhos
 * para as demais abas.
 */
import { h, montar } from '../core/dom.js';
import { fmtMesLongo, fmtNumero, fmtPercentual, fmtVariacao } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { mesesDasObras } from '../domain/base.js';
import { calcularInicio } from '../domain/inicio.js';
import { intervaloMeses } from '../domain/normalizar.js';
import { abrirModal, vazio } from '../ui/componentes.js';
import { filtroExcel } from '../ui/filtro-excel.js';
import { itensDeMes } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';

export function renderInicio(alvo, { base, filtro, visao, abas, telas }) {
  const r = visao === 'cliente' ? null : calcularInicio(base, filtro.referencia);
  const meses = mesesDasObras(base, base.obras.map((o) => o.chave));
  const seletorMes = filtroExcel({
    rotulo: 'Mês de referência', multiplo: false, largura: 220, testeId: 'mes-referencia',
    itens: itensDeMes(meses.length ? intervaloMeses(meses[0], meses.at(-1)).reverse() : []),
    selecionados: filtro.referencia,
    aoAplicar: (v) => estado.definirFiltro({ referencia: v }),
  });

  const indicador = (rotulo, valor, detalhe, acao = null, ehNome = false) => h(acao ? 'button' : 'div', {
    class: `capa-kpi ${acao ? 'clicavel' : ''}`, type: acao ? 'button' : null, onclick: acao,
  }, h('span', { class: 'capa-kpi-rotulo' }, rotulo), h('span', { class: `capa-kpi-valor ${ehNome ? 'nome' : ''}` }, valor), detalhe ? h('span', { class: 'capa-kpi-detalhe' }, detalhe) : null);

  const atalhos = [
    ...abas.filter((a) => !a.capa).map((a) => ({ href: `#/${visao}/${a.id}`, nome: a.nome, descricao: a.descricao, icone: a.icone })),
    ...telas.map((t) => ({ href: `#/cliente/tela/${t.id}`, nome: t.titulo, descricao: t.subtitulo ?? 'Tela do cliente', icone: 'planilha' })),
  ];

  montar(alvo, h('section', { class: 'capa' },
    h('img', { class: 'capa-padrao', src: 'assets/brand/pattern-un.png', alt: '', 'aria-hidden': 'true' }),
    h('div', { class: 'capa-conteudo' },
      h('div', { class: 'capa-topo' },
        h('img', { class: 'capa-logo', src: 'assets/brand/logo-unita-white.png', alt: 'Unità Engenharia' }),
        seletorMes),
      // Visão Cliente: a capa é da obra apresentada — sem indicadores da empresa (outras obras, assertividade…).
      visao === 'cliente' ? capaCliente(base, filtro, indicador) : [
        h('div', { class: 'capa-titulo' },
          h('div', { class: 'eyebrow' }, 'Planejamento e Controle'),
          h('h1', {}, 'Apresentação de obras'),
          h('p', {}, `Fechamento de ${fmtMesLongo(filtro.referencia)}`)),
        h('div', { class: 'capa-kpis' },
          indicador('Obras ativas', fmtNumero(r.ativas.length), `${r.obrasComFechamento} com fechamento no mês · ver lista`, () => listaObras(r)),
          indicador('Assertividade média', fmtPercentual(r.assertividadeMedia, 1), 'entre as obras que fecharam o mês'),
          indicador('Unidades construídas no mês', fmtNumero(r.unidadesMes, 1),
            r.obrasSemCadastroUH.length ? `${r.obrasSemCadastroUH.length} obra(s) sem Nº de UH no cadastro` : 'Nº de UH × avanço físico do mês'),
          indicador('Maior assertividade no mês', r.melhor?.nome ?? '—', r.melhor ? `${fmtPercentual(r.melhor.assertividade, 1)} · ${r.melhor.cliente ?? ''}` : null, null, true)),
      ],
      h('nav', { class: 'capa-atalhos', 'aria-label': 'Atalhos' }, atalhos.map((a) => h('a', { class: 'capa-atalho', href: a.href },
        h('span', { class: 'capa-atalho-icone' }, icone(a.icone, { tamanho: 22 })),
        h('span', { class: 'capa-atalho-texto' }, h('b', {}, a.nome), h('small', {}, a.descricao ?? '')),
        icone('direita', { tamanho: 18, classe: 'ico capa-atalho-seta' })))))));
}

/**
 * Capa da apresentação ao cliente: obra escolhida no seletor, com o avanço físico dela no mês
 * (colunas "- Cliente" da planilha). Nenhum dado de outras obras ou da empresa aparece.
 */
function capaCliente(base, filtro, indicador) {
  const obra = base.obras.find((o) => o.chave === filtro.obras[0]) ?? null;
  const info = obra ? base.infos.get(obra.chave)?.get(filtro.referencia) ?? null : null;
  const desvio = typeof info?.realizadoAcm === 'number' && typeof info?.replanAcm === 'number' ? info.realizadoAcm - info.replanAcm : null;
  const seletorObra = filtroExcel({
    rotulo: 'Obra apresentada', multiplo: false, largura: 320, testeId: 'obra-capa',
    itens: base.obras.filter((o) => base.infos.has(o.chave)).map((o) => ({ valor: o.chave, rotulo: o.nome, grupo: o.cliente ?? 'Sem cliente' })),
    selecionados: obra?.chave,
    aoAplicar: (v) => estado.definirFiltro({ obras: [v] }),
  });
  return [
    h('div', { class: 'capa-titulo' },
      h('div', { class: 'eyebrow' }, obra?.cliente ? `Apresentação ao cliente · ${obra.cliente}` : 'Apresentação ao cliente'),
      h('h1', {}, obra?.nome ?? 'Selecione a obra'),
      h('p', {}, `Fechamento de ${fmtMesLongo(filtro.referencia)}`),
      h('div', { class: 'capa-seletor-obra' }, seletorObra)),
    h('div', { class: 'capa-kpis tres' },
      indicador('Avanço físico realizado', fmtPercentual(info?.realizadoAcm, 1), 'acumulado até o mês'),
      indicador('Planejado acumulado', fmtPercentual(info?.replanAcm, 1), 'cronograma atual'),
      indicador('Desvio', fmtVariacao(desvio, 1), desvio === null ? null : desvio >= 0 ? 'adiantado em relação ao planejado' : 'atrasado em relação ao planejado')),
  ];
}

/** Lista das obras ativas (abre ao clicar no indicador). */
function listaObras(r) {
  const m = abrirModal({
    titulo: `Obras ativas — ${r.ativas.length}`,
    largo: true,
    conteudo: r.ativas.length
      ? h('div', { class: 'sheet' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Obra'), h('th', {}, 'Cliente'), h('th', {}, 'Avanço acumulado'), h('th', {}, 'Assertividade no mês'), h('th', {}, 'Unidades no mês'))),
        h('tbody', {}, [...r.ativas].sort((a, b) => (b.assertividade ?? -1) - (a.assertividade ?? -1)).map((o) => h('tr', {},
          h('td', { class: 'first' }, o.nome),
          h('td', { class: 'esq' }, o.cliente ?? '—'),
          h('td', {}, fmtPercentual(o.realizadoAcm, 1)),
          h('td', {}, o.fechouNoMes ? fmtPercentual(o.assertividade, 1) : 'sem fechamento'),
          h('td', {}, fmtNumero(o.unidadesMes, 1)))))))
      : vazio('Nenhuma obra ativa no mês'),
    acoes: [h('button', { class: 'btn secondary', type: 'button', onclick: () => m.fechar() }, 'Fechar')],
  });
}
