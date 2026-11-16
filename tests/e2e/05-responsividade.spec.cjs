/**
 * v29 — Regra de responsividade do app (docs/RESPONSIVIDADE.md): em qualquer tela, do celular ao telão,
 * - a página não rola para o lado (tabelas largas rolam dentro do próprio quadro);
 * - todas as abas do menu ficam visíveis (sem aba cortada) a partir de 761 px de largura;
 * - nenhum texto visível da página fica menor que 10 px (gráficos à parte: são desenhados em canvas).
 * Roda depois do 01 (Dev criado).
 */
const { DEV, entrar, expect, test } = require('./fixture.cjs');

const TELAS = [
  { largura: 390, altura: 844 }, // celular
  { largura: 1024, altura: 768 },
  { largura: 1280, altura: 720 },
  { largura: 1366, altura: 768 },
  { largura: 1440, altura: 900 }, // MacBook Air 13"
  { largura: 1920, altura: 1080 },
  { largura: 2560, altura: 1440 },
];
const ROTAS = ['/#/obra/inicio', '/#/cliente/inicio', '/#/obra/resumo-geral', '/#/obra/resumo-fisico', '/#/obra/resumo-economico', '/#/obra/fotos'];

/** Medidas da tela atual: rolagem lateral da página, abas cortadas e o menor texto visível. */
const medir = (page) => page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Abas da apresentação"]');
  const visivel = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('.sr-only, .oculto, [hidden]')) return false;
    const e = getComputedStyle(el);
    return e.visibility !== 'hidden' && e.display !== 'none' && Number(e.opacity) > 0;
  };
  let menor = { tamanho: Infinity, texto: '' };
  const raiz = document.querySelector('main.conteudo') ?? document.body;
  const caminhante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  for (let no = caminhante.nextNode(); no; no = caminhante.nextNode()) {
    const el = no.parentElement;
    if (!no.textContent.trim() || !el || !visivel(el)) continue;
    const tamanho = parseFloat(getComputedStyle(el).fontSize);
    if (tamanho < menor.tamanho) menor = { tamanho, texto: `${el.tagName.toLowerCase()}.${el.className} "${no.textContent.trim().slice(0, 30)}"` };
  }
  return {
    rolagemLateral: document.documentElement.scrollWidth - window.innerWidth,
    abasCortadas: nav ? nav.scrollWidth - nav.clientWidth : 0,
    menor,
  };
});

test('responsividade: sem rolagem lateral, abas inteiras e texto legível em todas as telas', async ({ page }) => {
  test.setTimeout(240000);
  await entrar(page, DEV);
  const problemas = [];
  for (const tela of TELAS) {
    await page.setViewportSize({ width: tela.largura, height: tela.altura });
    for (const rota of ROTAS) {
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(150);
      const m = await medir(page);
      const onde = `${tela.largura}×${tela.altura} ${rota}`;
      if (m.rolagemLateral > 1) problemas.push(`${onde}: página rola ${m.rolagemLateral}px para o lado`);
      if (tela.largura > 760 && m.abasCortadas > 1) problemas.push(`${onde}: abas do menu cortadas (${m.abasCortadas}px)`);
      if (m.menor.tamanho < 10) problemas.push(`${onde}: texto de ${m.menor.tamanho}px em ${m.menor.texto}`);
    }
  }
  expect(problemas, problemas.join('\n')).toEqual([]);
});
