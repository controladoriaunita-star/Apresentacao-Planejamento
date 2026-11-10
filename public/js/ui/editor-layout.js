/**
 * Edição do layout do Resumo Geral (só o Dev), no estilo dos widgets da Apple: arrastar um quadro o move,
 * a alça no canto inferior direito o redimensiona, tudo encaixado na grade de 24 × 24 células. Um quadro
 * não pode cobrir outro (fica vermelho e volta ao soltar). Teclado: setas movem, Shift + setas redimensionam.
 * A regra da grade (limites, mínimos, sobreposição) fica em domain/layout-resumo.js.
 */
import { h } from '../core/dom.js';
import { ajustarRetangulo, GRADE, LAYOUT_PADRAO, QUADROS, sobrepoe } from '../domain/layout-resumo.js';
import { botaoAcao } from './componentes.js';

/** Posiciona cada quadro (`[data-quadro]`) da grade conforme o layout. */
export function aplicarLayout(corpo, layout) {
  for (const el of corpo.querySelectorAll(':scope > [data-quadro]')) {
    const r = layout[el.dataset.quadro];
    if (r) el.style.gridArea = `${r.y} / ${r.x} / span ${r.h} / span ${r.w}`;
  }
}

const copiar = (layout) => Object.fromEntries(Object.entries(layout).map(([id, r]) => [id, { ...r }]));
const colideComOutro = (layout, id, r) => QUADROS.some((q) => q.id !== id && sobrepoe(r, layout[q.id]));

/**
 * Liga o modo de edição na página. Devolve a barra de ações (Salvar / Restaurar padrão / Cancelar).
 * @param {{ pagina: HTMLElement, corpo: HTMLElement, layout: object, aoMudar: () => void,
 *           aoSalvar: (layout) => Promise<boolean>, aoTerminar: (layout) => void }} opcoes
 */
export function editarLayout({ pagina, corpo, layout: salvo, aoMudar, aoSalvar, aoTerminar }) {
  let layout = copiar(salvo);
  const quadros = [...corpo.querySelectorAll(':scope > [data-quadro]')];
  const nome = (id) => QUADROS.find((q) => q.id === id)?.nome ?? id;

  const extras = quadros.map((el) => {
    el.tabIndex = 0;
    el.setAttribute('aria-roledescription', 'quadro móvel');
    el.setAttribute('aria-label', `${nome(el.dataset.quadro)}: setas movem, Shift + setas redimensionam`);
    const rotulo = h('span', { class: 'rg-edicao-nome', 'aria-hidden': 'true' }, nome(el.dataset.quadro));
    const alca = h('span', { class: 'rg-alca', 'aria-hidden': 'true', title: 'Arraste para redimensionar' });
    el.append(rotulo, alca);
    return [rotulo, alca];
  });

  /** Tamanho de uma célula da grade em px (inclui o espaço entre os quadros). */
  const celula = () => {
    const caixa = corpo.getBoundingClientRect();
    const estilo = getComputedStyle(corpo);
    const gx = parseFloat(estilo.columnGap) || 0;
    const gy = parseFloat(estilo.rowGap) || 0;
    return { w: (caixa.width + gx) / GRADE.colunas, h: (caixa.height + gy) / GRADE.linhas };
  };

  /** Tenta aplicar `r` ao quadro: mostra ao vivo; `colide` indica que a posição é inválida. */
  const tentar = (el, r) => {
    const id = el.dataset.quadro;
    const ajustado = ajustarRetangulo(r, layout[id]);
    const colide = colideComOutro(layout, id, ajustado);
    el.style.gridArea = `${ajustado.y} / ${ajustado.x} / span ${ajustado.h} / span ${ajustado.w}`;
    el.classList.toggle('colide', colide);
    return { ajustado, colide };
  };

  const confirmar = (el, tentativa) => {
    const id = el.dataset.quadro;
    el.classList.remove('colide');
    if (!tentativa.colide) layout[id] = tentativa.ajustado;
    aplicarLayout(corpo, layout);
    aoMudar();
  };

  const aoApertar = (e) => {
    const el = e.target.closest('[data-quadro]');
    if (!el || e.button !== 0) return;
    e.preventDefault();
    const redimensionar = e.target.classList.contains('rg-alca');
    const origem = { ...layout[el.dataset.quadro] };
    const inicio = { x: e.clientX, y: e.clientY };
    const tam = celula();
    let tentativa = { ajustado: origem, colide: false };
    el.classList.add('arrastando');
    try { el.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
    const mover = (ev) => {
      const dx = Math.round((ev.clientX - inicio.x) / tam.w);
      const dy = Math.round((ev.clientY - inicio.y) / tam.h);
      tentativa = tentar(el, redimensionar ? { ...origem, w: origem.w + dx, h: origem.h + dy } : { ...origem, x: origem.x + dx, y: origem.y + dy });
    };
    const soltar = () => {
      el.removeEventListener('pointermove', mover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      el.classList.remove('arrastando');
      confirmar(el, tentativa);
    };
    el.addEventListener('pointermove', mover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  };

  const aoTeclar = (e) => {
    const el = e.target.closest('[data-quadro]');
    const passo = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!el || !passo) return;
    e.preventDefault();
    const r = layout[el.dataset.quadro];
    const [dx, dy] = passo;
    confirmar(el, tentar(el, e.shiftKey ? { ...r, w: r.w + dx, h: r.h + dy } : { ...r, x: r.x + dx, y: r.y + dy }));
  };

  pagina.classList.add('editando');
  corpo.style.setProperty('--grade-colunas', GRADE.colunas);
  corpo.style.setProperty('--grade-linhas', GRADE.linhas);
  corpo.addEventListener('pointerdown', aoApertar);
  corpo.addEventListener('keydown', aoTeclar);

  const terminar = (final) => {
    pagina.classList.remove('editando');
    corpo.removeEventListener('pointerdown', aoApertar);
    corpo.removeEventListener('keydown', aoTeclar);
    extras.flat().forEach((el) => el.remove());
    quadros.forEach((el) => { el.removeAttribute('tabindex'); el.removeAttribute('aria-roledescription'); el.removeAttribute('aria-label'); });
    aplicarLayout(corpo, final);
    aoMudar();
    aoTerminar(final);
  };

  return h('div', { class: 'row rg-edicao-acoes', role: 'toolbar', 'aria-label': 'Editar layout do Resumo Geral' },
    h('span', { class: 'muted small' }, 'Arraste para mover · alça no canto para redimensionar'),
    h('button', {
      class: 'btn ghost sm', type: 'button',
      onclick: () => { layout = copiar(LAYOUT_PADRAO); aplicarLayout(corpo, layout); aoMudar(); },
    }, 'Restaurar padrão'),
    h('button', { class: 'btn secondary sm', type: 'button', onclick: () => terminar(salvo) }, 'Cancelar'),
    botaoAcao('Salvar para todas as apresentações', async () => {
      if (await aoSalvar(layout)) terminar(layout); // falhou: continua editando (o aviso vem de aoSalvar)
    }, 'btn primary sm'));
}
