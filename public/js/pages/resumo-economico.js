/**
 * Aba "Resumo Econômico" — página IEC do Power BI / planilha "Resumo Econômico" (aba IEC).
 * Mesma apresentação do Resumo Físico: cabeçalho com faixa de grupos, linha total com o nome da obra,
 * itens recolhíveis e o mesmo marcador de comentário. Cada item expande para 12 valores (3 × 4) e os
 * comentários (variações principais, variação do mês, contingências).
 */
import { h, montar } from '../core/dom.js';
import { classeSinal, fmtMes, fmtMoedaCompacta, fmtPorTipo } from '../core/formato.js';
import {
  COLUNAS_ECONOMICO, DETALHES_ECONOMICO, INDICADORES_ECONOMICO, calcularResumoEconomico,
} from '../domain/resumo-economico.js';
import { kpi, marcadorComentario, seloCompetencia, vazio } from '../ui/componentes.js';
import { obraUnica } from '../ui/filtros.js';
import { icone } from '../ui/icones.js';

/** Itens expandidos (lembrados ao trocar de mês/obra). */
const expandidos = new Set();

const valor = (linha, c) => h('span', { class: c.sinal ? classeSinal(linha[c.campo]) : '' }, fmtPorTipo(linha[c.campo] ?? null, c.tipo));

/** Faixas do cabeçalho: colunas consecutivas com o mesmo `grupo`. */
function faixas(colunas) {
  const lista = [];
  for (const c of colunas) {
    if (lista.at(-1)?.grupo === c.grupo) lista.at(-1).span++;
    else lista.push({ grupo: c.grupo, span: 1 });
  }
  return lista;
}

export function renderResumoEconomico(alvo, ctx) {
  const { base, filtro } = ctx;
  const { obra, seletor } = obraUnica(base, () => renderResumoEconomico(alvo, ctx));
  if (!obra) return montar(alvo, vazio('Selecione uma obra no filtro'));
  const r = calcularResumoEconomico(base, obra.chave, filtro.referencia);

  const linhasCorpo = new Map();
  const alternar = (item, abrir) => {
    abrir ? expandidos.add(item) : expandidos.delete(item);
    const { botao, detalhe } = linhasCorpo.get(item) ?? {};
    detalhe?.classList.toggle('oculto', !abrir);
    botao?.classList.toggle('aberta', abrir);
    botao?.setAttribute('aria-expanded', String(abrir));
  };

  const linhaItem = (l) => {
    const aberto = expandidos.has(l.item);
    const botao = h('button', {
      class: `arvore-seta ${aberto ? 'aberta' : ''}`, type: 'button', 'aria-expanded': String(aberto),
      'aria-label': `Detalhes de ${l.descricao ?? l.item}`, onclick: () => alternar(l.item, !expandidos.has(l.item)),
    }, icone('direita', { tamanho: 14 }));
    const detalhe = h('tr', { class: `detalhe ${aberto ? '' : 'oculto'}` }, h('td', { colspan: COLUNAS_ECONOMICO.length + 1 }, painelDetalhe(l)));
    linhasCorpo.set(l.item, { botao, detalhe });
    return [
      h('tr', { class: 'nivel-1' },
        h('td', { class: 'first' }, botao, h('span', { class: 'cod' }, l.item), l.descricao ?? '',
          l.comentarios.length ? marcadorComentario(() => alternar(l.item, true), l.comentarios.length) : null),
        COLUNAS_ECONOMICO.map((c) => h('td', {}, valor(l, c)))),
      detalhe,
    ];
  };

  const titulo = h('div', { class: 'titulo-pagina' },
    h('div', { class: 'titulo-com-competencia' },
      h('div', {}, h('div', { class: 'eyebrow' }, 'Resumo econômico'), h('h1', {}, obra.nome)),
      seloCompetencia(filtro.referencia)),
    h('div', { class: 'row' },
      r.linhas.length ? h('div', { class: 'row' },
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => r.linhas.forEach((l) => alternar(l.item, true)) }, icone('expandir', { tamanho: 16 }), 'Expandir tudo'),
        h('button', { class: 'btn ghost sm', type: 'button', onclick: () => r.linhas.forEach((l) => alternar(l.item, false)) }, icone('recolher', { tamanho: 16 }), 'Recolher tudo')) : null,
      seletor));

  if (!r.geral && !r.linhas.length) {
    const ultimo = r.mesesDisponiveis.at(-1);
    return montar(alvo, titulo, vazio('Sem fechamento econômico neste mês', ultimo ? `Último mês disponível: ${fmtMes(ultimo)}.` : 'A obra não tem dados no BD_Econômico.'));
  }

  // No topo (9 indicadores numa linha) os R$ saem compactos: a linha da obra na tabela traz os valores completos.
  const indicadores = (lista, compacto = false) => h('div', { class: `kpis kpis-${lista.length}` }, lista.map(([campo, rotulo, tipo]) => {
    const v = r.geral?.[campo] ?? null;
    const cartao = kpi(rotulo, compacto && tipo === 'moeda' ? fmtMoedaCompacta(v) : fmtPorTipo(v, tipo), {
      classeValor: campo.startsWith('resultado') || campo === 'variacaoMesCusto' ? classeSinal(v) : '',
    });
    cartao.title = `${rotulo}: ${fmtPorTipo(v, tipo)}`;
    return cartao;
  }));

  montar(alvo,
    titulo,
    indicadores(INDICADORES_ECONOMICO.topo, true),
    h('div', { class: 'sheet resumo-tabela', style: { margin: '16px 0' } }, h('table', {},
      h('thead', {},
        h('tr', { class: 'grupo' },
          h('th', { class: 'first', rowspan: 2 }, 'Item'),
          faixas(COLUNAS_ECONOMICO).map((f) => h('th', { colspan: f.span }, f.grupo))),
        h('tr', {}, COLUNAS_ECONOMICO.map((c) => h('th', {}, c.titulo)))),
      h('tbody', {},
        r.geral ? h('tr', { class: 'total' }, h('td', { class: 'first' }, h('span', { class: 'arvore-espaco' }), obra.nome), COLUNAS_ECONOMICO.map((c) => h('td', {}, valor(r.geral, c)))) : null,
        r.linhas.flatMap(linhaItem)))),
    // Rodapé congelado: fica sempre visível no pé da tela enquanto a página ou a tabela rolam.
    h('div', { class: 'rodape-fixo', 'data-teste': 'rodape-economico' }, indicadores(INDICADORES_ECONOMICO.rodape)));
}

/** Detalhe do item: 12 valores em 3 linhas de 4 caixas + comentários ao lado. */
function painelDetalhe(l) {
  return h('div', { class: 'detalhe-grade' },
    h('div', { class: 'detalhe-blocos' }, DETALHES_ECONOMICO.map((grupo) => h('div', { class: 'detalhe-linha' },
      h('p', { class: 'sub' }, grupo.titulo),
      h('dl', { class: 'detalhe-valores' }, grupo.campos.map((c) => h('div', {}, h('dt', {}, c.titulo), h('dd', {}, valor(l, c)))))))),
    h('div', { class: 'detalhe-comentarios' },
      h('p', { class: 'sub' }, 'Comentários'),
      l.comentarios.length
        ? l.comentarios.map(([titulo, texto]) => h('div', { class: 'comentario-caixa' }, h('b', {}, titulo), h('p', {}, texto)))
        : h('p', { class: 'muted small' }, 'Sem comentários para este item no mês.')));
}
