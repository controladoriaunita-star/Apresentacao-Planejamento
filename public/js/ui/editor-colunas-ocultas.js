/**
 * v34 — "Colunas do cliente" (só o Dev, na apresentação Cliente) no Resumo Físico e no Resumo Econômico: uma
 * janela com as colunas da tabela para marcar as que ficam ocultas para o cliente, na tela e no PDF.
 * Na Obra continuam todas. Regras em domain/colunas-ocultas.js.
 */
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { OCULTAVEIS } from '../domain/colunas-ocultas.js';
import { nomeColuna } from '../domain/nomes-colunas.js';
import { pode } from '../domain/permissoes.js';
import { abrirModal, botaoAcao, toast } from './componentes.js';
import { icone } from './icones.js';

const TITULOS = { fisico: 'Resumo Físico', economico: 'Resumo Econômico' };

/** Botão que abre o editor: só para o Dev e só na apresentação Cliente. `aoSalvar` redesenha a página. */
export function botaoColunasOcultas(tabela, visao, aoSalvar) {
  if (visao !== 'cliente' || !pode(estado.usuario?.papel, 'administrar')) return null;
  return h('button', { class: 'btn ghost sm so-edicao', type: 'button', 'data-teste': 'colunas-ocultas', onclick: () => abrirEditor(tabela, aoSalvar) },
    icone('recolher', { tamanho: 16 }), 'Colunas do cliente');
}

function abrirEditor(tabela, aoSalvar) {
  const atuais = new Set(estado.bruto?.colunasOcultas ?? []);
  const nomes = estado.bruto?.nomesColunas;
  const itens = OCULTAVEIS.filter((o) => o.tabela === tabela);
  const caixas = new Map();
  const grupos = [...new Set(itens.map((o) => o.contexto))];
  const linha = (o) => {
    // Mostra o nome que o Dev deu à coluna (v29), se houver.
    const titulo = nomeColuna(nomes, `${tabela}.coluna.${o.chave.split('.')[1]}`, o.titulo);
    const caixa = h('input', { type: 'checkbox', checked: !atuais.has(o.chave), 'aria-label': `Mostrar ${titulo} (${o.contexto})` });
    caixas.set(o.chave, caixa);
    return h('label', { class: 'check' }, caixa, titulo);
  };
  const m = abrirModal({
    titulo: `Colunas do cliente — ${TITULOS[tabela]}`,
    conteudo: h('div', { class: 'stack' },
      h('p', { class: 'muted small' }, 'Desmarque as colunas que o cliente não deve ver. Vale para a apresentação Cliente e para o PDF; na Obra aparecem todas.'),
      grupos.map((g) => h('fieldset', { class: 'colunas-ocultas-grupo' },
        h('legend', {}, g),
        itens.filter((o) => o.contexto === g).map(linha)))),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar', async () => {
        if ([...caixas.values()].every((c) => !c.checked)) return toast('warning', 'Deixe ao menos uma coluna visível');
        // Mantém as escolhas da outra tabela; desta, vale o que está nas caixas.
        const ocultas = [...atuais].filter((chave) => !caixas.has(chave));
        for (const [chave, caixa] of caixas) if (!caixa.checked) ocultas.push(chave);
        try {
          const { ocultas: gravadas } = await api.put('/layouts/colunas-ocultas', { ocultas });
          if (estado.bruto) estado.bruto.colunasOcultas = gravadas;
          toast('success', 'Colunas do cliente salvas');
          m.fechar();
          aoSalvar();
        } catch (e) {
          toast('error', 'Não foi possível salvar as colunas', e.message);
        }
      }, 'btn primary'),
    ],
  });
}
