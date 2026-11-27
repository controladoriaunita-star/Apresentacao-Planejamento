/**
 * Envio da IAT por e-mail: a confirmação abre na hora (sem o aviso "Gerando o PDF"), o anexo aparece "preparando"
 * e vira link quando o PDF fica pronto, e "Enviar e-mail" envia (modo arquivo nos testes: EMAIL_ENVIO=arquivo).
 * Roda depois do 01 (Dev já criado).
 */
const { DEV, entrar, expect, test } = require('./fixture.cjs');

const api = (page, metodo, caminho, corpo) => page.evaluate(([m, c, b]) => fetch(`/api${c}`, {
  method: m, headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' }, body: b ? JSON.stringify(b) : undefined,
}).then(async (r) => ({ status: r.status, dados: await r.json().catch(() => null) })), [metodo, caminho, corpo]);

test('IAT: "Enviar por e-mail" abre a confirmação na hora, prepara o PDF em segundo plano e envia', async ({ page }) => {
  await entrar(page, DEV);
  const obra = (await api(page, 'GET', '/obras/cadastro')).dados.find((c) => c.id);
  expect(obra, 'precisa de uma obra no Cadastro de obras (criada pelo 01/02)').toBeTruthy();
  const iat = await api(page, 'POST', '/seguranca/iat', {
    obraId: obra.id, razaoSocial: 'Empreiteira X', nomeAcidentado: 'Fulano de Tal', cargoFuncao: 'Pedreiro', dataAcidente: '2026-11-20',
    horaAcidente: '09:30', tipoAcidente: 'Típico', localAcidente: 'Torre A', parteCorpo: '753030000', agenteCausador: '302010200',
    situacaoGeradora: '200004300', observacoes: 'Bateu a cabeça na viga.', duracaoTratamentoDias: 2,
  });
  expect(iat.status).toBe(201);

  await page.goto(`/#/admin/seguranca-iat/${iat.dados.id}`);
  await page.getByRole('button', { name: 'Enviar por e-mail' }).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByRole('heading', { name: 'Enviar IAT por e-mail' })).toBeVisible();
  await expect(dialogo.getByText('acidentes@unitaengenharia.com.br', { exact: true })).toBeVisible();
  await expect(page.getByText('Gerando o PDF para anexar')).toHaveCount(0);

  // O anexo vira link quando o PDF fica pronto.
  await expect(dialogo.getByRole('link', { name: /^IAT .*\.pdf$/ })).toBeVisible({ timeout: 20000 });
  await expect(dialogo.locator('.envio-anexo-preparando')).toHaveCount(0);

  await dialogo.getByRole('button', { name: 'Enviar e-mail' }).click();
  await expect(page.getByText('E-mail gravado (modo demonstração)')).toBeVisible();
  await expect(dialogo).toHaveCount(0);

  const salvo = await api(page, 'GET', `/seguranca/iat/${iat.dados.id}`);
  expect(salvo.dados.envios).toHaveLength(1);
  expect(salvo.dados.envios[0].para).toBe('acidentes@unitaengenharia.com.br');
  await api(page, 'DELETE', `/seguranca/iat/${iat.dados.id}`);
});

test('IAT: clicar em "Enviar e-mail" antes do PDF ficar pronto envia assim que ele fica pronto', async ({ page }) => {
  await entrar(page, DEV);
  const obra = (await api(page, 'GET', '/obras/cadastro')).dados.find((c) => c.id);
  const iat = await api(page, 'POST', '/seguranca/iat', {
    obraId: obra.id, razaoSocial: 'Empreiteira Y', nomeAcidentado: 'Ciclano', cargoFuncao: 'Armador', dataAcidente: '2026-11-21',
    horaAcidente: '10:00', tipoAcidente: 'Típico', localAcidente: 'Torre B', parteCorpo: '753030000', agenteCausador: '302010200',
    situacaoGeradora: '200004300', observacoes: 'Corte na mão.', duracaoTratamentoDias: 1,
  });
  await page.goto(`/#/admin/seguranca-iat/${iat.dados.id}`);
  await page.getByRole('button', { name: 'Enviar por e-mail' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Enviar e-mail' }).click();
  await expect(page.getByText('E-mail gravado (modo demonstração)')).toBeVisible({ timeout: 20000 });
  expect((await api(page, 'GET', `/seguranca/iat/${iat.dados.id}`)).dados.envios).toHaveLength(1);
  await api(page, 'DELETE', `/seguranca/iat/${iat.dados.id}`);
});
