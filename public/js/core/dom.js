/**
 * Criação de elementos sem innerHTML: todo texto entra como textContent (sem risco de XSS com
 * comentários e nomes vindos das planilhas).
 *
 *   h('button', { class: 'btn primary', onclick: salvar }, 'Salvar')
 */
export function h(tag, atributos = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(atributos ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave.startsWith('on') && typeof valor === 'function') el.addEventListener(chave.slice(2), valor);
    else if (chave === 'class') el.className = valor;
    else if (chave === 'style' && typeof valor === 'object') Object.assign(el.style, valor);
    else if (chave === 'dataset') Object.assign(el.dataset, valor);
    else if (chave in el && typeof valor !== 'string') el[chave] = valor;
    else el.setAttribute(chave, valor === true ? '' : String(valor));
  }
  anexar(el, filhos);
  return el;
}

function anexar(el, filhos) {
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
}

/** Troca todo o conteúdo de um elemento. */
export function montar(alvo, ...filhos) {
  alvo.replaceChildren();
  anexar(alvo, filhos);
  return alvo;
}

/** SVG simples (ícones e velocímetro). */
export function svg(tag, atributos = {}, ...filhos) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [chave, valor] of Object.entries(atributos)) if (valor !== null && valor !== undefined) el.setAttribute(chave, String(valor));
  for (const filho of filhos.flat()) if (filho) el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  return el;
}

/** Lê uma variável CSS (tokens.css) — usada pelos gráficos. */
export const token = (nome) => getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
