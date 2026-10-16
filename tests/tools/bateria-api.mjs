/**
 * Bateria de testes da API contra um servidor no ar (dev local ou Vercel). Só faz leituras: nada é gravado,
 * então pode rodar em produção.
 *
 *   npm run bateria -- https://apresentacao-planejamento.vercel.app
 *   npm run bateria -- http://localhost:5210 --rodadas 10 --paralelo 20 --relatorio bateria.md
 *
 * 1. Funcional — cada rota responde o status e o formato do contrato (docs/API.md), com dados reais.
 * 2. Estabilidade — as rotas principais em sequência por várias rodadas (falhas e tempos).
 * 3. Carga — requisições simultâneas, como várias pessoas abrindo a apresentação ao mesmo tempo.
 *
 * Sai com código 1 se alguma verificação falhar (avisos não reprovam).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values: opcoes, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rodadas: { type: 'string', default: '5' },
    paralelo: { type: 'string', default: '10' },
    tempo: { type: 'string', default: '60' }, // limite por requisição, em segundos
    relatorio: { type: 'string' },
  },
});
const BASE = (positionals[0] ?? 'http://localhost:5210').replace(/\/$/, '');
const RODADAS = Number(opcoes.rodadas);
const PARALELO = Number(opcoes.paralelo);
const LIMITE_MS = Number(opcoes.tempo) * 1000;
const LENTO_MS = 5000;

const resultados = []; // { fase, nome, situacao: 'ok' | 'aviso' | 'falha', detalhe, ms }

/** Requisição com tempo medido; nunca lança (erro de rede vira status 0). */
async function chamar(caminho, { metodo = 'GET', cabecalhos = {} } = {}) {
  const inicio = performance.now();
  try {
    const res = await fetch(BASE + caminho, { method: metodo, headers: cabecalhos, redirect: 'manual', signal: AbortSignal.timeout(LIMITE_MS) });
    const texto = await res.text();
    let json = null;
    try { json = JSON.parse(texto); } catch { /* não é JSON */ }
    return { status: res.status, json, texto, cabecalhos: res.headers, ms: performance.now() - inicio };
  } catch (e) {
    return { status: 0, json: null, texto: '', erro: e.name === 'TimeoutError' ? `sem resposta em ${LIMITE_MS / 1000} s` : e.message, ms: performance.now() - inicio };
  }
}

function registrar(fase, nome, situacao, detalhe, ms = null) {
  resultados.push({ fase, nome, situacao, detalhe, ms });
  const marca = { ok: '✔', aviso: '!', falha: '✖' }[situacao];
  console.log(`  ${marca} ${nome}${ms === null ? '' : ` (${fmtMs(ms)})`} — ${detalhe}`);
}

/** Roda uma verificação: `conferir` devolve [situacao, detalhe] ou lança para falhar. */
async function verificar(nome, caminho, conferir, opcoesChamada) {
  const r = await chamar(caminho, opcoesChamada);
  if (r.status === 0) {
    registrar('Funcional', nome, 'falha', `erro de rede: ${r.erro}`, r.ms);
    return r;
  }
  try {
    const [situacao, detalhe] = conferir(r);
    registrar('Funcional', nome, situacao === 'ok' && r.ms > LENTO_MS ? 'aviso' : situacao, r.ms > LENTO_MS ? `${detalhe} · lento` : detalhe, r.ms);
  } catch (e) {
    registrar('Funcional', nome, 'falha', `HTTP ${r.status}: ${e.message}`, r.ms);
  }
  return r;
}

const exigir = (condicao, mensagem) => { if (!condicao) throw new Error(mensagem); };
const exigirStatus = (r, esperado) => exigir(r.status === esperado, `esperado HTTP ${esperado}${r.json?.erro ? ` (${r.json.erro})` : ''}`);
const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
const percentil = (lista, p) => {
  const ordenada = [...lista].sort((a, b) => a - b);
  return ordenada[Math.min(ordenada.length - 1, Math.ceil((p / 100) * ordenada.length) - 1)] ?? 0;
};
const horasDesde = (iso) => (Date.now() - Date.parse(iso)) / 3_600_000;

// ── 1. Funcional ────────────────────────────────────────────────────────
async function funcional() {
  console.log('\n1. Funcional');
  let obra = null;

  await verificar('Saúde do servidor', '/api/saude', (r) => {
    exigirStatus(r, 200);
    exigir(r.json?.ok === true, 'ok ≠ true');
    return ['ok', `fonte ${r.json.fonte}, armazenamento ${r.json.armazenamento ?? '?'}`];
  });

  const sessao = await verificar('Sessão', '/api/auth/sessao', (r) => {
    exigirStatus(r, 200);
    exigir('usuario' in (r.json ?? {}), 'resposta sem "usuario"');
    return r.json.usuario
      ? ['ok', `entra sem login como "${r.json.usuario.nome}" (${r.json.usuario.papel})`]
      : ['aviso', 'login obrigatório — as rotas protegidas abaixo vão responder 401'];
  });
  const logado = Boolean(sessao.json?.usuario);
  const protegida = (r, conferir) => (!logado && r.status === 401 ? ['aviso', 'pede login (401)'] : conferir(r));

  await verificar('Planilhas do SharePoint (resumo)', '/api/dados/resumo', (r) => protegida(r, () => {
    exigirStatus(r, 200);
    const abas = r.json?.abas ?? {};
    const nomes = ['BD_Infos Gerais', 'BD_Orc', 'BD_Econômico'];
    for (const nome of nomes) {
      exigir(Array.isArray(abas[nome]?.colunas) && Array.isArray(abas[nome]?.linhas), `aba ${nome} ausente`);
      exigir(abas[nome].linhas.length > 0, `aba ${nome} vazia`);
    }
    exigir(Array.isArray(r.json.incc) && r.json.incc.length > 0, 'INCC vazio');
    const infos = abas['BD_Infos Gerais'];
    const iNome = infos.colunas.findIndex((c) => String(c).trim().toLowerCase() === 'nome da obra');
    obra = infos.linhas.find((l) => l[iNome])?.[iNome] ?? null;
    const linhas = nomes.map((n) => `${n} ${abas[n].linhas.length}`).join(', ');
    const idade = r.json.atualizadoEm ? horasDesde(r.json.atualizadoEm) : null;
    if (r.json.aviso) return ['aviso', `SharePoint falhou, servindo cache: ${r.json.aviso}`];
    if (idade !== null && idade > 24) return ['aviso', `dados lidos há ${idade.toFixed(0)} h · ${linhas}`];
    return ['ok', `${linhas} linhas · ${r.json.cadastro?.length ?? 0} cadastros · gzip ${r.cabecalhos.get('content-encoding') === 'gzip' ? 'sim' : 'não'}`];
  }), { cabecalhos: { 'accept-encoding': 'gzip' } });

  if (obra) {
    await verificar(`Físico por atividade (${obra})`, `/api/dados/fisico?obra=${encodeURIComponent(obra)}`, (r) => protegida(r, () => {
      exigirStatus(r, 200);
      exigir(Array.isArray(r.json?.linhas), 'resposta sem linhas');
      return r.json.linhas.length ? ['ok', `${r.json.linhas.length} linhas`] : ['aviso', 'obra sem atividades'];
    }));
  } else if (logado) {
    registrar('Funcional', 'Físico por atividade', 'falha', 'não foi possível descobrir uma obra no resumo');
  }

  await verificar('Físico sem informar a obra', '/api/dados/fisico', (r) => protegida(r, () => {
    exigirStatus(r, 400);
    return ['ok', 'recusa com 400'];
  }));

  await verificar('INCC', '/api/incc', (r) => protegida(r, () => {
    exigirStatus(r, 200);
    const itens = r.json?.itens ?? [];
    exigir(itens.length > 0, 'série vazia');
    const ultimo = itens.map((i) => i.mes).sort().at(-1);
    return ['ok', `${itens.length} meses, último ${ultimo}`];
  }));

  for (const [nome, caminho] of [['Cadastro de obras', '/api/obras/cadastro'], ['Telas do Cliente', '/api/telas'], ['Mídias (TxC e fotos)', '/api/midias']]) {
    await verificar(nome, caminho, (r) => protegida(r, () => {
      exigirStatus(r, 200);
      exigir(Array.isArray(r.json), 'não é uma lista');
      return ['ok', `${r.json.length} registros`];
    }));
  }

  await verificar('Usuários (administração)', '/api/usuarios', (r) => {
    if (r.status === 401 || r.status === 403) return ['ok', `protegida (${r.status})`];
    exigirStatus(r, 200);
    exigir(Array.isArray(r.json), 'não é uma lista');
    exigir(r.json.every((u) => !('senhaHash' in u)), 'hash de senha exposto');
    return ['aviso', `aberta sem login: ${r.json.length} usuários visíveis`];
  });

  await verificar('Arquivo inexistente', '/api/arquivos/00000000-0000-0000-0000-000000000000', (r) => protegida(r, () => {
    exigirStatus(r, 404);
    return ['ok', '404'];
  }));

  await verificar('Rota inexistente', '/api/nao-existe', (r) => {
    exigirStatus(r, 404);
    exigir(typeof r.json?.erro === 'string', 'erro fora do formato { erro }');
    return ['ok', '404 no formato do contrato'];
  });

  await verificar('Proteção CSRF (escrita sem X-Requested-With)', '/api/dados/atualizar', (r) => {
    exigirStatus(r, 403);
    return ['ok', 'recusada com 403, nada foi executado'];
  }, { metodo: 'POST' });

  await verificar('Página inicial', '/', (r) => {
    exigirStatus(r, 200);
    exigir(r.texto.includes('<html') || r.texto.includes('<!doctype'), 'não é HTML');
    return ['ok', 'HTML servido'];
  });

  await verificar('Script principal do front', '/js/main.js', (r) => {
    exigirStatus(r, 200);
    exigir(r.texto.includes('iniciar'), 'conteúdo inesperado');
    return ['ok', `${(r.texto.length / 1024).toFixed(0)} KB`];
  });

  await verificar('Cabeçalhos de segurança', '/api/saude', (r) => {
    exigir(r.cabecalhos.get('x-content-type-options') === 'nosniff', 'sem X-Content-Type-Options: nosniff');
    return ['ok', 'nosniff presente'];
  });

  return obra;
}

// ── 2. Estabilidade e 3. Carga ──────────────────────────────────────────
function resumirTempos(fase, nome, respostas) {
  const tempos = respostas.map((r) => r.ms);
  const falhas = respostas.filter((r) => r.status !== 200);
  const detalhe = `${respostas.length - falhas.length}/${respostas.length} ok · mediana ${fmtMs(percentil(tempos, 50))} · p95 ${fmtMs(percentil(tempos, 95))} · máx ${fmtMs(Math.max(...tempos))}`;
  const erros = [...new Set(falhas.map((r) => (r.status ? `HTTP ${r.status}${r.json?.erro ? ` ${r.json.erro}` : ''}` : r.erro)))];
  const situacao = falhas.length ? 'falha' : percentil(tempos, 95) > LENTO_MS ? 'aviso' : 'ok';
  registrar(fase, nome, situacao, erros.length ? `${detalhe} · ${erros.join('; ')}` : detalhe);
}

async function estabilidade(rotas) {
  console.log(`\n2. Estabilidade (${RODADAS} rodadas em sequência)`);
  for (const [nome, caminho] of rotas) {
    const respostas = [];
    for (let i = 0; i < RODADAS; i++) respostas.push(await chamar(caminho, { cabecalhos: { 'accept-encoding': 'gzip' } }));
    resumirTempos('Estabilidade', nome, respostas);
  }
}

async function carga(rotas) {
  console.log(`\n3. Carga (${PARALELO} requisições simultâneas por rota)`);
  for (const [nome, caminho] of rotas) {
    const respostas = await Promise.all(Array.from({ length: PARALELO }, () => chamar(caminho, { cabecalhos: { 'accept-encoding': 'gzip' } })));
    resumirTempos('Carga', nome, respostas);
  }
}

// ── Relatório ───────────────────────────────────────────────────────────
function relatorioMarkdown(inicio) {
  const linhas = resultados.map((r) => `| ${r.fase} | ${r.nome} | ${{ ok: '✔ ok', aviso: '! aviso', falha: '✖ falha' }[r.situacao]} | ${r.ms === null ? '' : fmtMs(r.ms)} | ${r.detalhe.replaceAll('|', '/')} |`);
  return [
    `# Bateria da API — ${BASE}`, '',
    `${inicio.toLocaleString('pt-BR')} · ${RODADAS} rodadas · ${PARALELO} simultâneas`, '',
    '| Fase | Verificação | Situação | Tempo | Detalhe |', '|---|---|---|---|---|', ...linhas, '',
  ].join('\n');
}

const inicio = new Date();
console.log(`Bateria da API em ${BASE}`);
const primeira = await chamar('/api/saude');
console.log(`Primeira resposta (inclui partida a frio): ${primeira.status ? `HTTP ${primeira.status} em ${fmtMs(primeira.ms)}` : primeira.erro}`);

const obra = await funcional();
const rotas = [['Saúde', '/api/saude'], ['Sessão', '/api/auth/sessao'], ['Resumo (planilhas)', '/api/dados/resumo'], ['INCC', '/api/incc']];
if (obra) rotas.push([`Físico (${obra})`, `/api/dados/fisico?obra=${encodeURIComponent(obra)}`]);
await estabilidade(rotas);
await carga(rotas);

const conta = (s) => resultados.filter((r) => r.situacao === s).length;
console.log(`\nResultado: ${conta('ok')} ok · ${conta('aviso')} avisos · ${conta('falha')} falhas`);
if (opcoes.relatorio) {
  writeFileSync(opcoes.relatorio, relatorioMarkdown(inicio));
  console.log(`Relatório: ${opcoes.relatorio}`);
}
process.exitCode = conta('falha') ? 1 : 0;
