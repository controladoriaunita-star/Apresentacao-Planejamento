/**
 * Aba "Resumo Físico" — matriz por item da EAP, no formato da planilha "Resumo Físico" (aba Resumo Obra).
 */
import { h, montar } from '../core/dom.js';
import { classeSinal, fmtMes, fmtMoeda, fmtNumero, fmtPercentual, fmtVariacao, VAZIO } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { calcularResumoFisico, itemPai } from '../domain/resumo-fisico.js';
import { abrirModal, alerta, card, cardTitulo, carregando, marcadorComentario, status, vazio } from '../ui/componentes.js';
import { obraUnica } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';

/** Itens pai expandidos, por obra (lembrados ao trocar de mês). Começa tudo recolhido, como a matriz do Power BI. */
const expandidos = new Map();

export async function renderResumoFisico(alvo, ctx) {
  const { base, filtro, visao } = ctx;
  const { obra, seletor } = obraUnica(base, () => renderResumoFisico(alvo, ctx));
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
  const tab = tabela(r, { abertos, pais });
  const planilha = h('div', { class: `sheet resumo-tabela ${lerExtras() ? '' : 'sem-extras'}` }, tab.elemento);
  const textoExtras = () => (planilha.classList.contains('sem-extras') ? 'Exibir projeção econômica e pesos' : 'Ocultar projeção econômica e pesos');
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
      botaoExtras,
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => tab.alternarTudo(true) }, icone('expandir', { tamanho: 16 }), 'Expandir tudo'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => tab.alternarTudo(false) }, icone('recolher', { tamanho: 16 }), 'Recolher tudo'))),
    comentariosGerais(r.total),
    planilha);
}

/** Preferência "mostrar projeção econômica e pesos" (lembrada neste navegador). */
const CHAVE_EXTRAS = 'resumoFisico.extras';
function lerExtras() {
  try { return localStorage.getItem(CHAVE_EXTRAS) !== 'ocultas'; } catch { return true; }
}
function guardarExtras(mostrar) {
  try { localStorage.setItem(CHAVE_EXTRAS, mostrar ? 'visiveis' : 'ocultas'); } catch { /* sem armazenamento */ }
}

function cabecalho(obra, referencia, seletor, acoes = null) {
  return h('div', { class: 'titulo-pagina' },
    h('div', {}, h('div', { class: 'eyebrow' }, `Resumo físico · ${fmtMes(referencia)}`), h('h1', {}, obra.nome)),
    h('div', { class: 'row' }, acoes, seletor));
}

function comentariosGerais(total) {
  const blocos = [['Comentário do mês', total?.comentario], ['Principais metas', total?.principaisMetas]].filter(([, t]) => t);
  if (!blocos.length) return null;
  return h('div', { class: 'comentarios' }, blocos.map(([titulo, texto]) => card({ class: 'card-pad' }, cardTitulo(titulo), h('p', {}, texto))));
}

const pct = (v) => fmtPercentual(v, 1);

/**
 * Matriz com itens pai recolhíveis. Recolher/expandir só mostra/esconde as linhas filhas (sem redesenhar,
 * para não perder a rolagem).
 */
function tabela(r, { abertos, pais }) {
  const cols = [
    ['Orçamento', (l) => fmtMoeda(l.orcamento), 'extra'],
    ['Orç. projetado', (l) => fmtMoeda(l.economico?.orcamentoProjetado), 'extra'],
    ['IEC', (l) => (l.economico?.iec ? fmtNumero(l.economico.iec, 3) : VAZIO), 'extra'],
    ['Realizado acm', (l) => pct(l.realizadoAcm), 'cur'],
    ['Realizado mês', (l) => pct(l.realizadoMes), 'cur'],
    ['Planejado inicial', (l) => pct(l.planejadoInicial), 'cur'],
    ['Planejado acm', (l) => pct(l.planejadoAcm), 'cur'],
    ['Planejado mês', (l) => pct(l.planejadoMes), 'cur'],
    ['% acerto', (l) => pct(l.acerto), 'cur'],
    ['Cronograma', (l) => pct(l.cronograma), 'cur'],
    ['Adiant.', (l) => adiantamento(l.adiantamento), 'cur'],
    ['Planejado mês', (l) => pct(l.proximo.planejadoMes)],
    ['Planejado acm', (l) => pct(l.proximo.planejadoAcm)],
    ['Previsto', (l) => pct(l.proximo.previsto)],
    ['Adiant.', (l) => adiantamento(l.proximo.adiantamento)],
    ['Peso atraso', (l) => (l.pesoAtraso === null ? VAZIO : fmtVariacao(l.pesoAtraso, 2)), 'extra'],
    ['Peso planejado', (l) => fmtPercentual(l.pesoPlanejado, 2), 'extra'],
  ];
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
  const linha = (l, classe) => h('tr', { class: classe, dataset: l.nivel === 2 ? { filhoDe: itemPai(l.item) } : {} },
    h('td', { class: 'first' }, seta(l), h('span', { class: 'cod' }, l.item === 'Geral' ? '' : l.item), l.descricao ?? VAZIO,
      l.comentario && l.item !== 'Geral' ? marcadorComentario(() => verComentario(l)) : null),
    cols.map(([, fn, classeCol]) => h('td', { class: classeCol ?? '' }, fn(l))));

  const alternar = (pai, abrir) => {
    abrir ? abertos.add(pai) : abertos.delete(pai);
    for (const tr of corpo.querySelectorAll(`tr[data-filho-de="${CSS.escape(pai)}"]`)) tr.classList.toggle('oculto', !abrir);
    const botao = corpo.querySelector(`button[data-pai="${CSS.escape(pai)}"]`);
    botao?.classList.toggle('aberta', abrir);
    botao?.setAttribute('aria-expanded', String(abrir));
  };
  const corpo = h('tbody', {},
    r.total ? linha(r.total, 'total') : null,
    r.linhas.map((l) => linha(l, `nivel-${l.nivel} ${l.nivel === 2 && !abertos.has(itemPai(l.item)) ? 'oculto' : ''}`)));

  const elemento = h('table', {},
    h('thead', {},
      h('tr', { class: 'grupo' },
        h('th', { class: 'first', rowspan: 2 }, 'Serviço'),
        h('th', { colspan: 3, class: 'extra' }, 'Projeção econômica'),
        h('th', { colspan: 8, class: 'cur' }, fmtMes(r.referencia)),
        h('th', { colspan: 4 }, fmtMes(r.seguinte)),
        h('th', { colspan: 2, class: 'extra' }, 'Pesos')),
      h('tr', {}, cols.map(([titulo, , classe]) => h('th', { class: classe ?? '' }, titulo)))),
    corpo);
  return { elemento, alternarTudo: (abrir) => pais.forEach((p) => alternar(p, abrir)) };
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
