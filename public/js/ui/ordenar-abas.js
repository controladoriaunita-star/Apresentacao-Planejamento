/**
 * v28 — Reordenar as abas do menu superior arrastando (só com "Editar layout" ligado no Resumo Geral).
 * Cada link do menu precisa de `data-aba` (id da aba ou `tela-<id>`) e `data-natural` (posição na ordem padrão
 * do app, usada em "Restaurar padrão"). Enquanto edita, os links não navegam;
 * teclado: Alt + ← / → move a aba focada. A regra da ordem fica em domain/ordem-abas.js.
 */

/**
 * Liga a edição no menu. Devolve:
 * - `ordem()`: ids na ordem atual;
 * - `restaurar(ids)`: põe as abas na ordem dada (ex.: a original, ao cancelar);
 * - `restaurarPadrao()`: volta à ordem padrão do app;
 * - `terminar()`: desliga a edição (mantém a ordem em que as abas estão).
 * @param {HTMLElement} nav
 */
export function editarOrdemAbas(nav) {
  const links = () => [...nav.querySelectorAll(':scope > a[data-aba]')];
  const ordem = () => links().map((a) => a.dataset.aba);
  const restaurar = (ids) => {
    const porId = new Map(links().map((a) => [a.dataset.aba, a]));
    for (const id of ids) if (porId.has(id)) nav.append(porId.get(id));
  };
  const restaurarPadrao = () => restaurar(links().sort((a, b) => a.dataset.natural - b.dataset.natural).map((a) => a.dataset.aba));
  let arrastada = null;

  const naoNavegar = (e) => { if (e.target.closest('a[data-aba]')) e.preventDefault(); };
  const aoIniciar = (e) => {
    arrastada = e.target.closest('a[data-aba]');
    if (!arrastada) return;
    arrastada.classList.add('arrastando');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', arrastada.dataset.aba);
  };
  const aoPassar = (e) => {
    if (!arrastada) return;
    e.preventDefault();
    const alvo = e.target.closest('a[data-aba]');
    if (!alvo || alvo === arrastada) return;
    const caixa = alvo.getBoundingClientRect();
    alvo.before(arrastada);
    if (e.clientX > caixa.left + caixa.width / 2) alvo.after(arrastada);
  };
  const aoSoltar = (e) => { if (arrastada) e.preventDefault(); };
  const aoTerminarArrasto = () => {
    arrastada?.classList.remove('arrastando');
    arrastada = null;
  };
  const aoTeclar = (e) => {
    const link = e.target.closest('a[data-aba]');
    if (!link || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const vizinho = e.key === 'ArrowLeft' ? link.previousElementSibling : link.nextElementSibling;
    if (vizinho?.matches('a[data-aba]')) (e.key === 'ArrowLeft' ? vizinho.before(link) : vizinho.after(link));
    link.focus();
  };

  for (const a of links()) {
    a.draggable = true;
    a.title = 'Arraste para mudar a ordem (Alt + ← / →)';
  }
  nav.classList.add('ordenando');
  nav.addEventListener('click', naoNavegar);
  nav.addEventListener('dragstart', aoIniciar);
  nav.addEventListener('dragover', aoPassar);
  nav.addEventListener('drop', aoSoltar);
  nav.addEventListener('dragend', aoTerminarArrasto);
  nav.addEventListener('keydown', aoTeclar);

  const terminar = () => {
    aoTerminarArrasto();
    nav.classList.remove('ordenando');
    nav.removeEventListener('click', naoNavegar);
    nav.removeEventListener('dragstart', aoIniciar);
    nav.removeEventListener('dragover', aoPassar);
    nav.removeEventListener('drop', aoSoltar);
    nav.removeEventListener('dragend', aoTerminarArrasto);
    nav.removeEventListener('keydown', aoTeclar);
    for (const a of links()) {
      a.removeAttribute('draggable');
      a.removeAttribute('title');
    }
  };
  return { ordem, restaurar, restaurarPadrao, terminar };
}
