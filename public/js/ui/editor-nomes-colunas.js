/**
 * v29 — "Nomes das colunas" (só o Dev) no Resumo Físico e no Resumo Econômico: uma janela com cada coluna e
 * grupo da tabela, o nome original e o nome atual. Campo vazio ou "Original" = volta ao nome original.
 * Salva para todas as apresentações (Obra, Cliente e PDF). Regras em domain/nomes-colunas.js.
 */
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { estado } from '../core/estado.js';
import { MAX_NOME, RENOMEAVEIS } from '../domain/nomes-colunas.js';
import { pode } from '../domain/permissoes.js';
import { abrirModal, botaoAcao, toast } from './componentes.js';
import { icone } from './icones.js';

const TITULOS = { fisico: 'Resumo Físico', economico: 'Resumo Econômico' };

/** Botão que abre o editor (null para quem não é Dev). `aoSalvar` redesenha a página com os nomes novos. */
export function botaoNomesColunas(tabela, aoSalvar) {
  if (!pode(estado.usuario?.papel, 'administrar')) return null;
  return h('button', { class: 'btn ghost sm so-edicao', type: 'button', 'data-teste': 'nomes-colunas', onclick: () => abrirEditorNomes(tabela, aoSalvar) },
    icone('texto', { tamanho: 16 }), 'Nomes das colunas');
}

function abrirEditorNomes(tabela, aoSalvar) {
  const atuais = estado.bruto?.nomesColunas ?? {};
  const itens = RENOMEAVEIS.filter((r) => r.tabela === tabela);
  const campos = new Map();
  const linha = (r) => {
    const entrada = h('input', { type: 'text', value: atuais[r.chave] ?? '', placeholder: r.original, maxlength: MAX_NOME, 'aria-label': `Novo nome para ${r.original} (${r.contexto})` });
    campos.set(r.chave, entrada);
    return h('div', { class: 'nomes-linha' },
      h('div', { class: 'nomes-original' }, h('b', {}, r.original), h('small', {}, r.tipo === 'grupo' ? 'Grupo' : r.contexto)),
      entrada,
      h('button', { class: 'btn ghost sm', type: 'button', title: 'Voltar ao nome original', onclick: () => { entrada.value = ''; entrada.focus(); } }, 'Original'));
  };
  const m = abrirModal({
    titulo: `Nomes das colunas — ${TITULOS[tabela]}`,
    largo: true,
    conteudo: h('div', { class: 'stack' },
      h('p', { class: 'muted small' }, 'Vale para as apresentações Obra e Cliente e para o PDF. Deixe em branco para usar o nome original.'
        + (tabela === 'economico' ? ' A unidade (R$) é acrescentada automaticamente às colunas em reais.' : '')),
      h('div', { class: 'nomes-lista' }, itens.map(linha))),
    acoes: [
      h('button', { class: 'btn ghost', type: 'button', onclick: () => m.fechar() }, 'Cancelar'),
      botaoAcao('Salvar para todas as apresentações', async () => {
        // Mantém os nomes da outra tabela; desta, vale o que está nos campos.
        const nomes = Object.fromEntries(Object.entries(atuais).filter(([chave]) => !campos.has(chave)));
        for (const [chave, entrada] of campos) if (entrada.value.trim()) nomes[chave] = entrada.value;
        try {
          const { nomes: gravados } = await api.put('/layouts/nomes-colunas', { nomes });
          if (estado.bruto) estado.bruto.nomesColunas = gravados;
          toast('success', 'Nomes das colunas salvos');
          m.fechar();
          aoSalvar();
        } catch (e) {
          toast('error', 'Não foi possível salvar os nomes', e.message);
        }
      }, 'btn primary'),
    ],
  });
}
