/**
 * Painel de Obras da capa: uma linha por obra do cadastro, colunas agrupadas como na aba "Painel" da
 * planilha. Cada grupo tem um rótulo vertical (o "segmentador" da planilha) que recolhe/expande as colunas.
 * Cálculos em domain/painel-obras.js; aqui só formatação e interação.
 */
import { h, montar } from '../core/dom.js';
import { fmtData, fmtMes, fmtMoeda, fmtMoedaCompacta, fmtNumero, fmtPercentual, fmtVariacao, VAZIO } from '../core/formato.js';
import { icone } from './icones.js';

const CHAVE_RECOLHIDOS = 'apresentacao.painelObras.recolhidos';
const RECOLHIDOS_PADRAO = ['gestao', 'datas', 'areas', 'taxa'];

const meses = (n) => (typeof n === 'number' ? `${n} ${n === 1 ? 'mês' : 'meses'}` : VAZIO);
const pct = (v) => fmtPercentual(v, 1);
const txt = (v) => v ?? VAZIO;
const m2 = (v) => (typeof v === 'number' ? `${fmtNumero(v, 2)} m²` : VAZIO);

/** Célula de status (Físico Cliente/Obra): Atrasada/Adiantada/OK + desvio em pontos percentuais. */
function status(desvio) {
  if (typeof desvio !== 'number') return [VAZIO, null];
  const tipo = desvio < 0 ? 'atrasada' : desvio > 0 ? 'adiantada' : 'ok';
  return [h('span', { class: `po-status ${tipo}` }, desvio < 0 ? 'Atrasada' : desvio > 0 ? 'Adiantada' : 'OK'), fmtVariacao(desvio, 1)];
}

/** Barra fina de progresso (0–100%) sob o percentual de avanço. */
const barra = (v) => (typeof v === 'number' ? h('span', { class: 'po-barra', 'aria-hidden': 'true' }, h('i', { style: { width: `${Math.max(0, Math.min(1, v)) * 100}%` } })) : null);

/** Grupos e colunas na ordem da planilha. `v(linha)` → [valor principal, linha de baixo]; `barra` = progresso. */
function grupos() {
  return [
    { id: 'geral', titulo: 'Informações Gerais', colunas: [
      { titulo: 'Orçamento raso', v: (l) => [fmtMoedaCompacta(l.geral.orcamentoRaso)] },
      { titulo: 'Orçamento com taxa e impostos', v: (l) => [fmtMoedaCompacta(l.geral.orcamentoComTaxa)] },
      { titulo: 'UH', v: (l) => [fmtNumero(l.geral.uh)] },
      { titulo: 'Sistema estrutural', texto: true, v: (l) => [txt(l.geral.sistemaEstrutural)] },
      { titulo: 'Tipologia', texto: true, v: (l) => [txt(l.geral.tipologia)] },
      { titulo: 'Torres', v: (l) => [fmtNumero(l.geral.torres)] },
      { titulo: 'Fundação', texto: true, v: (l) => [txt(l.geral.fundacao)] },
      { titulo: 'Segmento', texto: true, v: (l) => [txt(l.geral.segmento)] },
      { titulo: 'Endereço', texto: true, v: (l) => [txt(l.geral.endereco)] },
      { titulo: 'Cidade', texto: true, v: (l) => [txt(l.geral.cidade)] },
    ] },
    { id: 'gestao', titulo: 'Gestão de Obra', colunas: [
      { titulo: 'Diretor', texto: true, v: (l) => [txt(l.gestao.diretor)] },
      { titulo: 'Gerente', texto: true, v: (l) => [txt(l.gestao.gerente)] },
      { titulo: 'Coordenador', texto: true, v: (l) => [txt(l.gestao.coordenador)] },
      { titulo: 'Engenheiro', texto: true, v: (l) => [txt(l.gestao.engenheiro)] },
      { titulo: 'Planejamento', texto: true, v: (l) => [txt(l.gestao.planejamento)] },
    ] },
    { id: 'datas', titulo: 'Datas', colunas: [
      { titulo: 'Início de obra', sub: 'meses incorridos', v: (l) => [fmtData(l.datas.inicio), meses(l.datas.mesesIncorridos)] },
      { titulo: 'Término contrato', sub: 'duração', v: (l) => [fmtData(l.datas.terminoContrato), meses(l.datas.duracaoContrato)] },
      { titulo: 'Término cliente final', sub: 'duração', v: (l) => [fmtData(l.datas.terminoCliente), meses(l.datas.duracaoCliente)] },
      { titulo: 'Término projetado', sub: 'duração', v: (l) => [fmtData(l.datas.terminoProjetado), meses(l.datas.duracaoProjetada)] },
    ] },
    { id: 'realizado', titulo: 'Realizado', colunas: [
      { titulo: 'Avanço acumulado', sub: 'no mês', barra: (l) => l.realizado.avancoAcm, v: (l) => [pct(l.realizado.avancoAcm), pct(l.realizado.avancoMes)] },
      { titulo: 'Assertividade', sub: 'meta do mês', v: (l) => [pct(l.realizado.assertividade), pct(l.realizado.metaMes)] },
    ] },
    { id: 'meta', titulo: 'Meta', colunas: [
      { titulo: 'Meta projetada acumulada', sub: 'no mês', barra: (l) => l.meta.acumulada, v: (l) => [pct(l.meta.acumulada), pct(l.meta.mes)] },
    ] },
    { id: 'cliente', titulo: 'Físico Cliente', colunas: [
      { titulo: 'Realizado × curva original', v: (l) => status(l.fisicoCliente.realOriginal) },
      { titulo: 'Realizado × curva atual', v: (l) => status(l.fisicoCliente.realAtual) },
      { titulo: 'Meta × curva original', v: (l) => status(l.fisicoCliente.metaOriginal) },
      { titulo: 'Meta × curva atual', v: (l) => status(l.fisicoCliente.metaAtual) },
    ] },
    { id: 'obra', titulo: 'Físico Obra', colunas: [
      { titulo: 'Término meta obra', sub: 'meses restantes', v: (l) => [fmtData(l.fisicoObra.termino), meses(l.fisicoObra.mesesRestantes)] },
      { titulo: 'Realizado × curva plat. original', v: (l) => status(l.fisicoObra.realOriginal) },
      { titulo: 'Realizado × curva plat. atual', v: (l) => status(l.fisicoObra.realAtual) },
      { titulo: 'Meta × curva atual', v: (l) => status(l.fisicoObra.metaAtual) },
    ] },
    { id: 'projecao', titulo: 'Projeções / Tendência', colunas: [
      { titulo: 'Término projetado planejamento', sub: 'meses restantes', v: (l) => [fmtData(l.projecao.termino), meses(l.projecao.mesesRestantes)] },
    ] },
    { id: 'economico', titulo: 'Econômico', colunas: [
      { titulo: 'IEC contrato', sub: 'resultado obra', v: (l) => [fmtNumero(l.economico.iec, 3), fmtMoedaCompacta(l.economico.resultado)] },
      { titulo: 'IEC sem correção', sub: 'resultado sem correção', v: (l) => [fmtNumero(l.economico.iecSemCorrecao, 3), fmtMoedaCompacta(l.economico.resultadoSemCorrecao)] },
      { titulo: 'Custo total corrigido I0', sub: 'sem correção', v: (l) => [fmtMoedaCompacta(l.economico.custoCorrigido), fmtMoedaCompacta(l.economico.custoSemCorrecao)] },
      { titulo: 'Total aditivos', sub: 'a aprovar', v: (l) => [fmtMoedaCompacta(l.economico.totalAditivos), fmtMoedaCompacta(l.economico.aditivosAAprovar)] },
      { titulo: 'Custos fora contrato', v: (l) => [fmtMoedaCompacta(l.economico.custosForaContrato)] },
      { titulo: 'Contingência', v: (l) => [fmtMoedaCompacta(l.economico.contingencia)] },
      { titulo: 'INCC orçamento', sub: 'correção INCC', v: (l) => [fmtNumero(l.economico.inccOrcamento, 3), pct(l.economico.correcaoIncc)] },
    ] },
    { id: 'areas', titulo: 'Áreas', colunas: [
      { titulo: 'Área privativa', sub: 'custo por m²', v: (l) => [m2(l.areas.privativa), fmtMoeda(l.areas.custoPrivativa)] },
      { titulo: 'Custo por UH médio', v: (l) => [fmtMoeda(l.areas.custoUh)] },
      { titulo: 'Área privativa média', v: (l) => [m2(l.areas.privativaMedia)] },
      { titulo: 'Área construída', sub: 'custo por m²', v: (l) => [m2(l.areas.construida), fmtMoeda(l.areas.custoConstruida)] },
      { titulo: 'Área equivalente', sub: 'custo por m²', v: (l) => [m2(l.areas.equivalente), fmtMoeda(l.areas.custoEquivalente)] },
    ] },
    { id: 'taxa', titulo: 'Taxa Adm', colunas: [
      { titulo: 'Taxa adm prevista', sub: 'percentual', v: (l) => [fmtMoedaCompacta(l.taxa.prevista), pct(l.taxa.percentual)] },
      { titulo: 'Banda', v: (l) => [pct(l.taxa.banda)] },
      { titulo: 'Ajuste projeção taxa', sub: '% da taxa prevista', v: (l) => [fmtMoedaCompacta(l.taxa.ajuste), pct(l.taxa.ajustePercentual)] },
    ] },
  ];
}

function lerRecolhidos() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_RECOLHIDOS));
    return new Set(Array.isArray(salvo) ? salvo : RECOLHIDOS_PADRAO);
  } catch {
    return new Set(RECOLHIDOS_PADRAO);
  }
}

function salvarRecolhidos(recolhidos) {
  try {
    localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify([...recolhidos]));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/**
 * @param {{referencia: string, linhas: object[]}} painel  saída de calcularPainelObras
 * @param {{ehAtiva: (chave: string) => boolean, aoAbrirObra: (chave: string) => void}} opcoes
 */
export function painelObras(painel, { ehAtiva, aoAbrirObra }) {
  const recolhidos = lerRecolhidos();
  let somenteAtivas = true;
  const defs = grupos();
  const alvo = h('div');

  const desenhar = () => {
    const linhas = somenteAtivas ? painel.linhas.filter((l) => ehAtiva(l.chave)) : painel.linhas;
    const alternar = (id) => {
      if (recolhidos.has(id)) recolhidos.delete(id);
      else recolhidos.add(id);
      salvarRecolhidos(recolhidos);
      desenhar();
    };
    const todos = (recolher) => {
      for (const g of defs) if (recolher) recolhidos.add(g.id); else recolhidos.delete(g.id);
      salvarRecolhidos(recolhidos);
      desenhar();
    };

    const cabecalho = h('tr', {},
      h('th', { class: 'first po-obra' }, 'Cliente · Obra'),
      defs.map((g) => {
        const aberto = !recolhidos.has(g.id);
        return [
          h('th', { class: `po-segmentador ${aberto ? '' : 'recolhido'}` },
            h('button', { type: 'button', 'aria-expanded': String(aberto), 'aria-label': `${aberto ? 'Recolher' : 'Expandir'} ${g.titulo}`, title: `${aberto ? 'Recolher' : 'Expandir'} ${g.titulo}`, onclick: () => alternar(g.id) },
              h('span', {}, g.titulo), icone(aberto ? 'recolher' : 'expandir', { tamanho: 13 }))),
          aberto ? g.colunas.map((c, i) => h('th', { class: `${c.texto ? 'esq' : ''} ${i === 0 ? 'po-inicio' : ''}` }, c.titulo, c.sub ? h('small', {}, c.sub) : null)) : null,
        ];
      }));

    const corpo = linhas.map((l) => h('tr', { class: l.temFechamento ? '' : 'po-sem-fechamento' },
      h('td', { class: 'first po-obra' },
        h('small', {}, l.cliente ?? 'Sem cliente'),
        h('a', { href: '#/obra/resumo-geral', title: `Abrir o Resumo Geral de ${l.obra}`, onclick: (e) => { e.preventDefault(); aoAbrirObra(l.chave); } }, l.obra)),
      defs.map((g) => {
        const aberto = !recolhidos.has(g.id);
        return [
          h('td', { class: 'po-segmentador' }),
          aberto ? g.colunas.map((c, i) => {
            const [principal, secundario = null] = c.v(l);
            return h('td', { class: `${c.texto ? 'esq po-texto' : ''} ${i === 0 ? 'po-inicio' : ''}` },
              h('span', { class: 'po-valor' }, principal), secundario !== null ? h('small', {}, secundario) : null, c.barra ? barra(c.barra(l)) : null);
          }) : null,
        ];
      })));

    montar(alvo,
      h('div', { class: 'po-topo' },
        h('div', {},
          h('div', { class: 'eyebrow' }, `Fechamento de ${fmtMes(painel.referencia)}`),
          h('h2', {}, 'Painel de obras', h('span', { class: 'po-contagem' }, `${linhas.length} obra${linhas.length === 1 ? '' : 's'}`)),
          h('p', {}, 'Clique no nome da obra para abrir o Resumo Geral dela; nos rótulos verticais, recolha ou expanda cada grupo.')),
        h('div', { class: 'row' },
          h('div', { class: 'segmentos', role: 'group', 'aria-label': 'Obras exibidas' },
            h('button', { type: 'button', 'aria-pressed': String(somenteAtivas), onclick: () => { somenteAtivas = true; desenhar(); } }, 'Ativas'),
            h('button', { type: 'button', 'aria-pressed': String(!somenteAtivas), onclick: () => { somenteAtivas = false; desenhar(); } }, 'Todas do cadastro')),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => todos(false) }, icone('expandir', { tamanho: 16 }), 'Expandir tudo'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: () => todos(true) }, icone('recolher', { tamanho: 16 }), 'Recolher tudo'))),
      h('div', { class: 'sheet painel-obras', 'data-teste': 'painel-obras' },
        h('table', {}, h('thead', {}, cabecalho), h('tbody', {}, corpo))));
  };

  desenhar();
  return alvo;
}
