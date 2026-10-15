/**
 * Modelo visual compartilhado pelos relatórios (identidade Unità): estilos, tela anotada e utilitários.
 * Os relatórios são gerados por `node docs/relatorios/gerar.mjs`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const POSICOES = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'img', 'posicoes.json'), 'utf8'));

export const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texto com marcação mínima: `codigo`, **negrito**. */
export const md = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

/**
 * Tela anotada: captura + retângulos numerados nas posições gravadas + legenda.
 * @param {string} nome  captura em img/<nome>.jpg
 * @param {Array<{n: number, titulo: string, texto?: string, origem?: string, calculo?: string}>} itens
 */
export function telaAnotada(nome, titulo, itens, { legenda = 'Pontos da tela' } = {}) {
  const pos = new Map((POSICOES[nome] ?? []).map((p) => [p.n, p]));
  const marcas = itens.map((i) => {
    const p = pos.get(i.n);
    if (!p || p.erro || p.w <= 0.005 || p.h <= 0.005) return ''; // fora da área visível da captura
    const pct = (v) => `${(v * 100).toFixed(2)}%`;
    return `<a class="marca" href="#${nome}-${i.n}" data-n="${i.n}" style="left:${pct(p.x)};top:${pct(p.y)};width:${pct(p.w)};height:${pct(p.h)}" aria-label="Ponto ${i.n}: ${esc(i.titulo)}"><b>${i.n}</b></a>`;
  }).join('');
  const lista = itens.map((i) => `
      <li id="${nome}-${i.n}" data-n="${i.n}">
        <span class="num">${i.n}</span>
        <div>
          <h4>${md(i.titulo)}</h4>
          ${i.texto ? `<p>${md(i.texto)}</p>` : ''}
          ${i.origem ? `<p class="origem"><span>Origem</span>${md(i.origem)}</p>` : ''}
          ${i.calculo ? `<p class="calculo"><span>Cálculo</span>${md(i.calculo)}</p>` : ''}
        </div>
      </li>`).join('');
  return `
  <figure class="tela" data-tela="${nome}">
    <div class="tela-quadro">
      <img src="img/${nome}.jpg" alt="${esc(titulo)}" loading="lazy" width="1600" height="900">
      ${marcas}
    </div>
    <figcaption>${esc(titulo)} <span>· captura com dados fictícios</span></figcaption>
  </figure>
  <section class="legenda" aria-label="${esc(legenda)}"><ol>${lista}</ol></section>`;
}

export function tabela(cabecalho, linhas) {
  return `<div class="tabela"><table><thead><tr>${cabecalho.map((c) => `<th>${md(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function pagina({ titulo, eyebrow, subtitulo, sumario, corpo }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
<style>
/* Relatório no padrão visual Unità v1.0: grafite + laranja como acento, Sora nos títulos, Inter no texto.
   Layout: faixa de capa grafite, sumário fixo à esquerda (telas largas) e telas anotadas com legenda numerada. */
:root {
  --laranja: #fe5000; --laranja-suave: #fff1ea; --grafite: #231f20;
  --fundo: #f8f7f6; --superficie: #ffffff; --borda: #e2dfdc; --texto: #1a1817; --apagado: #77716d; --codigo: #f0eeec;
  --info: #2563a8; --info-suave: #e8f0fa; --ok: #1e8a4c; --ok-suave: #e7f5ec;
  --sombra: 0 1px 2px rgb(26 24 23 / 0.04), 0 4px 18px rgb(26 24 23 / 0.06);
  --display: 'Sora', 'Inter', system-ui, sans-serif; --sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --fundo: #1a1817; --superficie: #2b2827; --borda: #3d3937; --texto: #f0eeec; --apagado: #a19b96; --codigo: #3d3937;
  --laranja-suave: #3a2418; --info-suave: #1d2a3a; --ok-suave: #1b2e22; color-scheme: dark; } }
:root[data-theme="dark"] {
  --fundo: #1a1817; --superficie: #2b2827; --borda: #3d3937; --texto: #f0eeec; --apagado: #a19b96; --codigo: #3d3937;
  --laranja-suave: #3a2418; --info-suave: #1d2a3a; --ok-suave: #1b2e22; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.6 var(--sans); -webkit-font-smoothing: antialiased; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; }
code { font: 12.5px ui-monospace, Consolas, monospace; background: var(--codigo); padding: 1px 5px; border-radius: 5px; overflow-wrap: anywhere; }
a { color: var(--laranja); }
.capa { background: var(--grafite); color: #fff; border-bottom: 3px solid var(--laranja); }
.capa .in { max-width: 1240px; margin: 0 auto; padding-block: 40px 44px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.capa .eyebrow { color: var(--laranja); font-size: 12px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
.capa h1 { font-size: clamp(28px, 4vw, 42px); margin-top: 8px; letter-spacing: -0.02em; }
.capa p { color: rgb(255 255 255 / .72); max-width: 70ch; margin: 10px 0 0; }
.capa .logo { height: 40px; width: auto; display: block; }
.corpo { max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 40px; padding-block: 32px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
nav.sumario { position: sticky; top: 16px; align-self: start; font-size: 13.5px; }
nav.sumario b { display: block; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--apagado); margin-bottom: 8px; }
nav.sumario a { display: block; color: var(--texto); text-decoration: none; padding: 5px 10px; border-left: 2px solid var(--borda); }
nav.sumario a:hover { border-left-color: var(--laranja); color: var(--laranja); }
main { min-width: 0; display: flex; flex-direction: column; gap: 20px; }
main > section.capitulo { display: flex; flex-direction: column; gap: 16px; scroll-margin-top: 16px; }
.capitulo + .capitulo { border-top: 1px solid var(--borda); padding-top: 36px; margin-top: 16px; }
.capitulo > h2 { font-size: 26px; letter-spacing: -0.01em; }
.capitulo > .rotulo { color: var(--laranja); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.capitulo h3 { font-size: 18px; margin-top: 8px; }
.capitulo p, .capitulo li { max-width: 78ch; }
.nota { background: var(--info-suave); border-left: 3px solid var(--info); padding: 12px 16px; border-radius: 10px; font-size: 14px; }
.validar { background: var(--laranja-suave); border-left: 3px solid var(--laranja); padding: 12px 16px; border-radius: 10px; font-size: 14px; }
.validar b:first-child, .nota b:first-child { display: block; margin-bottom: 2px; }
.passos { counter-reset: passo; list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.passos li { counter-increment: passo; position: relative; padding: 12px 16px 12px 52px; background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; }
.passos li::before { content: counter(passo); position: absolute; left: 14px; top: 12px; width: 26px; height: 26px; border-radius: 50%; background: var(--grafite); color: #fff; font: 600 13px/26px var(--display); text-align: center; }
.tela { margin: 0; }
.tela-quadro { position: relative; border-radius: 14px; overflow: hidden; box-shadow: var(--sombra); border: 1px solid var(--borda); background: var(--superficie); max-width: 100%; }
.tela-quadro img { display: block; width: 100%; height: auto; }
.marca { position: absolute; border: 2px solid var(--laranja); border-radius: 8px; background: rgb(254 80 0 / .06); transition: background .15s, box-shadow .15s; }
.marca b { position: absolute; left: -11px; top: -11px; min-width: 24px; height: 24px; padding: 0 6px; border-radius: 12px; background: var(--laranja); color: #fff; font: 700 12px/24px var(--display); text-align: center; box-shadow: 0 0 0 2px #fff; }
.marca:hover, .marca.ativa { background: rgb(254 80 0 / .18); box-shadow: 0 0 0 4px rgb(254 80 0 / .25); }
.tela figcaption { font-size: 13px; color: var(--apagado); margin-top: 8px; }
.tela figcaption span { opacity: .8; }
.legenda ol { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; }
.legenda li { display: flex; gap: 12px; background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; padding: 12px 14px; scroll-margin-top: 16px; transition: border-color .15s; min-width: 0; }
.legenda li.ativa, .legenda li:target { border-color: var(--laranja); box-shadow: 0 0 0 3px rgb(254 80 0 / .15); }
.legenda .num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 13px; background: var(--laranja); color: #fff; font: 700 12px/26px var(--display); text-align: center; }
.legenda li > div { min-width: 0; }
.legenda h4 { font-size: 14.5px; }
.legenda p { margin: 4px 0 0; font-size: 13.5px; color: var(--texto); }
.legenda .origem, .legenda .calculo { color: var(--texto); }
.legenda .origem span, .legenda .calculo span { display: inline-block; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 1px 7px; border-radius: 999px; margin-right: 6px; vertical-align: 1px; }
.legenda .origem span { background: var(--info-suave); color: var(--info); }
.legenda .calculo span { background: var(--ok-suave); color: var(--ok); }
.tabela { overflow-x: auto; border: 1px solid var(--borda); border-radius: 12px; background: var(--superficie); }
.tabela table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.tabela th, .tabela td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--borda); vertical-align: top; }
.tabela th { font-size: 12px; color: var(--apagado); font-weight: 600; background: var(--fundo); }
.tabela tr:last-child td { border-bottom: 0; }
.cartoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.cartao { background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; padding: 14px 16px; }
.cartao h4 { font-size: 15px; } .cartao p { margin: 6px 0 0; font-size: 13.5px; }
.cartao .papel { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--laranja); }
footer { text-align: center; color: var(--apagado); font-size: 12.5px; padding-block: 0 40px; }
@media (max-width: 900px) { .corpo { grid-template-columns: 1fr; } nav.sumario { position: static; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<header class="capa"><div class="in">
  <img class="logo" src="img/logo-unita-white.png" alt="Unità Engenharia" width="140" height="54">
  <div class="eyebrow" style="margin-top:18px">${esc(eyebrow)}</div>
  <h1>${esc(titulo)}</h1>
  <p>${md(subtitulo)}</p>
</div></header>
<div class="corpo">
  <nav class="sumario" aria-label="Sumário"><b>Sumário</b>${sumario.map(([id, nome]) => `<a href="#${id}">${esc(nome)}</a>`).join('')}</nav>
  <main>${corpo}</main>
</div>
<footer>Unità Engenharia · Planejamento e Controle · relatório gerado a partir da versão em desenvolvimento (capturas com dados fictícios)</footer>
<script>
// Destaca o par marca ↔ item da legenda ao passar o mouse ou focar.
document.querySelectorAll('.tela').forEach((tela) => {
  const legenda = tela.nextElementSibling;
  const alternar = (n, ligar) => {
    tela.querySelector('.marca[data-n="' + n + '"]')?.classList.toggle('ativa', ligar);
    legenda?.querySelector('li[data-n="' + n + '"]')?.classList.toggle('ativa', ligar);
  };
  for (const el of [...tela.querySelectorAll('.marca'), ...(legenda ? legenda.querySelectorAll('li') : [])]) {
    el.addEventListener('mouseenter', () => alternar(el.dataset.n, true));
    el.addEventListener('mouseleave', () => alternar(el.dataset.n, false));
    el.addEventListener('focus', () => alternar(el.dataset.n, true));
    el.addEventListener('blur', () => alternar(el.dataset.n, false));
  }
});
</script>
`;
}
