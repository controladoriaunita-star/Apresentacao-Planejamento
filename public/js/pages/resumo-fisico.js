/**
 * Aba "Resumo Físico" — matriz por item da EAP, no formato da planilha "Resumo Físico" (aba Resumo Obra).
 */
import { h, montar } from '../core/dom.js';
import { classeSinal, fmtMes, fmtMoeda, fmtNumero, fmtPercentual, fmtVariacao, VAZIO } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { colunaOculta } from '../domain/colunas-ocultas.js';
import { COLUNAS_FISICO, GRUPOS_FISICO, nomeColuna } from '../domain/nomes-colunas.js';
import { calcularResumoFisico, itemPai } from '../domain/resumo-fisico.js';
import { podeRetirar, simularSemItens } from '../domain/simulacao-fisico.js';
import {
  abrirModal, alerta, carregando, marcadorComentario, seloCompetencia, status, vazio,
} from '../ui/componentes.js';
import { botaoColunasOcultas } from '../ui/editor-colunas-ocultas.js';
import { botaoNomesColunas } from '../ui/editor-nomes-colunas.js';
import { obraUnica } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';
import { painelSimulacao, rotuloLinhaSimulada } from '../ui/simulacao-fisico.js';

/** Itens pai expandidos, por obra (lembrados ao trocar de mês). Começa tudo recolhido, como a matriz do Power BI. */
const expandidos = new Map();

/** Simulação "sem atividades", por obra: ligada/desligada e itens retirados (lembrados ao trocar de mês). */
const simulacoes = new Map();

export async function renderResumoFisico(alvo, ctx) {
  const { base, filtro, visao } = ctx;
  const { obra, seletor } = obraUnica(base, () => renderResumoFisico(alvo, ctx), filtro);
  if (!obra) return montar(alvo, vazio('Selecione uma obra no filtro'));

  montar(alvo, cabecalho(obra, filtro.referencia, seletor),
    h('p', { class: 'carregando-msg' }, h('span', { class: 'spin' }), 'Carregando as atividades da obra no SharePoint…'),
    carregando(8));
  let fisico;
  try {
    fisico = await estado.fisicoDaObra(visao, obra.nome);
  } catch (e) {
    return montar(alvo, cabecalho(obra, filtro.referencia, seletor), alerta('error', 'Não foi possível carregar o físico por atividade', e.message));
  }
  const r = calcularResumoFisico(base, fisico, obra.chave, filtro.referencia);
  if (!r.linhas.length) {
    return montar(alvo, cabecalho(obra, filtro.referencia, seletor), vazio('Sem dados de atividades neste mês', `A planilha não tem linhas de ${fmtMes(filtro.referencia)} para esta obra.`));
  }
  if (!expandidos.has(obra.chave)) expandidos.set(obra.chave, new Set());
  const abertos = expandidos.get(obra.chave);
  const pais = new Set(r.linhas.filter((l) => l.nivel === 2).map((l) => itemPai(l.item)));
  if (!simulacoes.has(obra.chave)) simulacoes.set(obra.chave, { ativa: false, retirados: new Set() });
  const sim = simulacoes.get(obra.chave);
  const painel = h('div', { class: 'simulacao-area' });
  const atualizarSimulacao = () => {
    const simulacao = simularSemItens(r, sim.retirados);
    tab.mostrarSimulacao(simulacao);
    montar(painel, sim.ativa ? painelSimulacao(r.total, simulacao, limparSimulacao) : null);
  };
  const limparSimulacao = () => {
    sim.retirados.clear();
    tab.sincronizarRetirados();
    atualizarSimulacao();
  };
  const tab = tabela(r, { visao, abertos, pais, retirados: sim.retirados, aoRetirar: atualizarSimulacao });
  const planilha = h('div', { class: `sheet resumo-tabela colunas-iguais compacta ${lerExtras() ? '' : 'sem-extras'} ${sim.ativa ? 'simulando' : ''}` }, tab.elemento);
  const textoSimular = () => (sim.ativa ? 'Encerrar simulação' : 'Simular sem atividades');
  const botaoSimular = h('button', {
    class: `btn sm ${sim.ativa ? 'primary' : 'secondary'}`, type: 'button', 'aria-pressed': String(sim.ativa), 'data-teste': 'simular',
    onclick: () => {
      sim.ativa = !sim.ativa;
      planilha.classList.toggle('simulando', sim.ativa);
      botaoSimular.classList.toggle('primary', sim.ativa);
      botaoSimular.classList.toggle('secondary', !sim.ativa);
      botaoSimular.setAttribute('aria-pressed', String(sim.ativa));
      montar(botaoSimular, icone('funil', { tamanho: 16 }), textoSimular());
      atualizarSimulacao();
    },
  }, icone('funil', { tamanho: 16 }), textoSimular());
  atualizarSimulacao();
  const textoExtras = () => (planilha.classList.contains('sem-extras') ? 'Exibir projeção econômica' : 'Ocultar projeção econômica');
  const botaoExtras = h('button', {
    class: 'btn secondary sm', type: 'button', 'aria-pressed': String(!planilha.classList.contains('sem-extras')),
    onclick: () => {
      const ocultar = !planilha.classList.contains('sem-extras');
      planilha.classList.toggle('sem-extras', ocultar);
      guardarExtras(!ocultar);
      botaoExtras.setAttribute('aria-pressed', String(!ocultar));
      montar(botaoExtras, icone(ocultar ? 'expandir' : 'recolher', { tamanho: 16 }), textoExtras());
    },
  }, icone(lerExtras() ? 'recolher' : 'expandir', { tamanho: 16 }), textoExtras());
  montar(alvo,
    cabecalho(obra, filtro.referencia, seletor, h('div', { class: 'row' },
      botaoSimular,
      botaoExtras,
      botaoNomesColunas('fisico', () => renderResumoFisico(alvo, ctx)),
      botaoColunasOcultas('fisico', visao, () => renderResumoFisico(alvo, ctx)),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => tab.alternarTudo(true) }, icone('expandir', { tamanho: 16 }), 'Expandir tudo'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => tab.alternarTudo(false) }, icone('recolher', { tamanho: 16 }), 'Recolher tudo'))),
    painel,
    planilha);
}

/** Preferência "mostrar projeção econômica" (lembrada neste navegador). Os pesos ficam sempre visíveis (v28). */
const CHAVE_EXTRAS = 'resumoFisico.extras';
function lerExtras() {
  try { return localStorage.getItem(CHAVE_EXTRAS) !== 'ocultas'; } catch { return true; }
}
function guardarExtras(mostrar) {
  try { localStorage.setItem(CHAVE_EXTRAS, mostrar ? 'visiveis' : 'ocultas'); } catch { /* sem armazenamento */ }
}

function cabecalho(obra, referencia, seletor, acoes = null) {
  return h('div', { class: 'titulo-pagina' },
    h('div', { class: 'titulo-com-competencia' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Resumo físico'), h('h1', {}, obra.nome)),
      seloCompetencia(referencia)),
    h('div', { class: 'row' }, acoes, seletor));
}

const pct = (v) => fmtPercentual(v, 1);

/**
 * Matriz com itens pai recolhíveis. Recolher/expandir só mostra/esconde as linhas filhas (sem redesenhar,
 * para não perder a rolagem). Na simulação, cada item ganha uma caixa "retirar" e a linha simulada fica
 * logo abaixo da linha da obra (as duas só aparecem com a classe `simulando` na planilha).
 */
function tabela(r, { visao, abertos, pais, retirados, aoRetirar }) {
  // v29: títulos com os nomes definidos pelo Dev (domain/nomes-colunas.js); sem nome definido, o original.
  const nomes = estado.bruto?.nomesColunas;
  const titulo = (id) => nomeColuna(nomes, `fisico.coluna.${id}`, COLUNAS_FISICO.find((c) => c.id === id).titulo);
  const grupo = (id) => nomeColuna(nomes, `fisico.grupo.${id}`, GRUPOS_FISICO.find((g) => g.id === id).titulo);
  // Grupos da faixa de cima do cabeçalho, na ordem da tabela: título e classe (extra = projeção, cur = mês).
  const GRUPOS = {
    projecao: { titulo: grupo('projecao'), classe: 'extra' },
    referencia: { titulo: fmtMes(r.referencia), classe: 'cur' },
    seguinte: { titulo: fmtMes(r.seguinte), classe: '' },
    pesos: { titulo: grupo('pesos'), classe: '' },
  };
  const col = (id, grupoId, fn) => ({ id, grupo: grupoId, titulo: titulo(id), fn, classe: GRUPOS[grupoId].classe });
  const cols = [
    col('orcamento', 'projecao', (l) => fmtMoeda(l.orcamento)),
    col('orcamentoProjetado', 'projecao', (l) => fmtMoeda(l.economico?.orcamentoProjetado)),
    col('iec', 'projecao', (l) => (l.economico?.iec ? fmtNumero(l.economico.iec, 3) : VAZIO)),
    col('realizadoAcm', 'referencia', (l) => pct(l.realizadoAcm)),
    col('realizadoMes', 'referencia', (l) => pct(l.realizadoMes)),
    col('planejadoInicial', 'referencia', (l) => pct(l.planejadoInicial)),
    col('planejadoAcm', 'referencia', (l) => pct(l.planejadoAcm)),
    col('planejadoMes', 'referencia', (l) => pct(l.planejadoMes)),
    col('acerto', 'referencia', (l) => pct(l.acerto)),
    col('cronograma', 'referencia', (l) => pct(l.cronograma)),
    col('adiantamento', 'referencia', (l) => adiantamento(l.adiantamento)),
    col('proximoPlanejadoMes', 'seguinte', (l) => pct(l.proximo.planejadoMes)),
    col('proximoPlanejadoAcm', 'seguinte', (l) => pct(l.proximo.planejadoAcm)),
    col('proximoPrevisto', 'seguinte', (l) => pct(l.proximo.previsto)),
    col('proximoAdiantamento', 'seguinte', (l) => adiantamento(l.proximo.adiantamento)),
    col('pesoAtraso', 'pesos', (l) => (l.pesoAtraso === null ? VAZIO : fmtVariacao(l.pesoAtraso, 2))),
    col('pesoPlanejado', 'pesos', (l) => fmtPercentual(l.pesoPlanejado, 2)),
  // v34: no Cliente saem as colunas que o Dev ocultou (domain/colunas-ocultas.js) — vale para o PDF.
  ].filter((c) => !colunaOculta(estado.bruto?.colunasOcultas, visao, `fisico.${c.id}`));
  // Faixa de grupos: colunas visíveis consecutivas do mesmo grupo.
  const faixas = [];
  for (const c of cols) {
    if (faixas.at(-1)?.grupo === c.grupo) faixas.at(-1).span++;
    else faixas.push({ grupo: c.grupo, span: 1 });
  }
  const seta = (l) => {
    if (l.nivel !== 1) return null;
    if (!pais.has(l.item)) return h('span', { class: 'arvore-espaco' });
    const aberto = abertos.has(l.item);
    const botao = h('button', {
      class: `arvore-seta ${aberto ? 'aberta' : ''}`, type: 'button', 'aria-expanded': String(aberto), 'aria-label': `Expandir ou recolher ${l.descricao ?? l.item}`,
      dataset: { pai: l.item }, onclick: () => alternar(l.item, !abertos.has(l.item)),
    }, icone('direita', { tamanho: 14 }));
    return botao;
  };
  const caixaRetirar = (l) => {
    if (l.nivel === 0) return null;
    const permitido = podeRetirar(l);
    return h('input', {
      type: 'checkbox', class: 'retirar', checked: retirados.has(l.item), disabled: !permitido, dataset: { item: l.item },
      title: permitido ? 'Retirar da simulação' : 'Sem orçamento: não tem peso para retirar',
      'aria-label': `Retirar ${l.descricao ?? l.item} da simulação`,
      onchange: (e) => {
        e.target.checked ? retirados.add(l.item) : retirados.delete(l.item);
        e.target.closest('tr').classList.toggle('retirada', e.target.checked);
        aoRetirar();
      },
    });
  };
  const celulas = (l) => cols.map((c) => h('td', { class: c.classe }, l ? c.fn(l) : VAZIO));
  const linha = (l, classe) => {
    const atributos = { class: `${classe} ${retirados.has(l.item) ? 'retirada' : ''}`, dataset: l.nivel === 2 ? { filhoDe: itemPai(l.item) } : {} };
    return h('tr', atributos,
      h('td', { class: 'first' }, caixaRetirar(l), seta(l), h('span', { class: 'cod' }, l.item === 'Geral' ? '' : l.item), l.descricao ?? VAZIO,
        l.comentario && l.item !== 'Geral' ? marcadorComentario(() => verComentario(l)) : null),
      celulas(l));
  };
  const linhaSimulada = (simulacao) => h('tr', { class: 'simulada' },
    h('td', { class: 'first' }, rotuloLinhaSimulada(simulacao)),
    celulas(simulacao?.linha ?? null));

  const alternar = (pai, abrir) => {
    abrir ? abertos.add(pai) : abertos.delete(pai);
    for (const tr of corpo.querySelectorAll(`tr[data-filho-de="${CSS.escape(pai)}"]`)) tr.classList.toggle('oculto', !abrir);
    const botao = corpo.querySelector(`button[data-pai="${CSS.escape(pai)}"]`);
    botao?.classList.toggle('aberta', abrir);
    botao?.setAttribute('aria-expanded', String(abrir));
  };
  let trSimulada = r.total ? linhaSimulada(null) : null;
  const corpo = h('tbody', {},
    r.total ? linha(r.total, 'total') : null,
    trSimulada,
    r.linhas.map((l) => linha(l, `nivel-${l.nivel} ${l.nivel === 2 && !abertos.has(itemPai(l.item)) ? 'oculto' : ''}`)));

  // v28: número de colunas visíveis com e sem a projeção econômica (largura mínima da tabela, css/paginas.css).
  const extras = cols.filter((c) => c.classe === 'extra').length;
  const elemento = h('table', { style: `--colunas: ${cols.length}; --colunas-sem-extras: ${cols.length - extras}` },
    h('thead', {},
      h('tr', { class: 'grupo' },
        h('th', { class: 'first', rowspan: 2 }, 'Serviço'),
        faixas.map((f) => h('th', { colspan: f.span, class: GRUPOS[f.grupo].classe }, GRUPOS[f.grupo].titulo))),
      h('tr', {}, cols.map((c) => h('th', { class: c.classe }, c.titulo)))),
    corpo);
  return {
    elemento,
    alternarTudo: (abrir) => pais.forEach((p) => alternar(p, abrir)),
    mostrarSimulacao: (simulacao) => {
      if (!trSimulada) return;
      const nova = linhaSimulada(simulacao);
      trSimulada.replaceWith(nova);
      trSimulada = nova;
    },
    sincronizarRetirados: () => {
      for (const caixa of corpo.querySelectorAll('input.retirar')) {
        caixa.checked = retirados.has(caixa.dataset.item);
        caixa.closest('tr').classList.toggle('retirada', caixa.checked);
      }
    },
  };
}

function adiantamento(v) {
  if (typeof v !== 'number') return VAZIO;
  return h('span', { class: classeSinal(v) }, status(v, { texto: ` ${fmtVariacao(v, 1)}` }));
}

function verComentario(l) {
  const m = abrirModal({
    titulo: `${l.item} · ${l.descricao ?? ''}`,
    conteudo: h('p', { style: { whiteSpace: 'pre-wrap' } }, l.comentario),
    acoes: [h('button', { class: 'btn secondary', type: 'button', onclick: () => m.fechar() }, 'Fechar')],
  });
}
