/**
 * Administração → Fontes e INCC: de onde vêm os dados, quando foram lidos e a série do INCC-DI
 * (atualização pelo Banco Central e correção manual de um mês).
 */
import { api } from '../core/api.js';
import { h, montar } from '../core/dom.js';
import { fmtDataHora, fmtMes, fmtNumero } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { ABAS } from '../domain/colunas.js';
import { alerta, botaoAcao, campo, card, cardTitulo, carregando, toast } from '../ui/componentes.js';

export async function renderAdminFontes(alvo) {
  const desenhar = async () => {
    montar(alvo, carregando(4));
    const incc = await api.get('/incc');
    const bruto = estado.bruto;
    const ultimos = incc.itens.slice(-18).reverse();
    const mes = h('input', { type: 'month' });
    const indice = h('input', { inputmode: 'decimal', placeholder: 'Ex.: 1299,74' });
    montar(alvo,
      h('div', { class: 'titulo-pagina' }, h('div', {}, h('h1', {}, 'Fontes de dados e INCC'), h('p', {}, 'Planilhas do SharePoint lidas pelo Microsoft Graph e índice INCC-DI mês a mês.'))),
      bruto?.aviso ? alerta('warning', 'Atenção', bruto.aviso) : null,
      h('div', { class: 'rg-grade', style: { marginTop: '12px' } },
        card({ class: 'card-pad' }, cardTitulo('Planilhas'),
          h('dl', { class: 'lista-valores' },
            h('dt', {}, 'Origem'), h('dd', {}, bruto?.fonte ?? '—'),
            h('dt', {}, 'Lido em'), h('dd', {}, fmtDataHora(bruto?.atualizadoEm)),
            Object.values(ABAS).filter((a) => bruto?.abas?.[a]).map((a) => [h('dt', {}, a), h('dd', {}, `${fmtNumero(bruto.abas[a].linhas.length)} linhas`)]),
            h('dt', {}, 'Cadastros de obra'), h('dd', {}, fmtNumero(bruto?.cadastro?.length ?? 0))),
          h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'O BD_Físico por atividade é carregado por obra, ao abrir o Resumo Físico.')),
        card({ class: 'card-pad' }, cardTitulo('INCC-DI', h('span', { class: 'muted small' }, `atualizado em ${fmtDataHora(incc.atualizadoEm)}`)),
          h('div', { class: 'row', style: { marginBottom: '12px' } },
            botaoAcao('Buscar meses novos no Banco Central', async () => {
              try {
                const r = await api.post('/incc/atualizar');
                toast('success', r.novos ? `${r.novos} mês(es) novo(s)` : 'O INCC já estava atualizado');
                await estado.carregarDados();
              } catch (e) {
                toast('error', 'Falha na atualização', e.message, 8000);
              }
            })),
          h('div', { class: 'sheet', style: { maxHeight: '320px' } }, h('table', {},
            h('thead', {}, h('tr', {}, h('th', { class: 'first' }, 'Mês'), h('th', {}, 'Índice'), h('th', {}, 'Variação'), h('th', {}, 'Origem'))),
            h('tbody', {}, ultimos.map((i) => h('tr', {},
              h('td', { class: 'first' }, fmtMes(i.mes)), h('td', {}, fmtNumero(i.indice, 3)),
              h('td', {}, i.variacao === undefined ? '—' : `${fmtNumero(i.variacao, 2)}%`), h('td', { class: 'esq' }, i.origem)))))),
          h('p', { class: 'sub', style: { marginTop: '16px' } }, 'Corrigir um mês manualmente'),
          h('div', { class: 'row' }, campo('Mês', mes), campo('Índice', indice),
            botaoAcao('Salvar índice', async () => {
              try {
                await api.put(`/incc/${mes.value}`, { indice: Number(indice.value.replace(/\./g, '').replace(',', '.')) });
                toast('success', 'Índice salvo');
                await estado.carregarDados();
                desenhar();
              } catch (e) {
                toast('error', 'Não foi possível salvar', e.message);
              }
            })))));
  };
  await desenhar();
}
