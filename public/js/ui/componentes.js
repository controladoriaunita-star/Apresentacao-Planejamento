/**
 * Componentes básicos do padrão Unità, em funções que devolvem elementos.
 */
import { h, montar } from '../core/dom.js';
import { icone } from './icones.js';

export const card = (atributos, ...filhos) => h('section', { ...atributos, class: `card ${atributos?.class ?? ''}`.trim() }, ...filhos);

export function cardTitulo(titulo, extra = null) {
  return h('div', { class: 'card-titulo' }, h('h3', {}, titulo), extra);
}

export function kpi(rotulo, valor, { dica = null, classe = '', classeValor = '' } = {}) {
  return card({ class: `kpi ${classe}` }, h('p', { class: 'l' }, rotulo), h('p', { class: `v ${classeValor}` }, valor), dica ? h('p', { class: 'h' }, dica) : null);
}

export const badge = (texto, tipo = 'neutral') => h('span', { class: `badge b-${tipo}` }, texto);

export function alerta(tipo, titulo, texto = null) {
  return h('div', { class: `alert a-${tipo}`, role: tipo === 'error' ? 'alert' : 'status' }, h('b', {}, titulo), texto ? h('div', {}, texto) : null);
}

export function vazio(titulo, texto = null, acao = null) {
  return h('div', { class: 'vazio' },
    h('img', { src: 'assets/brand/symbol-un-orange.png', alt: '' }),
    h('h3', {}, titulo),
    texto ? h('p', {}, texto) : null,
    acao);
}

export function carregando(linhas = 4) {
  return h('div', { class: 'stack', 'aria-busy': 'true', 'aria-label': 'Carregando' },
    Array.from({ length: linhas }, (_, i) => h('div', { class: 'skel', style: { width: i % 3 === 0 ? '60%' : '100%' } })));
}

/** Indicador com ícone + texto (status nunca só por cor). */
export function status(valor, { positivoEhBom = true, texto } = {}) {
  if (typeof valor !== 'number' || valor === 0) return h('span', { class: 'status neutro' }, '■', texto ?? '');
  const bom = positivoEhBom ? valor > 0 : valor < 0;
  return h('span', { class: `status ${bom ? 'ok' : 'ruim'}`, title: bom ? 'Adiantado' : 'Atrasado' }, valor > 0 ? '▲' : '▼', texto ?? '');
}

/**
 * Marcador padrão de "este item tem comentário" — o mesmo no Resumo Físico e no Resumo Econômico.
 * @param {() => void} aoClicar  abre/mostra o comentário
 */
export function marcadorComentario(aoClicar, quantidade = 1) {
  return h('button', { class: 'btn-comentario', type: 'button', title: 'Ver comentário', onclick: aoClicar },
    icone('texto', { tamanho: 13 }), quantidade > 1 ? `${quantidade} comentários` : 'comentário');
}

// ── Toasts ───────────────────────────────────────────────────────────
let pilha;
export function toast(tipo, titulo, texto = null, ms = 4500) {
  pilha ??= document.body.appendChild(h('div', { class: 'toasts', 'aria-live': 'polite' }));
  const el = alerta(tipo, titulo, texto);
  pilha.append(el);
  setTimeout(() => el.remove(), ms);
}

// ── Modal ────────────────────────────────────────────────────────────
/**
 * Abre um modal e devolve {fechar}. `acoes` = botões do rodapé.
 * Fecha com Esc ou clique fora.
 */
export function abrirModal({ titulo, conteudo, acoes = [], largo = false, aoFechar = null }) {
  const anterior = document.activeElement;
  const fundo = h('div', { class: 'modal-fundo', role: 'presentation' });
  const caixa = card({ class: `modal ${largo ? 'largo' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    h('div', { class: 'corpo' }, h('h3', {}, titulo), conteudo),
    acoes.length ? h('div', { class: 'rodape' }, acoes) : null);
  fundo.append(caixa);
  const fechar = () => {
    fundo.remove();
    document.removeEventListener('keydown', teclado);
    anterior?.focus?.();
    aoFechar?.();
  };
  const teclado = (e) => { if (e.key === 'Escape') fechar(); };
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  document.addEventListener('keydown', teclado);
  document.body.append(fundo);
  (caixa.querySelector('input, select, textarea, button') ?? caixa).focus();
  return { fechar, caixa };
}

export function confirmar(titulo, texto, { rotulo = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    let resposta = false;
    const m = abrirModal({
      titulo,
      conteudo: h('p', { class: 'muted' }, texto),
      aoFechar: () => resolve(resposta),
      acoes: [
        h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
        h('button', { class: `btn ${perigo ? 'danger' : 'primary'}`, type: 'button', onclick: () => { resposta = true; m.fechar(); } }, rotulo),
      ],
    });
  });
}

/** Botão que mostra spinner enquanto a ação assíncrona roda. */
export function botaoAcao(rotulo, acao, classe = 'btn secondary') {
  const botao = h('button', { class: classe, type: 'button' }, rotulo);
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    montar(botao, h('span', { class: 'spin' }), rotulo);
    try {
      await acao();
    } finally {
      botao.disabled = false;
      montar(botao, rotulo);
    }
  });
  return botao;
}

/** Campo de formulário com rótulo. */
export function campo(rotulo, controle, ajuda = null) {
  return h('label', { class: 'field' }, h('span', {}, rotulo), controle, ajuda ? h('small', {}, ajuda) : null);
}
