/**
 * Gera public/js/domain/tabelas-esocial.js a partir das abas "Tabela 13", "Tabela 14", "Tabela 15" e "Tabela 17"
 * da planilha SMS-IAT (listas suspensas da IAT: parte do corpo, agente causador, situação geradora e natureza da lesão).
 *
 *   node server/tools/gerar-tabelas-esocial.mjs "../IAT - Informativo do Acidente do Trabalho/SMS-IAT-REV09-INFORMATIVO DO ACIDENTE DO TRABALHO.xlsx"
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { RAIZ } from '../config.mjs';

const XLSX = createRequire(join(RAIZ, 'package.json'))('xlsx');
const arquivo = process.argv[2];
if (!arquivo) throw new Error('Informe o caminho da planilha SMS-IAT.');
const wb = XLSX.readFile(arquivo);

const tabela = (aba) => {
  const linhas = XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: null, raw: true });
  const titulo = linhas.flat().find((v) => typeof v === 'string' && /^TABELA/i.test(v));
  const itens = linhas
    .map((l) => [l[1], l[2]])
    .filter(([codigo, descricao]) => /^\d+$/.test(String(codigo ?? '').trim()) && String(descricao ?? '').trim())
    .map(([codigo, descricao]) => [String(codigo).trim(), String(descricao).replace(/\s+/g, ' ').trim()]);
  return { titulo, itens };
};

const tabelas = { 13: tabela('Tabela 13'), 14: tabela('Tabela 14'), 15: tabela('Tabela 15'), 17: tabela('Tabela 17') };
const linhas = [
  '/**',
  ' * Tabelas do eSocial usadas nas listas suspensas da IAT (gerado por server/tools/gerar-tabelas-esocial.mjs',
  ' * a partir da planilha SMS-IAT-REV09 — não editar à mão). Cada item: [código, descrição].',
  ' */',
  ...Object.entries(tabelas).flatMap(([n, t]) => [
    `/** ${t.titulo} (${t.itens.length} itens) */`,
    `export const TABELA_${n} = Object.freeze(${JSON.stringify(t.itens, null, 0).replace(/\],\[/g, '],\n  [').replace(/^\[\[/, '[\n  [').replace(/\]\]$/, '],\n]')});`,
  ]),
  '',
];
const destino = join(RAIZ, 'public', 'js', 'domain', 'tabelas-esocial.js');
writeFileSync(destino, linhas.join('\n'));
console.log(Object.entries(tabelas).map(([n, t]) => `Tabela ${n}: ${t.itens.length}`).join(' · '), '→', destino);
