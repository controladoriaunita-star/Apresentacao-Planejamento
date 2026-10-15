/**
 * Checagens estáticas rodadas antes dos testes (`npm run check`):
 * 1. sintaxe de todo JS (node --check);
 * 2. nenhuma cor hex fora de public/css/tokens.css (regra da identidade visual);
 * 3. nenhum segredo em arquivo versionável (credenciais do Graph, senhas).
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const IGNORAR = new Set(['node_modules', 'data', '.git', 'vendor', 'test-results', 'playwright-report', '.claude']);
const problemas = [];

function* arquivos(pasta) {
  for (const nome of readdirSync(pasta)) {
    if (IGNORAR.has(nome)) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) yield* arquivos(caminho);
    else yield caminho;
  }
}

const todos = [...arquivos(RAIZ)];
const rel = (c) => relative(RAIZ, c).replaceAll('\\', '/');

// 1. Sintaxe
for (const arquivo of todos.filter((a) => ['.js', '.mjs'].includes(extname(a)))) {
  try {
    execFileSync(process.execPath, ['--check', arquivo], { stdio: 'pipe' });
  } catch (e) {
    problemas.push(`sintaxe: ${rel(arquivo)}\n${e.stderr}`);
  }
}

// 2. Cores só em tokens.css (o meta theme-color do HTML é exigido pela identidade)
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
for (const arquivo of todos.filter((a) => a.includes(`${'public'}`) && ['.css', '.js', '.html'].includes(extname(a)))) {
  if (rel(arquivo) === 'public/css/tokens.css') continue;
  readFileSync(arquivo, 'utf8').split('\n').forEach((linha, i) => {
    if (linha.includes('theme-color')) return;
    const achados = linha.match(HEX)?.filter((h) => !/^#(\/|[a-z]+-)/.test(h));
    if (achados?.length) problemas.push(`cor fora dos tokens: ${rel(arquivo)}:${i + 1} ${achados.join(' ')}`);
  });
}

// 3. Segredos
const SEGREDOS = [
  /MS_GRAPH_CLIENT_SECRET=\S{8,}/,
  /SESSION_SECRET=\S{8,}/,
  /client_secret['"]?\s*[:=]\s*['"][^'"$]{8,}/i,
  /SUPABASE_SERVICE_ROLE_KEY=\S{20,}/,
  /sb_secret_[A-Za-z0-9_-]{10,}/,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}/, // JWT (chaves antigas do Supabase)
];
let versionaveis = todos;
try {
  versionaveis = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter(Boolean).map((f) => join(RAIZ, f));
} catch { /* sem git: checa tudo */ }
for (const arquivo of versionaveis) {
  if (/\.(png|jpe?g|gif|webp|ico|pbix|xlsx|xlsm)$/i.test(arquivo) || arquivo.endsWith('checar-projeto.mjs')) continue;
  let texto;
  try { texto = readFileSync(arquivo, 'utf8'); } catch { continue; }
  for (const padrao of SEGREDOS) if (padrao.test(texto)) problemas.push(`possível segredo em ${rel(arquivo)} (${padrao})`);
}

if (problemas.length) {
  console.error(`✖ ${problemas.length} problema(s):\n${problemas.join('\n')}`);
  process.exit(1);
}
console.log(`✔ checagens ok (${todos.length} arquivos)`);
