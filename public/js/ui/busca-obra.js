/**
 * Campo de obra com busca: o usuário digita parte do nome (ou do cliente) e escolhe na lista.
 * A lista fica no <body> com posição fixa para não ser cortada pela rolagem do modal.
 *
 * aoMudar({ id, invalido }): id da obra (null = sem associação); invalido = há texto que não é uma obra da lista.
 */
import { h, montar } from '../core/dom.js';
import { semAcento } from '../domain/normalizar.js';
import { filtrarObras } from '../domain/seguranca.js';

let contador = 0;

export function buscaObra({ cadastros, valor = null, rotulo, aoMudar }) {
  const nomeDe = (id) => cadastros.find((c) => c.id === id)?.obra ?? '';
  const idLista = `busca-obra-${++contador}`;
  let selecionado = valor;
  let itens = [];
  let ativo = -1;
  let aberta = false;

  const lista = h('ul', { id: idLista, class: 'busca-obra-lista', role: 'listbox', 'aria-label': `Obras para ${rotulo}` });
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
      maxHeight: `${Math.min(260, paraCima ? acima : abaixo)}px`,
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

  const escolher = (cadastro) => {
    selecionado = cadastro.id;
    entrada.value = cadastro.obra;
    entrada.removeAttribute('aria-invalid');
    aoMudar({ id: cadastro.id, invalido: false });
    fechar();
  };

  const abrir = () => {
    const texto = entrada.value.trim();
    // Com a obra já escolhida no campo, mostra todas para facilitar a troca.
    itens = filtrarObras(cadastros, texto === nomeDe(selecionado) ? '' : texto);
    ativo = itens.length === 1 ? 0 : -1;
    montar(lista, itens.length
      ? itens.map((c, i) => h('li', { id: `${idLista}-${i}`, role: 'option', 'aria-selected': 'false', onclick: () => escolher(c) },
        h('span', {}, c.obra), c.cliente ? h('small', {}, c.cliente) : null))
      : h('li', { class: 'vazio' }, 'Nenhuma obra encontrada'));
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
    const exata = texto ? cadastros.find((c) => semAcento(c.obra) === texto) : null;
    selecionado = exata?.id ?? null;
    entrada.removeAttribute('aria-invalid');
    aoMudar({ id: selecionado, invalido: Boolean(texto && !exata) });
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
    class: 'busca-obra',
    role: 'combobox',
    autocomplete: 'off',
    placeholder: 'Digite para buscar a obra…',
    value: nomeDe(valor),
    'aria-label': `Obra do cadastro para ${rotulo}`,
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
