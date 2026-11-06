/**
 * Telas extras das apresentações Obra e Cliente: imagens, planilhas (somente leitura) e textos
 * montados pelo Planejamento em Administração → Novas telas.
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { card, cardTitulo, vazio } from '../ui/componentes.js';
import { visualizarPlanilha } from '../ui/planilha.js';

const EYEBROW = { obra: 'Apresentação da obra', cliente: 'Apresentação ao cliente' };

export function renderTelaExtra(alvo, tela, visao) {
  if (!tela) return montar(alvo, vazio('Tela não encontrada', 'Ela pode ter sido removida ou não se aplica às obras filtradas.'));
  montar(alvo,
    h('div', { class: 'titulo-pagina' }, h('div', {}, h('div', { class: 'eyebrow' }, EYEBROW[visao]), h('h1', {}, tela.titulo), tela.subtitulo ? h('p', {}, tela.subtitulo) : null)),
    tela.blocos.length
      ? h('div', { class: 'blocos' }, tela.blocos.map((b) => card({ class: `card-pad ${b.largura === 'metade' ? '' : 'inteira'}` },
        b.titulo ? cardTitulo(b.titulo) : null,
        bloco(b))))
      : vazio('Tela sem conteúdo'));
}

function bloco(b) {
  if (b.tipo === 'imagem') return h('img', { src: api.urlArquivo(b.arquivoId), alt: b.titulo ?? '' });
  if (b.tipo === 'planilha') return visualizarPlanilha(b.arquivoId, b.aba);
  return h('p', { class: 'texto-livre' }, b.texto);
}
