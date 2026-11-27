/**
 * Contrato da IAT e da IST (/api/seguranca/iat|ist) nos dois armazenamentos: arquivos locais e Supabase simulado.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { cliente, enviarArquivo, subirServidor } from './servidor.mjs';

for (const store of ['local', 'supabase']) {
  describe(`IAT e IST (${store})`, () => {
    let srv;
    let dev;
    let anonimo;
    let obra;

    before(async () => {
      srv = await subirServidor({ store });
      dev = cliente(srv.base, srv.fetchExterno);
      anonimo = cliente(srv.base, srv.fetchExterno);
      assert.equal((await dev('POST', '/api/auth/configurar', { nome: 'Dev', email: 'dev@unita.com.br', senha: 'senha-forte-1' })).status, 201);
      obra = (await dev('PUT', '/api/obras/cadastro', { obra: 'MC Teste', cliente: 'Metrocasa', sistemaEstrutural: 'Parede de Concreto', engenharia: 'Eng. Teste' })).dados;
    });
    after(() => srv.fechar());

    test('IAT: exige login e obra; numera, normaliza e guarda o complemento Metrocasa', async () => {
      assert.equal((await anonimo('GET', '/api/seguranca/iat')).status, 401);
      assert.equal((await dev('POST', '/api/seguranca/iat', { nomeAcidentado: 'Sem obra' })).status, 400);
      let r = await dev('POST', '/api/seguranca/iat', {
        obraId: obra.id, nomeAcidentado: 'Fulano', sexo: 'masculino', tipoAcidente: 'Típico', parteCorpo: '753030000', agenteCausador: '999',
        evidencias: { osst: { resposta: 'Não', anexoId: 'nao-deve-ficar' } }, metrocasa: { empresa: 'Contratada X' }, campoEstranho: 'x',
      });
      assert.equal(r.status, 201);
      assert.equal(r.dados.numero, 1);
      assert.equal(r.dados.sexo, 'Masculino');
      assert.equal(r.dados.agenteCausador, '', 'código fora da Tabela 14 é descartado');
      assert.equal(r.dados.evidencias.osst.anexoId, null, 'anexo só com resposta Sim');
      assert.equal(r.dados.metrocasa.empresa, 'Contratada X');
      assert.equal(r.dados.campoEstranho, undefined);
      assert.equal(r.dados.emitente, 'Empregador');
      const id = r.dados.id;
      assert.equal((await dev('GET', '/api/seguranca/iat/proximo')).dados.numero, 2, 'próximo = último + 1');
      assert.equal(r.dados.numeroCat, undefined, 'Nº da CAT não é digitado: é o número do registro');
      r = await dev('PUT', `/api/seguranca/iat/${id}`, { ...r.dados, cargoFuncao: 'Pedreiro' });
      assert.equal(r.status, 200);
      assert.deepEqual([r.dados.numero, r.dados.cargoFuncao], [1, 'Pedreiro']);
      r = await dev('POST', '/api/seguranca/iat', { obraId: obra.id, nomeAcidentado: 'Beltrano' });
      assert.equal(r.dados.numero, 2);
      const lista = (await dev('GET', '/api/seguranca/iat')).dados;
      assert.deepEqual(lista.map((d) => d.titulo).sort(), ['Beltrano', 'Fulano']);
      assert.equal(lista[0].obra, 'MC Teste');
      for (const d of lista) assert.equal((await dev('DELETE', `/api/seguranca/iat/${d.id}`)).status, 200);
      assert.equal((await dev('GET', `/api/seguranca/iat/${id}`)).status, 404);
    });

    test('envio automático: pendências, só PDF, só para os e-mails da obra, da caixa de quem está logado, histórico', async () => {
      await dev('PUT', `/api/obras/cadastro/${obra.id}/emails`, { emails: [] });
      const completa = {
        obraId: obra.id, razaoSocial: 'Empreiteira X', nomeAcidentado: 'Fulano de Tal', cargoFuncao: 'Pedreiro', dataAcidente: '2026-11-20',
        horaAcidente: '09:30', tipoAcidente: 'Típico', localAcidente: 'Torre A', parteCorpo: '753030000', agenteCausador: '302010200',
        situacaoGeradora: '200004300', observacoes: 'Bateu a cabeça na viga.', duracaoTratamentoDias: 2,
      };
      const iat = (await dev('POST', '/api/seguranca/iat', completa)).dados;
      const incompleta = (await dev('POST', '/api/seguranca/iat', { obraId: obra.id })).dados;
      const pdf = await enviarArquivo(dev, srv.fetchExterno, new Uint8Array(Buffer.from('%PDF-1.4 teste')), 'application/pdf', 'IAT 01.pdf');
      const png = await enviarArquivo(dev, srv.fetchExterno, new Uint8Array(Buffer.from('png')), 'image/png', 'foto.png');
      assert.deepEqual((await dev('GET', '/api/seguranca/envio')).dados, { modo: 'arquivo', remetente: 'dev@unita.com.br' }, 'sai da caixa de quem está logado');

      // Obra sem e-mails cadastrados: não envia (não há destinatário fixo).
      let semEmail = await dev('POST', `/api/seguranca/iat/${iat.id}/enviar`, { qual: 'iat', anexos: [pdf.dados.id] });
      assert.equal(semEmail.status, 400);
      assert.match(semEmail.dados.erro, /não tem e-mails cadastrados/);
      await dev('PUT', `/api/obras/cadastro/${obra.id}/emails`, { emails: ['eng@unita.com.br', 'adm@unita.com.br'] });

      let r = await dev('POST', `/api/seguranca/iat/${incompleta.id}/enviar`, { qual: 'iat', anexos: [pdf.dados.id] });
      assert.equal(r.status, 400);
      assert.match(r.dados.erro, /Falta/);
      r = await dev('POST', `/api/seguranca/iat/${iat.id}/enviar`, { qual: 'iat', anexos: [png.dados.id] });
      assert.equal(r.status, 400, 'só PDF');
      r = await dev('POST', `/api/seguranca/iat/${iat.id}/enviar`, { qual: 'metrocasa', anexos: [pdf.dados.id] });
      assert.equal(r.status, 200, r.dados.erro);
      assert.deepEqual(r.dados.para, ['eng@unita.com.br', 'adm@unita.com.br'], 'Metrocasa também vai só para os e-mails da obra');
      r = await dev('POST', `/api/seguranca/iat/${iat.id}/enviar`, { qual: 'iat', anexos: [pdf.dados.id] });
      assert.equal(r.status, 200, r.dados.erro);
      assert.deepEqual([r.dados.modo, r.dados.para, r.dados.copia, r.dados.de], ['arquivo', ['eng@unita.com.br', 'adm@unita.com.br'], [], 'dev@unita.com.br']);
      assert.equal(r.dados.envios.length, 2);

      const pasta = join(srv.config.dataDir, 'emails-enviados');
      const eml = readFileSync(join(pasta, r.dados.arquivo), 'utf8');
      assert.match(eml, /^From: dev@unita\.com\.br/m);
      assert.match(eml, /^To: eng@unita\.com\.br, adm@unita\.com\.br/m);
      const cabecalho = eml.split('\r\n\r\n')[0];
      assert.doesNotMatch(cabecalho, /acidentes@|metrocasa\.com|^Cc:/m, 'destinatários só da obra (o rodapé da ficha ainda cita o endereço)');
      assert.match(eml, /Content-Type: application\/pdf; name="?IAT 01\.pdf/);
      assert.equal(readdirSync(pasta).length, 2);

      r = await dev('PUT', `/api/seguranca/iat/${iat.id}`, { ...completa, cargoFuncao: 'Armador' });
      assert.equal(r.dados.envios.length, 2, 'salvar a IAT não apaga o histórico de envios');
      assert.equal((await dev('GET', `/api/arquivos/${pdf.dados.id}`)).status, 200, 'o PDF enviado fica guardado');
      for (const d of [iat, incompleta]) await dev('DELETE', `/api/seguranca/iat/${d.id}`);
      assert.equal((await dev('GET', `/api/arquivos/${pdf.dados.id}`)).status, 404, 'excluir a IAT apaga os PDFs enviados');
    });

    test('e-mails da obra: só válidos, sem repetição, preservados ao editar o cadastro', async () => {
      assert.equal((await dev('PUT', `/api/obras/cadastro/${obra.id}/emails`, { emails: ['ok@unita.com.br', 'invalido'] })).status, 400);
      let r = await dev('PUT', `/api/obras/cadastro/${obra.id}/emails`, { emails: [' Eng@Unita.com.br ', 'eng@unita.com.br', 'adm@unita.com.br'] });
      assert.equal(r.status, 200);
      assert.deepEqual(r.dados.emails, ['eng@unita.com.br', 'adm@unita.com.br']);
      r = await dev('PUT', '/api/obras/cadastro', { obra: 'MC Teste', cliente: 'Metrocasa', sistemaEstrutural: 'Parede de Concreto', engenharia: 'Outro Eng.' });
      assert.deepEqual(r.dados.emails, ['eng@unita.com.br', 'adm@unita.com.br'], 'editar o cadastro não apaga os e-mails');
      assert.equal((await dev('PUT', '/api/obras/cadastro/nao-existe/emails', { emails: [] })).status, 404);
    });

    test('IST: lista de ocorrências, prazo inteiro ≥ 1 e foto removida ao sair do documento', async () => {
      const foto = await enviarArquivo(dev, srv.fetchExterno, new Uint8Array(Buffer.from('png')), 'image/png', 'foto.png');
      assert.equal(foto.status, 201);
      let r = await dev('POST', '/api/seguranca/ist', {
        obraId: obra.id, classificacao: 'fiscalização do crea', potencialMulta: '1.500,50', planoAcao: [{ oQue: 'Corrigir', prazoDias: 0 }, { prazoDias: 7 }], contraFotos: [foto.dados.id],
      });
      assert.equal(r.status, 201);
      assert.equal(r.dados.classificacao, 'Fiscalização do CREA');
      assert.equal(r.dados.potencialMulta, 1500.5);
      assert.deepEqual(r.dados.planoAcao.slice(0, 2).map((l) => l.prazoDias), [null, 7]);
      assert.equal(r.dados.contraFotos[0], foto.dados.id);
      assert.equal((await dev('GET', `/api/arquivos/${foto.dados.id}`)).status, 200);
      r = await dev('PUT', `/api/seguranca/ist/${r.dados.id}`, { ...r.dados, contraFotos: [] });
      assert.equal(r.status, 200);
      assert.equal((await dev('GET', `/api/arquivos/${foto.dados.id}`)).status, 404, 'foto que saiu da IST é apagada');
      assert.equal((await dev('DELETE', `/api/seguranca/ist/${r.dados.id}`)).status, 200);
    });
  });
}
