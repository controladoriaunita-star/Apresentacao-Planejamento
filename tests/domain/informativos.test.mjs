/** IAT e IST — listas, normalização, IAT Metrocasa e pendências (public/js/domain/informativos.js). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arquivosDoInformativo, ehMetrocasa, emailInformativo, metrocasaEfetivo, normalizarIat, normalizarIst, OCORRENCIAS_IST,
  pendenciasIat, pendenciasIst, pendenciasMetrocasa, TABELA_13, TABELA_14, TABELA_15, TABELA_17,
} from '../../public/js/domain/informativos.js';

test('listas da planilha: tabelas do eSocial e ocorrências da IST', () => {
  assert.deepEqual([TABELA_13.length, TABELA_14.length, TABELA_15.length, TABELA_17.length], [45, 248, 60, 29]);
  assert.deepEqual(TABELA_13[0], ['753030000', 'Crânio (inclusive encéfalo)']);
  assert.equal(OCORRENCIAS_IST.length, 21);
});

test('IAT Metrocasa: puxa da IAT, tipo pela fórmula e complemento só onde o usuário mudou', () => {
  const cadastro = { obra: 'MC Centro', cliente: 'Metrocasa' };
  assert.equal(ehMetrocasa(cadastro), true);
  assert.equal(ehMetrocasa({ cliente: 'Habita' }), false);
  const iat = normalizarIat({
    obraId: 'o1', razaoSocial: 'Empreiteira', cargoFuncao: 'Pedreiro', localAcidente: 'Torre A', agenteCausador: '302010200',
    observacoes: 'Bateu a cabeça', duracaoTratamentoDias: 0, parteCorpo: '753030000', fotos: ['foto-aaaaaa1', null, 'foto-aaaaaa3'],
  });
  const m = metrocasaEfetivo(iat, cadastro);
  assert.equal(m.tipo, 'Incidente', 'afastamento 0 → Incidente');
  assert.equal(m.material, 'Rua e estrada - superfície utilizada para sustentar pessoas');
  assert.equal(m.parteCorpo, 'Crânio (inclusive encéfalo)');
  assert.deepEqual(m.fotos, ['foto-aaaaaa1', null, 'foto-aaaaaa3', null]);
  assert.deepEqual(pendenciasMetrocasa(iat, cadastro), []);
  assert.equal(metrocasaEfetivo({ ...iat, duracaoTratamentoDias: 4 }, cadastro).tipo, 'Acidente');
  const semEmpresa = normalizarIat({ ...iat, razaoSocial: '' });
  assert.deepEqual(pendenciasMetrocasa(semEmpresa, cadastro), ['Nome da Empresa Contratada']);
  assert.deepEqual(pendenciasMetrocasa({ ...semEmpresa, metrocasa: { empresa: 'Contratada X' } }, cadastro), [], 'complementar resolve');
  assert.deepEqual(emailInformativo('metrocasa', iat, cadastro).para, [], 'sem destinatário fixo da Metrocasa (v40.3)');
});

test('e-mail: só para os e-mails da obra (todos em Para) e ficha completa no corpo', () => {
  const cadastro = { obra: 'MC Centro', cliente: 'Metrocasa', emails: ['eng@unita.com.br', 'adm@unita.com.br'] };
  const iat = { ...normalizarIat({ obraId: 'o1', nomeAcidentado: 'Fulano', parteCorpo: '753030000', observacoes: 'x'.repeat(3000) }), numero: 7 };
  const e = emailInformativo('iat', iat, cadastro);
  assert.deepEqual(e.para, ['eng@unita.com.br', 'adm@unita.com.br'], 'sem acidentes@ fixo: só os e-mails da obra');
  assert.deepEqual(e.copia, []);
  assert.deepEqual(emailInformativo('ist', { numero: 1 }, { obra: 'Sem e-mail' }).para, [], 'obra sem e-mail: ninguém');
  assert.match(e.assunto, /IAT nº 07 – MC Centro – Fulano/);
  assert.match(e.corpo, /III- DADOS DO ACIDENTADO\nNome do Colaborador Acidentado: Fulano/);
  assert.match(e.corpo, /753030000 – Crânio/);
  assert.ok(e.corpo.includes('x'.repeat(3000)), 'enviado pelo servidor: a ficha vai inteira, sem cortes');
});

test('IAT: obrigatórios para PDF, óbito exige data e anexos contados para limpeza', () => {
  const iat = normalizarIat({ houveMorte: 'sim', evidencias: { pt: { resposta: 'Sim', anexoId: 'anexo-123456', anexoNome: 'pt.pdf' } } });
  const faltam = pendenciasIat(iat);
  assert.ok(faltam.includes('Nome da Obra') && faltam.includes('Data do óbito'));
  assert.deepEqual(arquivosDoInformativo(iat), ['anexo-123456']);
});

test('IST: classificação da lista, multa em reais, prazo inteiro ≥ 1 e pendências', () => {
  const ist = normalizarIst({ classificacao: 'outros', potencialMulta: '2.000,00', planoAcao: [{ prazoDias: '2,6' }, { prazoDias: 0 }] });
  assert.equal(ist.classificacao, 'Outros');
  assert.equal(ist.potencialMulta, 2000);
  assert.deepEqual(ist.planoAcao.slice(0, 2).map((l) => l.prazoDias), [3, null]);
  assert.equal(ist.planoAcao.length, 6);
  assert.equal(ist.fotos.length, 12);
  assert.deepEqual(pendenciasIst(ist), ['Data', 'Horário', 'Local', 'Nome do Estabelecimento', 'Descrição Resumida da Ocorrência']);
});
