/**
 * Leitura das planilhas com um Graph falso: nova tentativa, cache vencido servido na hora e fallback.
 * (Bug v01: a 1ª abertura do Resumo Físico esperava ~10 s pela aba de 25 mil linhas.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FontePlanilhas } from '../../server/sources/planilhas.mjs';

function grafoFalso(respostas) {
  const chamadas = [];
  const fetchFalso = async (url) => {
    if (String(url).includes('oauth2')) return Response.json({ access_token: 't', expires_in: 3600 });
    chamadas.push(url);
    const proxima = respostas.shift() ?? { status: 200, valores: [['Nome da Obra'], ['Obra A']] };
    return proxima.status === 200 ? Response.json({ values: proxima.valores }) : Response.json({ error: { message: 'falhou' } }, { status: proxima.status });
  };
  return { fetchFalso, chamadas };
}

function fonte(fetchFalso, cacheMinutos = 30) {
  const dataDir = mkdtempSync(join(tmpdir(), 'planilhas-'));
  const config = { fonteDados: 'graph', dataDir, cacheMinutos, graph: { tenantId: 't', clientId: 'c', clientSecret: 's', driveId: 'd', itemId: 'i' } };
  return { f: new FontePlanilhas(config, fetchFalso), limpar: () => rmSync(dataDir, { recursive: true, force: true }) };
}

test('erro temporário do Graph (503) é repetido uma vez', async () => {
  const { fetchFalso, chamadas } = grafoFalso([{ status: 503 }]);
  const { f, limpar } = fonte(fetchFalso);
  const aba = await f.aba('BD_Orc');
  assert.equal(chamadas.length, 2);
  assert.deepEqual(aba.linhas, [['Obra A']]);
  limpar();
});

test('sem permissão (403) não repete', async () => {
  const { fetchFalso, chamadas } = grafoFalso([{ status: 403 }]);
  const { f, limpar } = fonte(fetchFalso);
  await assert.rejects(f.aba('BD_Orc'), /permissão/);
  assert.equal(chamadas.length, 1);
  limpar();
});

test('cache vencido responde na hora e atualiza em segundo plano', async () => {
  const { fetchFalso, chamadas } = grafoFalso([{ status: 200, valores: [['Nome da Obra'], ['Antiga']] }, { status: 200, valores: [['Nome da Obra'], ['Nova']] }]);
  const { f, limpar } = fonte(fetchFalso, 0); // validade zero: todo pedido encontra o cache vencido
  assert.deepEqual((await f.aba('BD_Orc')).linhas, [['Antiga']]);
  assert.deepEqual((await f.aba('BD_Orc')).linhas, [['Antiga']], 'não espera a nova leitura');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual((await f.aba('BD_Orc')).linhas, [['Nova']]);
  assert.ok(chamadas.length >= 2);
  limpar();
});

test('falha depois de ter dados: devolve o último cache com aviso', async () => {
  const { fetchFalso } = grafoFalso([{ status: 200, valores: [['Nome da Obra'], ['Obra A']] }, { status: 500 }, { status: 500 }]);
  const { f, limpar } = fonte(fetchFalso);
  await f.aba('BD_Orc');
  const aba = await f.aba('BD_Orc', { forcar: true });
  assert.deepEqual(aba.linhas, [['Obra A']]);
  assert.match(f.aviso, /Não foi possível atualizar/);
  limpar();
});
