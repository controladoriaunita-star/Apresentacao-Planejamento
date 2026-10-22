/**
 * Painel de Obras da capa: uma linha por obra do cadastro, colunas agrupadas como na aba "Painel" da
 * planilha. A barra de grupos (os "segmentadores" da planilha) expande/recolhe as colunas de cada grupo; o
 * alfinete no título de uma coluna a fixa na tela inicial (continua visível com o grupo recolhido).
 * O painel sempre abre com os grupos recolhidos, mostrando só as colunas fixadas (lembradas no navegador).
 * Cálculos em domain/painel-obras.js; aqui só formatação e interação.
 */
import { h, montar } from '../core/dom.js';
import { fmtData, fmtMes, fmtMoeda, fmtMoedaCompacta, fmtNumero, fmtPercentual, fmtVariacao, VAZIO } from '../core/formato.js';
import { icone } from './icones.js';

const CHAVE_FIXADAS = 'apresentacao.painelObras.fixadas';
/** Colunas fixadas de fábrica (`grupo.coluna`), até cada pessoa escolher as suas. */
const FIXADAS_PADRAO = ['realizado.avancoAcm', 'realizado.assertividade', 'meta.acumulada', 'cliente.realAtual', 'obra.termino', 'obra.realAtual', 'economico.iec'];

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

/**
 * Grupos e colunas na ordem da planilha. `v(linha)` → [valor principal, linha de baixo]; `barra` = progresso.
 * Fora do painel: Projeções/Tendência e Taxa Adm (os cálculos continuam em domain/painel-obras.js).
 */
const GRUPOS = [
  { id: 'geral', titulo: 'Informações Gerais', colunas: [
    { id: 'orcamentoRaso', titulo: 'Orçamento raso', v: (l) => [fmtMoedaCompacta(l.geral.orcamentoRaso)] },
    { id: 'orcamentoComTaxa', titulo: 'Orçamento com taxa e impostos', v: (l) => [fmtMoedaCompacta(l.geral.orcamentoComTaxa)] },
    { id: 'uh', titulo: 'UH', v: (l) => [fmtNumero(l.geral.uh)] },
    { id: 'sistemaEstrutural', titulo: 'Sistema estrutural', texto: true, v: (l) => [txt(l.geral.sistemaEstrutural)] },
    { id: 'tipologia', titulo: 'Tipologia', texto: true, v: (l) => [txt(l.geral.tipologia)] },
    { id: 'torres', titulo: 'Torres', v: (l) => [fmtNumero(l.geral.torres)] },
    { id: 'fundacao', titulo: 'Fundação', texto: true, v: (l) => [txt(l.geral.fundacao)] },
    { id: 'segmento', titulo: 'Segmento', texto: true, v: (l) => [txt(l.geral.segmento)] },
    { id: 'endereco', titulo: 'Endereço', texto: true, v: (l) => [txt(l.geral.endereco)] },
    { id: 'cidade', titulo: 'Cidade', texto: true, v: (l) => [txt(l.geral.cidade)] },
  ] },
  { id: 'gestao', titulo: 'Gestão de Obra', colunas: [
    { id: 'diretor', titulo: 'Diretor', texto: true, v: (l) => [txt(l.gestao.diretor)] },
    { id: 'gerente', titulo: 'Gerente', texto: true, v: (l) => [txt(l.gestao.gerente)] },
    { id: 'coordenador', titulo: 'Coordenador', texto: true, v: (l) => [txt(l.gestao.coordenador)] },
    { id: 'engenheiro', titulo: 'Engenheiro', texto: true, v: (l) => [txt(l.gestao.engenheiro)] },
    { id: 'planejamento', titulo: 'Planejamento', texto: true, v: (l) => [txt(l.gestao.planejamento)] },
  ] },
  { id: 'datas', titulo: 'Datas', colunas: [
    { id: 'inicio', titulo: 'Início de obra', sub: 'meses incorridos', v: (l) => [fmtData(l.datas.inicio), meses(l.datas.mesesIncorridos)] },
    { id: 'terminoContrato', titulo: 'Término contrato', sub: 'duração', v: (l) => [fmtData(l.datas.terminoContrato), meses(l.datas.duracaoContrato)] },
    { id: 'terminoCliente', titulo: 'Término cliente final', sub: 'duração', v: (l) => [fmtData(l.datas.terminoCliente), meses(l.datas.duracaoCliente)] },
    { id: 'terminoProjetado', titulo: 'Término projetado', sub: 'duração', v: (l) => [fmtData(l.datas.terminoProjetado), meses(l.datas.duracaoProjetada)] },
  ] },
  { id: 'realizado', titulo: 'Realizado', colunas: [
    { id: 'avancoAcm', titulo: 'Avanço acumulado', sub: 'no mês', barra: (l) => l.realizado.avancoAcm, v: (l) => [pct(l.realizado.avancoAcm), pct(l.realizado.avancoMes)] },
    { id: 'assertividade', titulo: 'Assertividade', sub: 'meta do mês', v: (l) => [pct(l.realizado.assertividade), pct(l.realizado.metaMes)] },
  ] },
  { id: 'meta', titulo: 'Meta', colunas: [
    { id: 'acumulada', titulo: 'Meta projetada acumulada', sub: 'no mês', barra: (l) => l.meta.acumulada, v: (l) => [pct(l.meta.acumulada), pct(l.meta.mes)] },
  ] },
  { id: 'cliente', titulo: 'Físico Cliente', colunas: [
    { id: 'realOriginal', titulo: 'Realizado × curva original', v: (l) => status(l.fisicoCliente.realOriginal) },
    { id: 'realAtual', titulo: 'Realizado × curva atual', v: (l) => status(l.fisicoCliente.realAtual) },
    { id: 'metaOriginal', titulo: 'Meta × curva original', v: (l) => status(l.fisicoCliente.metaOriginal) },
    { id: 'metaAtual', titulo: 'Meta × curva atual', v: (l) => status(l.fisicoCliente.metaAtual) },
  ] },
  { id: 'obra', titulo: 'Físico Obra', colunas: [
    { id: 'termino', titulo: 'Término meta obra', sub: 'meses restantes', v: (l) => [fmtData(l.fisicoObra.termino), meses(l.fisicoObra.mesesRestantes)] },
    { id: 'realOriginal', titulo: 'Realizado × curva plat. original', v: (l) => status(l.fisicoObra.realOriginal) },
    { id: 'realAtual', titulo: 'Realizado × curva plat. atual', v: (l) => status(l.fisicoObra.realAtual) },
    { id: 'metaAtual', titulo: 'Meta × curva atual', v: (l) => status(l.fisicoObra.metaAtual) },
  ] },
  { id: 'economico', titulo: 'Econômico', colunas: [
    { id: 'iec', titulo: 'IEC contrato', sub: 'resultado obra', v: (l) => [fmtNumero(l.economico.iec, 3), fmtMoedaCompacta(l.economico.resultado)] },
    { id: 'iecSemCorrecao', titulo: 'IEC sem correção', sub: 'resultado sem correção', v: (l) => [fmtNumero(l.economico.iecSemCorrecao, 3), fmtMoedaCompacta(l.economico.resultadoSemCorrecao)] },
    { id: 'custoCorrigido', titulo: 'Custo total corrigido I0', sub: 'sem correção', v: (l) => [fmtMoedaCompacta(l.economico.custoCorrigido), fmtMoedaCompacta(l.economico.custoSemCorrecao)] },
    { id: 'totalAditivos', titulo: 'Total aditivos', sub: 'a aprovar', v: (l) => [fmtMoedaCompacta(l.economico.totalAditivos), fmtMoedaCompacta(l.economico.aditivosAAprovar)] },
    { id: 'custosForaContrato', titulo: 'Custos fora contrato', v: (l) => [fmtMoedaCompacta(l.economico.custosForaContrato)] },
    { id: 'contingencia', titulo: 'Contingência', v: (l) => [fmtMoedaCompacta(l.economico.contingencia)] },
    { id: 'inccOrcamento', titulo: 'INCC orçamento', sub: 'correção INCC', v: (l) => [fmtNumero(l.economico.inccOrcamento, 3), pct(l.economico.correcaoIncc)] },
  ] },
  { id: 'areas', titulo: 'Áreas', colunas: [
    { id: 'privativa', titulo: 'Área privativa', sub: 'custo por m²', v: (l) => [m2(l.areas.privativa), fmtMoeda(l.areas.custoPrivativa)] },
    { id: 'custoUh', titulo: 'Custo por UH médio', v: (l) => [fmtMoeda(l.areas.custoUh)] },
    { id: 'privativaMedia', titulo: 'Área privativa média', v: (l) => [m2(l.areas.privativaMedia)] },
    { id: 'construida', titulo: 'Área construída', sub: 'custo por m²', v: (l) => [m2(l.areas.construida), fmtMoeda(l.areas.custoConstruida)] },
    { id: 'equivalente', titulo: 'Área equivalente', sub: 'custo por m²', v: (l) => [m2(l.areas.equivalente), fmtMoeda(l.areas.custoEquivalente)] },
  ] },
].map((g) => ({ ...g, colunas: g.colunas.map((c) => ({ ...c, chave: `${g.id}.${c.id}` })) }));

function lerFixadas() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_FIXADAS));
    return new Set(Array.isArray(salvo) ? salvo : FIXADAS_PADRAO);
  } catch {
    return new Set(FIXADAS_PADRAO);
  }
}

function salvarFixadas(fixadas) {
  try {
    localStorage.setItem(CHAVE_FIXADAS, JSON.stringify([...fixadas]));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/** Liga/desliga `item` no conjunto. */
const alternar = (conjunto, item) => (conjunto.has(item) ? conjunto.delete(item) : conjunto.add(item));

/**
 * @param {{referencia: string, linhas: object[]}} painel  saída de calcularPainelObras
 * @param {{ehAtiva: (chave: string) => boolean, aoAbrirObra: (chave: string) => void}} opcoes
 */
export function painelObras(painel, { ehAtiva, aoAbrirObra }) {
  const fixadas = lerFixadas();
  const abertos = new Set(); // grupos expandidos nesta visita
  let somenteAtivas = true;
  const alvo = h('div', { class: 'po' });

  const desenhar = () => {
    const linhas = somenteAtivas ? painel.linhas.filter((l) => ehAtiva(l.chave)) : painel.linhas;
    // grupo aberto mostra todas as colunas; recolhido, só as fixadas (some se não tiver nenhuma)
    const visiveis = GRUPOS
      .map((g) => ({ ...g, colunas: g.colunas.filter((c) => abertos.has(g.id) || fixadas.has(c.chave)) }))
      .filter((g) => g.colunas.length);
    const atualizar = (fn) => () => { fn(); desenhar(); };
    const classeColuna = (c, i) => `${c.texto ? 'esq' : ''} ${i === 0 ? 'po-inicio' : ''}`;

    const segmentador = (g) => {
      const aberto = abertos.has(g.id);
      const nFixadas = g.colunas.filter((c) => fixadas.has(c.chave)).length;
      const acao = `${aberto ? 'Recolher' : 'Expandir'} ${g.titulo}`;
      return h('button', { type: 'button', class: 'po-grupo', 'aria-expanded': String(aberto), 'aria-label': acao, title: acao, onclick: atualizar(() => alternar(abertos, g.id)) },
        g.titulo, !aberto && nFixadas ? h('small', { title: `${nFixadas} coluna(s) fixada(s)` }, nFixadas) : null, icone(aberto ? 'recolher' : 'expandir', { tamanho: 13 }));
    };

    const alfinete = (c) => {
      const fixa = fixadas.has(c.chave);
      const acao = `${fixa ? 'Desafixar' : 'Fixar'} ${c.titulo} na tela inicial`;
      return h('button', { type: 'button', class: 'po-fixar', 'aria-pressed': String(fixa), 'aria-label': acao, title: acao,
        onclick: atualizar(() => { alternar(fixadas, c.chave); salvarFixadas(fixadas); }) }, icone('fixar', { tamanho: 13 }));
    };

    // Duas linhas de cabeçalho: o nome do grupo sobre as colunas visíveis dele e, embaixo, o título de cada coluna.
    const cabecalho = [
      h('tr', { class: 'po-grupos' },
        h('th', { class: 'first po-obra', rowspan: 2 }, 'Cliente · Obra'),
        visiveis.map((g) => h('th', { class: 'po-faixa po-inicio', colspan: g.colunas.length }, g.titulo)),
        h('th', { class: 'po-resto', rowspan: 2, 'aria-hidden': 'true' })), // ocupa a sobra quando há poucas colunas
      h('tr', {}, visiveis.map((g) => g.colunas.map((c, i) => h('th', { class: classeColuna(c, i) },
        c.titulo, c.sub ? h('small', {}, c.sub) : null, alfinete(c))))),
    ];

    const corpo = linhas.map((l) => h('tr', { class: l.temFechamento ? '' : 'po-sem-fechamento' },
      h('td', { class: 'first po-obra' },
        h('small', {}, l.cliente ?? 'Sem cliente'),
        h('a', { href: '#/obra/resumo-geral', title: `Abrir o Resumo Geral de ${l.obra}`, onclick: (e) => { e.preventDefault(); aoAbrirObra(l.chave); } }, l.obra)),
      visiveis.map((g) => g.colunas.map((c, i) => {
        const [principal, secundario = null] = c.v(l);
        return h('td', { class: `${classeColuna(c, i)} ${c.texto ? 'po-texto' : ''}` },
          h('span', { class: 'po-valor' }, principal), secundario !== null ? h('small', {}, secundario) : null, c.barra ? barra(c.barra(l)) : null);
      })),
      h('td', { class: 'po-resto', 'aria-hidden': 'true' })));

    montar(alvo,
      h('div', { class: 'po-topo' },
        h('div', {},
          h('div', { class: 'eyebrow' }, `Fechamento de ${fmtMes(painel.referencia)}`),
          h('h2', {}, 'Painel de obras', h('span', { class: 'po-contagem' }, `${linhas.length} obra${linhas.length === 1 ? '' : 's'}`)),
          h('p', {}, 'Clique na obra para abrir o Resumo Geral; expanda os grupos e use o alfinete para fixar colunas na tela inicial.')),
        h('div', { class: 'row' },
          h('div', { class: 'segmentos', role: 'group', 'aria-label': 'Obras exibidas' },
            h('button', { type: 'button', 'aria-pressed': String(somenteAtivas), onclick: atualizar(() => { somenteAtivas = true; }) }, 'Ativas'),
            h('button', { type: 'button', 'aria-pressed': String(!somenteAtivas), onclick: atualizar(() => { somenteAtivas = false; }) }, 'Todas do cadastro')),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: atualizar(() => GRUPOS.forEach((g) => abertos.add(g.id))) }, icone('expandir', { tamanho: 16 }), 'Expandir tudo'),
          h('button', { class: 'btn ghost sm', type: 'button', onclick: atualizar(() => abertos.clear()) }, icone('recolher', { tamanho: 16 }), 'Recolher tudo'))),
      h('div', { class: 'po-segmentadores', role: 'group', 'aria-label': 'Grupos de colunas' }, GRUPOS.map(segmentador)),
      h('div', { class: 'sheet painel-obras', 'data-teste': 'painel-obras' },
        h('table', {}, h('thead', {}, cabecalho), h('tbody', {}, corpo))));
  };

  desenhar();
  return alvo;
}
