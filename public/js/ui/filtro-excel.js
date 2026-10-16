/**
 * Filtro no estilo do AutoFiltro do Excel: botão com funil, painel com pesquisa, "(Selecionar tudo)",
 * itens agrupados (cliente, ano…) que recolhem/expandem e botões OK/Cancelar.
 *
 *   filtroExcel({
 *     rotulo: 'Obras', multiplo: true,
 *     itens: [{ valor: 'ipanema 212', rotulo: 'Ipanema 212', grupo: 'Pazza' }],
 *     selecionados: ['ipanema 212'],
 *     aoAplicar: (valores) => …,
 *   })
 *
 * Com `multiplo: false` funciona como lista de escolha única com pesquisa (aplica ao clicar).
 * `destaque: true` pinta o botão na cor da marca (usado no mês de competência).
 */
import { h, montar } from '../core/dom.js';
import { semAcento } from '../domain/normalizar.js';
import { icone } from './icones.js';

let abertoAgora = null; // só um painel aberto por vez

export function filtroExcel({ rotulo, itens, selecionados, multiplo = true, aoAplicar, resumo = null, testeId = null, largura = 300, destaque = false }) {
  const valoresIniciais = new Set(multiplo ? selecionados : [selecionados]);
  const todos = itens.map((i) => i.valor);
  const filtrando = multiplo && valoresIniciais.size < todos.length;

  const textoBotao = resumo ?? textoResumo(itens, valoresIniciais, multiplo);
  const botao = h('button', {
    type: 'button', class: `filtro-botao ${filtrando ? 'filtrando' : ''} ${destaque ? 'destaque' : ''}`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-teste': testeId,
  }, h('span', { class: 'filtro-textos' }, h('span', { class: 'filtro-rotulo' }, rotulo), h('span', { class: 'filtro-valor' }, textoBotao)), icone(filtrando ? 'funil' : 'seta', { tamanho: 16 }));

  const raiz = h('div', { class: 'filtro-excel' }, botao);
  let painel = null;

  const fechar = () => {
    painel?.remove();
    painel = null;
    botao.setAttribute('aria-expanded', 'false');
    document.removeEventListener('mousedown', cliqueFora);
    if (abertoAgora === fechar) abertoAgora = null;
  };
  const cliqueFora = (e) => { if (!raiz.contains(e.target)) fechar(); };

  botao.addEventListener('click', () => {
    if (painel) return fechar();
    abertoAgora?.();
    abertoAgora = fechar;
    painel = criarPainel({ itens, valoresIniciais, multiplo, largura, fechar, aplicar: (valores) => { fechar(); aoAplicar(multiplo ? valores : valores[0]); } });
    raiz.append(painel);
    botao.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', cliqueFora);
    painel.querySelector('input[type="search"]').focus();
  });
  return raiz;
}

function textoResumo(itens, selecionados, multiplo) {
  const escolhidos = itens.filter((i) => selecionados.has(i.valor));
  if (!multiplo) return escolhidos[0]?.rotulo ?? '—';
  if (escolhidos.length === itens.length) return 'Todas';
  if (escolhidos.length === 1) return escolhidos[0].rotulo;
  return escolhidos.length ? `${escolhidos.length} selecionadas` : 'Nenhuma';
}

function criarPainel({ itens, valoresIniciais, multiplo, largura, fechar, aplicar }) {
  const marcados = new Set(valoresIniciais);
  const recolhidos = new Set();
  let termo = '';
  const lista = h('div', { class: 'filtro-lista', role: 'listbox', 'aria-multiselectable': String(multiplo) });
  const rodape = h('div', { class: 'filtro-rodape' });
  // Como no Excel: com pesquisa ativa, o OK aplica só os resultados visíveis que estão marcados.
  const okBotao = h('button', {
    type: 'button', class: 'btn primary sm',
    onclick: () => aplicar((termo ? visiveis() : itens).filter((i) => marcados.has(i.valor)).map((i) => i.valor)),
  }, 'OK');

  const visiveis = () => itens.filter((i) => !termo || semAcento(`${i.rotulo} ${i.grupo ?? ''}`).includes(termo));

  const caixa = (estado, aoMudar, texto, extra = null) => {
    const input = h('input', { type: 'checkbox', checked: estado === true, onchange: aoMudar });
    input.indeterminate = estado === 'parcial';
    return h('label', { class: 'filtro-item' }, input, h('span', {}, texto), extra);
  };
  const estadoDe = (lista) => {
    const n = lista.filter((i) => marcados.has(i.valor)).length;
    return n === 0 ? false : n === lista.length ? true : 'parcial';
  };

  const desenhar = () => {
    const vis = visiveis();
    const grupos = new Map();
    for (const item of vis) {
      const g = item.grupo ?? '';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(item);
    }
    const linhas = [];
    if (multiplo && vis.length) {
      linhas.push(caixa(estadoDe(vis), (e) => { for (const i of vis) e.target.checked ? marcados.add(i.valor) : marcados.delete(i.valor); desenhar(); },
        termo ? '(Selecionar todos os resultados)' : '(Selecionar tudo)'));
    }
    for (const [grupo, membros] of grupos) {
      const fechado = recolhidos.has(grupo) && !termo;
      if (grupo) {
        const seta = h('button', {
          type: 'button', class: `filtro-seta ${fechado ? '' : 'aberta'}`, 'aria-label': fechado ? `Expandir ${grupo}` : `Recolher ${grupo}`,
          onclick: () => { fechado ? recolhidos.delete(grupo) : recolhidos.add(grupo); desenhar(); },
        }, icone('direita', { tamanho: 14 }));
        linhas.push(h('div', { class: 'filtro-grupo' }, seta, multiplo
          ? caixa(estadoDe(membros), (e) => { for (const i of membros) e.target.checked ? marcados.add(i.valor) : marcados.delete(i.valor); desenhar(); }, grupo, h('small', {}, membros.length))
          : h('span', { class: 'filtro-item' }, h('b', {}, grupo))));
      }
      if (fechado) continue;
      for (const item of membros) {
        linhas.push(multiplo
          ? h('div', { class: grupo ? 'recuo' : '' }, caixa(marcados.has(item.valor), (e) => { e.target.checked ? marcados.add(item.valor) : marcados.delete(item.valor); desenhar(); }, item.rotulo, item.detalhe ? h('small', {}, item.detalhe) : null))
          : h('button', {
            type: 'button', role: 'option', 'aria-selected': String(marcados.has(item.valor)),
            class: `filtro-opcao ${grupo ? 'recuo' : ''} ${marcados.has(item.valor) ? 'escolhida' : ''}`,
            onclick: () => aplicar([item.valor]),
          }, item.rotulo, marcados.has(item.valor) ? icone('check', { tamanho: 16 }) : null));
      }
    }
    montar(lista, linhas.length ? linhas : h('p', { class: 'muted small filtro-vazio' }, 'Nenhum resultado.'));
    okBotao.disabled = multiplo && !(termo ? visiveis() : itens).some((i) => marcados.has(i.valor));
    montar(rodape, multiplo ? [h('span', { class: 'muted small' }, `${marcados.size} de ${itens.length}`), h('button', { type: 'button', class: 'btn ghost sm', onclick: fechar }, 'Cancelar'), okBotao] : null);
    rodape.classList.toggle('oculto', !multiplo);
  };

  const busca = h('input', {
    type: 'search', placeholder: 'Pesquisar…', 'aria-label': 'Pesquisar',
    oninput: (e) => { termo = semAcento(e.target.value); desenhar(); },
    onkeydown: (e) => {
      if (e.key === 'Escape') fechar();
      if (e.key === 'Enter') {
        e.preventDefault();
        const vis = visiveis();
        if (!multiplo && vis.length) aplicar([vis[0].valor]);
        else if (multiplo && marcados.size) okBotao.click();
      }
    },
  });
  desenhar();
  return h('div', { class: 'filtro-painel', role: 'dialog', style: { width: `${largura}px` } },
    h('div', { class: 'filtro-busca' }, icone('busca', { tamanho: 16 }), busca),
    lista,
    rodape);
}
