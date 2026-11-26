/**
 * Grava em data/exemplo a carga do modo demonstração lida da planilha de exemplo
 * "Controle de Acidentes-Dashboard.xlsx" (tests/fixtures/seguranca-exemplo.mjs):
 * cadastro-obras.json (obras da planilha) e acidentes.json (todas as linhas da aba Dados).
 *
 *   npm run exemplo:carga                    recria a carga; o que já existia vai para data/exemplo/backup-<data-hora>/
 *   npm run exemplo:carga -- --planilha X    usa outra cópia da planilha (padrão: ../Dados/Controle de Acidentes-Dashboard.xlsx)
 *   node ... --se-vazio                      só grava se ainda não houver cadastro nem acidentes (usado por `npm run exemplo`)
 *
 * Sempre escreve em data/exemplo (nunca na pasta de dados reais), de propósito sem ler .env.local.
 * Usuários e arquivos enviados não são tocados.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { RAIZ } from '../config.mjs';
import { gerarCargaSeguranca, PLANILHA_PADRAO } from '../../tests/fixtures/seguranca-exemplo.mjs';

const PASTA = join(RAIZ, 'data', 'exemplo');
const ARQUIVOS = { cadastros: 'cadastro-obras.json', acidentes: 'acidentes.json' };
const argPlanilha = process.argv.indexOf('--planilha');
const planilha = argPlanilha > 0 ? resolve(process.argv[argPlanilha + 1]) : PLANILHA_PADRAO;
const seVazio = process.argv.includes('--se-vazio');

const temConteudo = (nome) => {
  const caminho = join(PASTA, nome);
  if (!existsSync(caminho)) return false;
  try {
    const dados = JSON.parse(readFileSync(caminho, 'utf8'));
    return Array.isArray(dados) && dados.length > 0;
  } catch {
    return true; // arquivo ilegível: trata como existente para não sobrescrever sem backup
  }
};

const existentes = Object.values(ARQUIVOS).filter(temConteudo);
if (seVazio && existentes.length) {
  console.log('[carga-exemplo] data/exemplo já tem dados — mantidos (npm run exemplo:carga recria a carga).');
  process.exit(0);
}
if (!existsSync(planilha)) {
  console.warn(`[carga-exemplo] planilha não encontrada: ${planilha}`);
  process.exit(seVazio ? 0 : 1); // na abertura da demonstração, segue sem a carga
}

const { cadastros, acidentes, incompletos } = gerarCargaSeguranca({ planilha });

mkdirSync(PASTA, { recursive: true });
if (existentes.length) {
  const carimbo = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const backup = join(PASTA, `backup-${carimbo}`);
  mkdirSync(backup, { recursive: true });
  for (const nome of existentes) copyFileSync(join(PASTA, nome), join(backup, nome));
  console.log(`[carga-exemplo] dados anteriores copiados para data/exemplo/backup-${carimbo}/`);
}

writeFileSync(join(PASTA, ARQUIVOS.cadastros), JSON.stringify(cadastros, null, 2));
writeFileSync(join(PASTA, ARQUIVOS.acidentes), JSON.stringify(acidentes, null, 2));
const porTipo = acidentes.reduce((t, a) => ({ ...t, [a.tipo]: (t[a.tipo] ?? 0) + 1 }), {});
console.log(`[carga-exemplo] ${cadastros.length} obras e ${acidentes.length} acidentes gravados em data/exemplo (${Object.entries(porTipo).map(([k, v]) => `${k} ${v}`).join(' · ')}).`);
if (incompletos.length) console.log(`[carga-exemplo] ${incompletos.length} linha(s) incompleta(s) na planilha entraram com os campos vazios (a importação do app as recusaria).`);
