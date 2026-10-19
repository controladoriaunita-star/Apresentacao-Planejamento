/**
 * Visualizador de planilha somente leitura (telas do cliente) e leitura de planilhas para importação.
 * Usa SheetJS (public/vendor/xlsx.full.min.js), carregado só quando necessário.
 */
import { h, montar } from '../core/dom.js';
import { api } from '../core/api.js';
import { alerta } from './componentes.js';

let carregamento;
function carregarSheetJs() {
  carregamento ??= new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = 'vendor/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Não foi possível carregar o leitor de planilhas.'));
    document.head.append(s);
  });
  return carregamento;
}

/** Lê um ArrayBuffer/File → workbook. */
export async function lerPastaDeTrabalho(dados) {
  const XLSX = await carregarSheetJs();
  const buffer = dados instanceof Blob ? await dados.arrayBuffer() : dados;
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}

/**
 * Linhas de uma aba como objetos {cabeçalho: valor} — usado na importação do cadastro de obras.
 * `nomesAba`: abas preferidas, na ordem (senão, a primeira). O cabeçalho é a primeira linha com ao menos
 * três células preenchidas (o BD_Fixo começa na linha 2).
 */
export async function linhasComoObjetos(arquivo, nomesAba = []) {
  const XLSX = await carregarSheetJs();
  const wb = await lerPastaDeTrabalho(arquivo);
  const nome = [nomesAba].flat().find((n) => wb.SheetNames.includes(n)) ?? wb.SheetNames[0];
  const aba = wb.Sheets[nome];
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, defval: null, raw: true, blankrows: true });
  const linhaCabecalho = Math.max(0, matriz.findIndex((l) => l.filter((v) => v !== null && v !== '').length >= 3));
  const inicio = XLSX.utils.decode_range(aba['!ref']).s.r + linhaCabecalho;
  return XLSX.utils.sheet_to_json(aba, { defval: null, raw: true, range: inicio });
}

/**
 * Devolve na hora um elemento que é preenchido com a planilha de um arquivo enviado (com abas),
 * como tabela somente leitura.
 * Os valores aparecem formatados como no Excel (texto exibido da célula).
 */
export function visualizarPlanilha(arquivoId, abaPreferida = null) {
  const alvo = h('div', {}, h('div', { class: 'skel' }));
  preencherPlanilha(alvo, arquivoId, abaPreferida);
  return alvo;
}

async function preencherPlanilha(alvo, arquivoId, abaPreferida) {
  try {
    const XLSX = await carregarSheetJs();
    const wb = await lerPastaDeTrabalho(await api.baixarArquivo(arquivoId));
    const desenhar = (nome) => {
      const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, defval: '', blankrows: false });
      const largura = Math.max(0, ...linhas.map((l) => l.length));
      const abas = wb.SheetNames.length > 1
        ? h('div', { class: 'segmentos abas-planilha', role: 'group', 'aria-label': 'Abas da planilha' },
          wb.SheetNames.map((n) => h('button', { type: 'button', 'aria-pressed': String(n === nome), onclick: () => desenhar(n) }, n)))
        : null;
      montar(alvo, abas, linhas.length
        ? h('div', { class: 'sheet leitura', style: { maxHeight: '70vh' } }, h('table', {},
          h('thead', {}, h('tr', {}, Array.from({ length: largura }, (_, i) => h('th', {}, linhas[0][i] ?? '')))),
          h('tbody', {}, linhas.slice(1).map((l) => h('tr', {}, Array.from({ length: largura }, (_, i) => h('td', {}, l[i] ?? '')))))))
        : h('p', { class: 'muted' }, 'Aba vazia.'));
    };
    desenhar(abaPreferida && wb.SheetNames.includes(abaPreferida) ? abaPreferida : wb.SheetNames[0]);
  } catch (e) {
    montar(alvo, alerta('error', 'Não foi possível abrir a planilha', e.message));
  }
}
