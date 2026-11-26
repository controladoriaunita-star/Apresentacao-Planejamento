/**
 * Carga do modo demonstração para a Segurança do Trabalho, lida da planilha de exemplo
 * "Controle de Acidentes-Dashboard.xlsx" (aba Dados) — a mesma usada como referência do módulo (v22).
 *
 * - Cadastro de obras: uma obra por "Nome da Obra", com Cliente = Incorporação e Sistema estrutural = Método
 *   Construtivo da planilha (o valor mais frequente, se houver mais de um).
 * - Acidentes: TODAS as linhas da aba Dados, para os números do app baterem com o Dashboard-01/02 do Excel.
 *   As linhas válidas passam pela mesma análise da importação (`analisarImportacao`); as incompletas
 *   (sem resumo, parte do corpo ou dias — a importação recusa) entram com os campos vazios como na planilha.
 * - Determinística: mesma planilha → mesmos ids (derivados do conteúdo) e mesmos registros.
 *
 * A planilha fica fora do git (*.xlsx no .gitignore), na pasta "Dados" ao lado do projeto:
 * ../Dados/Controle de Acidentes-Dashboard.xlsx (ou o caminho passado em `planilha`).
 *
 * Gravar em data/exemplo: `npm run exemplo:carga` (server/tools/carga-exemplo.mjs).
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarCadastro } from '../../public/js/domain/cadastro-obra.js';
import { chaveObra, dataIso } from '../../public/js/domain/normalizar.js';
import {
  analisarImportacao, chaveDeduplicacao, diasValidos, entradaDeLinha, faseObraPadrao, linhaVazia, parteCorpoPadrao, siglaTipo,
} from '../../public/js/domain/seguranca.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PLANILHA_PADRAO = resolve(RAIZ, '..', 'Dados', 'Controle de Acidentes-Dashboard.xlsx');
const CRIADO_EM = '2026-04-01T12:00:00.000Z';
const HOJE = '2099-12-31'; // a planilha é histórica: nenhuma linha é recusada por data "futura"

const limpar = (v) => (v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim());

/** UUID estável a partir de um texto (mesmo texto → mesmo id). */
function idEstavel(texto) {
  const h = createHash('sha1').update(texto).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const maisFrequente = (contagem) => [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

/** Linhas da aba Dados como objetos {cabeçalho: valor} — mesmo critério de `linhasComoObjetos` do navegador. */
export function lerLinhasDaPlanilha(caminho = PLANILHA_PADRAO) {
  if (!existsSync(caminho)) throw new Error(`Planilha de exemplo não encontrada: ${caminho}`);
  const XLSX = createRequire(join(RAIZ, 'package.json'))('xlsx');
  const wb = XLSX.readFile(caminho, { cellDates: true });
  const aba = wb.Sheets.Dados ?? wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, defval: null, raw: true, blankrows: true });
  const linhaCabecalho = Math.max(0, matriz.findIndex((l) => l.filter((v) => v !== null && v !== '').length >= 3));
  const inicio = XLSX.utils.decode_range(aba['!ref']).s.r + linhaCabecalho;
  return XLSX.utils.sheet_to_json(aba, { defval: null, raw: true, range: inicio })
    .map((linha, i) => ({ ...linha, __linha: inicio + i + 2 }));
}

/**
 * @param {{planilha?: string, linhas?: object[]}} opcoes  caminho da planilha ou linhas já lidas (testes)
 * @returns {{cadastros: object[], acidentes: object[], incompletos: Array<{linha: number, erros: string[]}>}}
 */
export function gerarCargaSeguranca({ planilha = PLANILHA_PADRAO, linhas = lerLinhasDaPlanilha(planilha) } = {}) {
  const entradas = linhas.map((l) => ({ linha: l.__linha, entrada: entradaDeLinha(l) })).filter((x) => !linhaVazia(x.entrada));

  // Cadastro de obras: uma por nome, na ordem em que aparecem na planilha.
  const obras = new Map();
  for (const { entrada } of entradas) {
    const chave = chaveObra(entrada.obra);
    if (!chave) continue;
    const o = obras.get(chave) ?? { obra: limpar(entrada.obra), clientes: new Map(), metodos: new Map() };
    for (const [campo, mapa] of [['incorporador', o.clientes], ['metodoConstrutivo', o.metodos]]) {
      const v = limpar(entrada[campo]);
      if (v) mapa.set(v, (mapa.get(v) ?? 0) + 1);
    }
    obras.set(chave, o);
  }
  const cadastros = [...obras.values()].map((o) => ({
    id: idEstavel(`cadastro|${chaveObra(o.obra)}`),
    criadoEm: CRIADO_EM,
    atualizadoEm: CRIADO_EM,
    ...normalizarCadastro({ obra: o.obra, cliente: maisFrequente(o.clientes), sistemaEstrutural: maisFrequente(o.metodos) }),
    atualizadoPor: 'carga-exemplo',
  }));

  // Acidentes: análise da importação; linhas recusadas entram como estão na planilha.
  const analise = analisarImportacao(linhas, cadastros, new Map(), { hoje: HOJE });
  const porLinha = new Map(entradas.map((x) => [x.linha, x.entrada]));
  const acidentes = [];
  const incompletos = [];
  for (const r of analise.linhas) {
    let acidente = r.acidente;
    if (!acidente) {
      const e = porLinha.get(r.linha) ?? {};
      if (!r.obraId || !dataIso(e.data) || !siglaTipo(e.tipo)) throw new Error(`Linha ${r.linha} da planilha sem obra, data ou tipo: ${r.erros.join(' ')}`);
      acidente = {
        data: dataIso(e.data),
        obraId: r.obraId,
        faseObra: faseObraPadrao(e.faseObra),
        nomeAcidentado: limpar(e.nomeAcidentado),
        funcao: limpar(e.funcao),
        empresa: limpar(e.empresa),
        tipo: siglaTipo(e.tipo),
        parteCorpo: parteCorpoPadrao(e.parteCorpo),
        diasAfastamento: diasValidos(e.diasAfastamento),
        resumo: String(e.resumo ?? '').trim(),
      };
      acidente.chaveDedup = chaveDeduplicacao(acidente);
      incompletos.push({ linha: r.linha, erros: r.erros });
    }
    // Mesma chave de deduplicação na planilha (linha repetida): a 2ª ganha o nº da linha para não sumir da contagem.
    if (acidentes.some((a) => a.chaveDedup === acidente.chaveDedup)) acidente = { ...acidente, chaveDedup: `${acidente.chaveDedup}|linha ${r.linha}` };
    acidentes.push({ id: idEstavel(`acidente|${acidente.chaveDedup}`), criadoEm: CRIADO_EM, ...acidente, origem: 'importacao', criadoPor: 'carga-exemplo' });
  }
  acidentes.sort((a, b) => a.data.localeCompare(b.data));
  return { cadastros, acidentes, incompletos };
}
