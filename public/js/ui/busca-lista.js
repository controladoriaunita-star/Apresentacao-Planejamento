/**
 * Lista suspensa com busca (padrão do sistema): o usuário digita parte do texto e escolhe na lista.
 * Usada no de-para de obras e nas tabelas do eSocial da IAT. A lista fica no <body> com posição fixa para
 * não ser cortada pela rolagem do modal ou da página.
 *
 *   buscaLista({ opcoes: [{ valor, rotulo, detalhe? }], valor, rotulo, placeholder, aoMudar({ valor, invalido }) })
 * aoMudar: `valor` escolhido (null = vazio); `invalido` = há texto que não é uma opção da lista.
 */
import { h, montar } from '../core/dom.js';
import { semAcento } from '../domain/normalizar.js';

let contador = 0;

/** Todas as palavras precisam aparecer no rótulo ou no detalhe; quem começa com o texto vem primeiro. */
export function filtrarOpcoes(opcoes, texto) {
  const busca = semAcento(texto);
  const palavras = busca.split(' ').filter(Boolean);
  return opcoes
    .map((o, i) => ({ o, i, alvo: semAcento(`${o.rotulo} ${o.detalhe ?? ''}`) }))
    .filter(({ alvo }) => palavras.every((p) => alvo.includes(p)))
    .map(({ o, i }) => ({ o, i, inicio: busca && semAcento(o.rotulo).startsWith(busca) ? 0 : 1 }))
    .sort((a, b) => a.inicio - b.inicio || a.i - b.i)
    .map(({ o }) => o);
}

export function buscaLista({ opcoes, valor = null, rotulo, placeholder = 'Digite para buscar…', filtrar = filtrarOpcoes, aoMudar }) {
  const rotuloDe = (v) => opcoes.find((o) => o.valor === v)?.rotulo ?? '';
  const idLista = `busca-lista-${++contador}`;
  let selecionado = valor || null;
  let itens = [];
  let ativo = -1;
  let aberta = false;

  const lista = h('ul', { id: idLista, class: 'busca-lista-opcoes', role: 'listbox', 'aria-label': `Opções para ${rotulo}` });
  lista.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o foco no campo ao clicar na lista

  const posicionar = () => {
    if (!entrada.isConnected) return fechar();
    const r = entrada.getBoundingClientRect();
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    const paraCima = abaixo < 160 && acima > abaixo;
    Object.assign(lista.style, {
      left: `${r.left}px`,
      width: `${r.width}px`,
      maxHeight: `${Math.min(280, paraCima ? acima : abaixo)}px`,
      top: paraCima ? '' : `${r.bottom + 4}px`,
      bottom: paraCima ? `${window.innerHeight - r.top + 4}px` : '',
    });
    return undefined;
  };

  function fechar() {
    if (!aberta) return;
    aberta = false;
    ativo = -1;
    lista.remove();
    entrada.setAttribute('aria-expanded', 'false');
    entrada.removeAttribute('aria-activedescendant');
    window.removeEventListener('scroll', posicionar, true);
    window.removeEventListener('resize', posicionar);
  }

  const marcarAtivo = () => {
    [...lista.children].forEach((li, i) => {
      if (li.getAttribute('role') !== 'option') return;
      li.setAttribute('aria-selected', String(i === ativo));
      if (i === ativo) { li.scrollIntoView({ block: 'nearest' }); entrada.setAttribute('aria-activedescendant', li.id); }
    });
  };

  const escolher = (opcao) => {
    selecionado = opcao.valor;
    entrada.value = opcao.rotulo;
    entrada.removeAttribute('aria-invalid');
    aoMudar({ valor: opcao.valor, invalido: false });
    fechar();
  };

  const abrir = () => {
    const texto = entrada.value.trim();
    // Com uma opção já escolhida no campo, mostra todas para facilitar a troca.
    itens = filtrar(opcoes, texto === rotuloDe(selecionado) ? '' : texto);
    ativo = itens.length === 1 ? 0 : -1;
    montar(lista, itens.length
      ? itens.map((o, i) => h('li', { id: `${idLista}-${i}`, role: 'option', 'aria-selected': 'false', onclick: () => escolher(o) },
        h('span', {}, o.rotulo), o.detalhe ? h('small', {}, o.detalhe) : null))
      : h('li', { class: 'vazio' }, 'Nenhuma opção encontrada'));
    if (!aberta) {
      aberta = true;
      document.body.append(lista);
      entrada.setAttribute('aria-expanded', 'true');
      window.addEventListener('scroll', posicionar, true);
      window.addEventListener('resize', posicionar);
    }
    posicionar();
    marcarAtivo();
  };

  const aoDigitar = () => {
    const texto = semAcento(entrada.value);
    const exata = texto ? opcoes.find((o) => semAcento(o.rotulo) === texto) : null;
    selecionado = exata?.valor ?? null;
    entrada.removeAttribute('aria-invalid');
    aoMudar({ valor: selecionado, invalido: Boolean(texto && !exata) });
    abrir();
  };

  const aoTeclar = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!aberta) abrir();
      if (!itens.length) return;
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      ativo = ativo < 0 ? (passo > 0 ? 0 : itens.length - 1) : (ativo + passo + itens.length) % itens.length;
      marcarAtivo();
    } else if (e.key === 'Enter' && aberta) {
      e.preventDefault();
      if (itens[ativo]) escolher(itens[ativo]);
    } else if (e.key === 'Escape' && aberta) {
      e.stopPropagation(); // fecha só a lista, não o modal
      fechar();
    }
  };

  const aoSair = () => {
    fechar();
    if (entrada.value.trim() && !selecionado) entrada.setAttribute('aria-invalid', 'true');
  };

  const entrada = h('input', {
    type: 'text',
    class: 'busca-lista',
    role: 'combobox',
    autocomplete: 'off',
    placeholder,
    value: rotuloDe(selecionado),
    'aria-label': rotulo,
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': idLista,
    oninput: aoDigitar,
    onfocus: abrir,
    onkeydown: aoTeclar,
    onblur: aoSair,
  });
  return entrada;
}
