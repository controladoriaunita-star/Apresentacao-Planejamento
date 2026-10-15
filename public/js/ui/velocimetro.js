/**
 * Velocímetro "Andamento geral": avanço físico acumulado dentro de 0–100%. SVG puro.
 */
import { h, svg } from '../core/dom.js';
import { fmtPercentual } from '../core/formato.js';

const RAIO = 80;
const CX = 100;
const CY = 100;

function pontoNoArco(fracao) {
  const angulo = Math.PI * (1 - fracao); // 180° (esquerda) → 0° (direita)
  return [CX + RAIO * Math.cos(angulo), CY - RAIO * Math.sin(angulo)];
}

function arco(de, ate) {
  const [x1, y1] = pontoNoArco(de);
  const [x2, y2] = pontoNoArco(ate);
  return `M ${x1} ${y1} A ${RAIO} ${RAIO} 0 0 1 ${x2} ${y2}`;
}

export function velocimetro(valor) {
  const fracao = Math.max(0, Math.min(1, typeof valor === 'number' ? valor : 0));
  const [px, py] = pontoNoArco(fracao);
  return h('div', { class: 'velocimetro' },
    svg('svg', { viewBox: '0 0 200 120', role: 'img', 'aria-label': `Andamento geral ${fmtPercentual(valor)}` },
      svg('path', { d: arco(0, 1), fill: 'none', stroke: 'var(--ink-200)', 'stroke-width': 16, 'stroke-linecap': 'round' }),
      fracao > 0 ? svg('path', { d: arco(0, fracao), fill: 'none', stroke: 'var(--color-primary)', 'stroke-width': 16, 'stroke-linecap': 'round' }) : null,
      svg('circle', { cx: px, cy: py, r: 6, fill: 'var(--color-secondary)', stroke: 'var(--surface)', 'stroke-width': 2 }),
      svg('text', { x: CX, y: CY - 8, 'text-anchor': 'middle', 'font-family': 'Sora, Inter, sans-serif', 'font-size': 24, 'font-weight': 600, fill: 'var(--text)' }, fmtPercentual(valor, 1)),
      svg('text', { x: 20, y: 116, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, '0%'),
      svg('text', { x: 180, y: 116, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, '100%')));
}
