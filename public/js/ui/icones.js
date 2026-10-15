/**
 * Ícones em SVG de traço (24×24, currentColor) — sem biblioteca externa.
 *   icone('funil')
 */
import { svg } from '../core/dom.js';

const CAMINHOS = {
  funil: ['M3 5h18l-7 8v6l-4 2v-8z'],
  busca: ['M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', 'M20 20l-4-4'],
  seta: ['M6 9l6 6l6-6'],
  direita: ['M9 6l6 6l-6 6'],
  enviar: ['M12 16V4', 'M7 9l5-5l5 5', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  imagem: ['M4 5h16v14H4z', 'M4 16l5-5l4 4l3-3l4 4', 'M15 9.5a1 1 0 1 0 0-.01'],
  planilha: ['M4 4h16v16H4z', 'M4 9h16', 'M4 14h16', 'M10 4v16'],
  texto: ['M5 6h14', 'M5 11h14', 'M5 16h9'],
  x: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 12l5 5l9-10'],
  expandir: ['M7 10l5 5l5-5', 'M7 5l5 5l5-5'],
  recolher: ['M7 14l5-5l5 5', 'M7 19l5-5l5 5'],
  telaCheia: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  sair: ['M15 12H4', 'M8 8l-4 4l4 4', 'M13 4h6v16h-6'],
  engrenagem: ['M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M4.9 19.1L7 17', 'M17 7l2.1-2.1'],
  atualizar: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 5v6h-6'],
  grafico: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
  fisico: ['M3 21h18', 'M5 21V8l7-5l7 5v13', 'M9 21v-6h6v6'],
  economico: ['M12 3v18', 'M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3s2.2 2.6 5 3.2s5 1.4 5 3.3s-2.2 3-5 3s-5-1.1-5-3'],
  caminho: ['M4 19h16', 'M4 19L9 5', 'M9 19l5-14', 'M14 19l5-14'],
  camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'M12 10.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6z'],
  casa: ['M4 11l8-7l8 7', 'M6 10v10h12V10'],
  calendario: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v5', 'M16 3v5'],
  pessoas: ['M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7z', 'M2.5 20c.8-3.4 3.3-5 6.5-5s5.7 1.6 6.5 5', 'M16 4.3a3.5 3.5 0 0 1 0 6.4', 'M18 15.2c1.8.7 3 2.3 3.5 4.8'],
  local: ['M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z', 'M12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z'],
  predio: ['M4 21V5l8-3v19', 'M12 9h8v12', 'M2 21h20', 'M7 8h2', 'M7 12h2', 'M7 16h2', 'M15 13h2', 'M15 17h2'],
  regua: ['M3 17L17 3l4 4L7 21z', 'M7 13l2 2', 'M10 10l2 2', 'M13 7l2 2'],
  relogio: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v5l3 2'],
};

export function icone(nome, { tamanho = 18, classe = 'ico' } = {}) {
  return svg('svg', {
    class: classe, width: tamanho, height: tamanho, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  }, (CAMINHOS[nome] ?? []).map((d) => svg('path', { d })));
}
