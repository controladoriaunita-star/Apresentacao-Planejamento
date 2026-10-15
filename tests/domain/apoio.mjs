/** Monta a base de cálculo a partir da planilha fictícia, como o front faz com a resposta da API. */
import { readFileSync } from 'node:fs';
import { criarBase, criarFisicoAtividade } from '../../public/js/domain/base.js';

const planilhas = JSON.parse(readFileSync(new URL('../fixtures/planilhas-exemplo.json', import.meta.url), 'utf8'));
export const matriz = (aba) => ({ colunas: planilhas[aba][0], linhas: planilhas[aba].slice(1) });

export const CADASTRO = [
  {
    obra: 'Residencial Alpha', numeroUH: 200, areaEquivalente: 10_000, areaPrivativaTotal: 8_000, areaConstruida: 12_000,
    inccBase: 1000, dataBaseIncc: '2025-01-01',
  },
];
export const INCC = [{ mes: '2025-01', indice: 1000 }, { mes: '2026-02', indice: 1080 }, { mes: '2026-03', indice: 1100 }];

export function baseExemplo(visao = 'obra', extras = {}) {
  return criarBase({
    atualizadoEm: '2026-04-01T10:00:00Z',
    abas: {
      'BD_Infos Gerais': matriz('BD_Infos Gerais'),
      'BD_Orc': matriz('BD_Orc'),
      'BD_Econômico': matriz('BD_Econômico'),
    },
    cadastro: extras.cadastro ?? CADASTRO,
    incc: extras.incc ?? INCC,
  }, visao);
}

export function fisicoExemplo(nomeObra, visao = 'obra') {
  const m = matriz('BD_Físico por atividade');
  return criarFisicoAtividade({ colunas: m.colunas, linhas: m.linhas.filter((l) => l[1] === nomeObra) }, visao);
}

/** Compara números com tolerância de ponto flutuante. */
export function perto(assert, atual, esperado, msg) {
  assert.ok(typeof atual === 'number' && Math.abs(atual - esperado) < 1e-9, `${msg}: esperado ${esperado}, veio ${atual}`);
}
