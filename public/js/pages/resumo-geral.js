/**
 * Aba "Resumo Geral" — layout do Power BI: quadro CEF × Físico e Análise Econômica, três gráficos mês a mês,
 * custos por unidade, INCC, NH-NU e velocímetro. Em tela cheia os quadros ficam numa grade de 24 × 24 que
 * cobre a tela toda; o Dev move e redimensiona os quadros ("Editar layout") e o layout vale para todas as
 * apresentações (domain/layout-resumo.js, ui/editor-layout.js).
 *
 * v27 — Quadros responsivos: na grade, cada quadro de valores usa a maior fonte com que o conteúdo cabe no
 * tamanho dele (rótulos quebram linha; Análise econômica em 1, 2 ou 3 colunas e Custos por em 4, 2 × 2 ou 1,
 * o arranjo que permitir a fonte maior) e recalcula ao mudar de tamanho — inclusive enquanto o Dev redimensiona.
 * Os gráficos ajustam a fonte dos eixos ao próprio tamanho. A exportação em PDF usa o mesmo ajuste.
 */
import { h, montar } from '../core/dom.js';
import { api } from '../core/api.js';
import { estado } from '../core/estado.js';
import {
  classeSinal, fmtData, fmtIndice, fmtMes, fmtMoeda, fmtNumero, fmtPercentual, fmtVariacao, VAZIO,
} from '../core/formato.js';
import {
  ajustarEscala, ESCALA_FONTE, LAYOUT_PADRAO, normalizarEscalas, normalizarLayout, QUADROS, visivel,
} from '../domain/layout-resumo.js';
import { pode } from '../domain/permissoes.js';
import { calcularResumoGeral } from '../domain/resumo-geral.js';
import { card, cardTitulo, seloCompetencia, toast, vazio } from '../ui/componentes.js';
import { abrirDetalheGrafico } from '../ui/detalhe-grafico.js';
import { aplicarLayout, editarLayout } from '../ui/editor-layout.js';
import { editarOrdemAbas } from '../ui/ordenar-abas.js';
import { grafico } from '../ui/graficos.js';
import { velocimetro } from '../ui/velocimetro.js';
import { icone } from '../ui/icones.js';
import { abrirInfosObra } from './infos-obra.js';

export function renderResumoGeral(alvo, { base, filtro, usuario }) {
  if (!filtro.obras.length) return montar(alvo, vazio('Selecione uma obra no filtro'));
  const r = calcularResumoGeral(base, filtro);
  const nomes = base.obras.filter((o) => filtro.obras.includes(o.chave)).map((o) => o.nome);

  const curva = h('div', { class: 'grafico-area' });
  const barras = h('div', { class: 'grafico-area' });
  const assertividade = h('div', { class: 'grafico-area' });

  // Definições dos três gráficos: usadas no quadro e no "Detalhe" (v29), que abre o gráfico em tela cheia.
  const { meses } = r.graficos;
  const graficos = {
    curva: {
      tipo: 'line', meses, referencia: r.referencia, fonteProporcional: true,
      series: [
        { rotulo: 'Previsto original', valores: r.graficos.curvaAcumulada.previstoOriginal, cor: '--series-3', tracejada: true },
        { rotulo: 'Realizado', valores: r.graficos.curvaAcumulada.realizado, cor: '--series-2', marcadores: true, linha: true, rotulos: 'acima' },
        { rotulo: 'Planejado atual', valores: r.graficos.curvaAcumulada.planejadoAtual, cor: '--series-1', linha: true, rotulos: 'abaixo' },
      ],
    },
    barras: {
      tipo: 'bar', meses, referencia: r.referencia, fonteProporcional: true,
      series: [
        { rotulo: 'Realizado', valores: r.graficos.realizadoPlanejadoMes.realizado, cor: '--series-2' },
        { rotulo: 'Planejado atual', valores: r.graficos.realizadoPlanejadoMes.planejado, cor: '--series-1' },
      ],
    },
    assertividade: {
      tipo: 'bar', meses, referencia: r.referencia, descricao: 'Assertividade mensal', minimoMax: 1, fonteProporcional: true, // eixo vai ao menos a 100%
      series: [{ rotulo: 'Assertividade', valores: r.graficos.assertividade, cor: '--series-1' }],
    },
  };
  /** Título do quadro de gráfico com o botão "Detalhe" logo ao lado (a legenda fica à direita). */
  // v31: Dev aumenta/diminui a fonte de cada quadro (A− / A+); vale para todas as apresentações e para o PDF.
  const ehDev = pode(usuario?.papel, 'administrar');
  const escalas = normalizarEscalas(estado.bruto?.escalasResumoGeral);
  const fonte = (id) => (ehDev ? controlesFonte(id, escalas, () => ajustar()) : null);
  const tituloGrafico = (id, texto) => [texto, h('button', {
    class: 'rg-detalhe', type: 'button', 'data-teste': `detalhe-${id}`, title: 'Abrir o gráfico em tela cheia com a tabela dos meses',
    onclick: () => abrirDetalheGrafico({ titulo: texto, def: graficos[id] }),
  }, icone('telaCheia', { tamanho: 14 }), 'Detalhe'), fonte(id)];
  const cartao = (id, titulo, conteudo, extra = null, classe = '') => {
    conteudo.classList.add('rg-conteudo'); // v27: é a fonte deste bloco que se ajusta ao tamanho do quadro
    // Título dos quadros de valores ganha os botões de fonte; no CEF × Físico (sem título) eles ficam soltos no canto.
    const comFonte = titulo && !Array.isArray(titulo) ? [titulo, fonte(id)] : titulo;
    const solto = titulo ? null : fonte(id);
    solto?.classList.add('rg-fonte-solta');
    const cartaoEl = card({ class: `rg-cartao ${classe}`, dataset: { quadro: id } }, titulo ? cardTitulo(comFonte, extra) : solto, conteudo);
    definirEscala(cartaoEl, escalas[id]);
    return cartaoEl;
  };
  const quadros = {
    cef: cartao('cef', null, quadroCefFisico(r.painelFisico), null, 'rg-cef'),
    economica: cartao('economica', 'Análise econômica', analiseEconomica(r.economico), h('span', { class: 'muted small' }, fmtMes(r.referencia)), 'rg-economica'),
    curva: cartao('curva', tituloGrafico('curva', 'Curva acumulada atual × original'), curva, null, 'rg-grafico'),
    barras: cartao('barras', tituloGrafico('barras', 'Realizado × planejado (mês)'), barras, null, 'rg-grafico'),
    assertividade: cartao('assertividade', tituloGrafico('assertividade', 'Assertividade'), assertividade, null, 'rg-grafico'),
    custos: cartao('custos', 'Custos por (R$)', custosPor(r.custosPor), h('span', { class: 'muted small' }, 'sem correção'), 'rg-custos'),
    incc: cartao('incc', 'INCC', incc(r.incc), null, 'rg-incc'),
    nhnu: cartao('nhnu', 'NH-NU', h('div', { class: 'rg-numero' }, h('b', { class: 'tab' }, fmtNumero(r.nhnu, 1)), h('small', { class: 'muted' }, 'Homens/mês × UH × realizado mês ÷ 100')), null, 'rg-nhnu'),
    andamento: cartao('andamento', 'Andamento geral', velocimetro(r.andamento), null, 'rg-andamento'),
  };
  const corpo = h('div', { class: 'rg-corpo' }, QUADROS.filter((q) => visivel(q.id)).map((q) => quadros[q.id]) /* v28: QUADROS_OCULTOS em domain/layout-resumo.js */);
  let layout = normalizarLayout(estado.bruto?.layoutResumoGeral ?? LAYOUT_PADRAO);
  aplicarLayout(corpo, layout); // v30: o PDF sai com o mesmo layout da tela (o do "Editar layout")

  const acoes = h('div', { class: 'row' },
    seloCompetencia(r.referencia, { compacto: true }),
    nomes.length === 1 ? h('button', { class: 'btn secondary sm', type: 'button', onclick: () => abrirInfosObra(base, filtro.obras[0]) }, '+ Infos da obra') : null);
  const pagina = h('div', { class: 'rg' },
    h('div', { class: 'rg-titulo' },
      h('h1', {}, nomes.length === 1 ? nomes[0] : `${nomes.length} obras`,
        nomes.length > 1 ? h('small', {}, 'percentuais ponderados pelo orçamento; R$ somados') : null),
      acoes),
    corpo);

  // Dev: "Editar layout" troca as ações do título pela barra de edição até salvar ou cancelar.
  // v28: com a edição ligada, as abas do menu superior também podem ser arrastadas para mudar a ordem.
  if (pode(usuario?.papel, 'administrar')) {
    const botaoEditar = h('button', {
      class: 'btn ghost sm so-edicao rg-editar', type: 'button', 'data-teste': 'editar-layout',
      onclick: () => {
        const menu = document.querySelector('nav[aria-label="Abas da apresentação"]');
        const abas = menu ? editarOrdemAbas(menu) : null;
        const ordemOriginal = abas?.ordem() ?? [];
        let salvou = false;
        const barra = editarLayout({
          pagina, corpo, layout,
          aoMudar: ajustar,
          aoRestaurarPadrao: () => abas?.restaurarPadrao(),
          aoSalvar: async (novo) => {
            try {
              const { layout: gravado } = await api.put('/layouts/resumo-geral', { layout: novo });
              if (estado.bruto) estado.bruto.layoutResumoGeral = gravado;
              if (abas) {
                const { ordem } = await api.put('/layouts/abas', { ordem: abas.ordem() });
                if (estado.bruto) estado.bruto.ordemAbas = ordem;
              }
              toast('success', 'Layout salvo para todas as apresentações');
              salvou = true;
              return true;
            } catch (e) {
              toast('error', 'Não foi possível salvar o layout', e.message);
              return false;
            }
          },
          aoTerminar: (final) => {
            if (abas && !salvou) abas.restaurar(ordemOriginal); // cancelou: o menu volta à ordem de antes
            abas?.terminar();
            layout = final;
            barra.replaceWith(acoes);
          },
        });
        acoes.replaceWith(barra);
      },
    }, icone('grade', { tamanho: 16 }), 'Editar layout');
    acoes.prepend(botaoEditar);
  }

  montar(alvo, pagina);
  const ajustar = ajustarAlturaATela(pagina);

  grafico(curva, graficos.curva);
  grafico(barras, graficos.barras);
  grafico(assertividade, graficos.assertividade);
}

// ── v31: escala da fonte por quadro (Dev) ─────────────────────────────
/** Escala do quadro (1 = fonte da tela), guardada no próprio cartão para o ajuste e os gráficos lerem. */
export const escalaDoQuadro = (cartao) => parseFloat(cartao?.style.getPropertyValue('--escala-fonte')) || 1;

function definirEscala(cartao, escala = 1) {
  if (escala === 1) cartao.style.removeProperty('--escala-fonte');
  else cartao.style.setProperty('--escala-fonte', String(escala));
}

/** Grava as escalas pouco depois do último clique (vários cliques seguidos = uma gravação). */
let gravacaoEscalas = 0;
function salvarEscalas(escalas) {
  clearTimeout(gravacaoEscalas);
  gravacaoEscalas = setTimeout(async () => {
    try {
      const { escalas: gravadas } = await api.put('/layouts/escalas-fonte', { escalas });
      if (estado.bruto) estado.bruto.escalasResumoGeral = gravadas;
    } catch (e) {
      toast('error', 'Não foi possível salvar o tamanho da fonte', e.message);
    }
  }, 600);
}

/** Botões A− / % / A+ do quadro (como o "Detalhe" dos gráficos). Clicar no % volta a 100%. */
function controlesFonte(id, escalas, aoMudar) {
  const rotulo = h('button', { class: 'rg-fonte-valor', type: 'button', title: 'Voltar a fonte deste quadro para 100%' });
  const grupo = h('span', { class: 'rg-fonte', 'data-teste': `fonte-${id}`, role: 'group', 'aria-label': 'Tamanho da fonte do quadro' });
  const mostrar = () => { rotulo.textContent = `${Math.round((escalas[id] ?? 1) * 100)}%`; };
  const mudar = (nova) => {
    const e = ajustarEscala(nova);
    if (e === 1) delete escalas[id];
    else escalas[id] = e;
    definirEscala(grupo.closest('.rg-cartao'), e);
    mostrar();
    aoMudar();
    salvarEscalas({ ...escalas });
  };
  rotulo.onclick = () => mudar(1);
  grupo.append(
    h('button', { type: 'button', title: 'Diminuir a fonte deste quadro', 'aria-label': 'Diminuir fonte', onclick: () => mudar((escalas[id] ?? 1) - ESCALA_FONTE.passo) }, 'A−'),
    rotulo,
    h('button', { type: 'button', title: 'Aumentar a fonte deste quadro', 'aria-label': 'Aumentar fonte', onclick: () => mudar((escalas[id] ?? 1) + ESCALA_FONTE.passo) }, 'A+'),
  );
  mostrar();
  return grupo;
}

/**
 * A página ocupa exatamente a altura livre da janela (sem barra de rolagem) e a grade dos quadros cobre todo
 * o espaço. Em telas pequenas (largura < 1100 px ou altura < 620 px) os quadros voltam a ficar um abaixo do
 * outro, com rolagem (e sem a edição de layout).
 */
function ajustarAlturaATela(pagina) {
  // Exportação em PDF: sempre a grade, com a altura de uma página A4 paisagem (css/impressao.css); a fonte dos
  // quadros é ajustada pelo exportar-pdf.js (enquadrarResumoGeral), que conhece o tamanho final da página.
  if (pagina.closest('.impressao')) {
    pagina.classList.add('rg-tela');
    return () => {};
  }
  // v27: os quadros reajustam a fonte quando algum muda de tamanho (janela, edição do layout). v29: a fonte é
  // uma só para a tela inteira, então qualquer mudança refaz o ajuste de todos (uma vez por quadro de animação).
  let agendado = 0;
  const observador = new ResizeObserver(() => {
    if (!pagina.isConnected) return observador.disconnect();
    if (!pagina.classList.contains('rg-tela')) return;
    cancelAnimationFrame(agendado);
    agendado = requestAnimationFrame(() => ajustarQuadros(pagina));
  });
  for (const c of pagina.querySelectorAll('.rg-cartao')) observador.observe(c);
  const ajustar = () => {
    if (!pagina.isConnected) return window.removeEventListener('resize', ajustar);
    const cabe = window.innerWidth >= 1100 && window.innerHeight >= 620;
    pagina.classList.toggle('rg-tela', cabe);
    // v29: em telas muito baixas (ex.: 1280×720) a grade não fica menor que ALTURA_MINIMA_GRADE: a página rola um
    // pouco, mas gráficos e valores continuam legíveis. Do 1366×768 para cima continua cabendo sem rolagem.
    const livre = Math.floor(window.innerHeight - pagina.getBoundingClientRect().top - 16);
    pagina.style.height = cabe ? `${Math.max(livre, ALTURA_MINIMA_GRADE)}px` : '';
    if (cabe) {
      ajustarQuadros(pagina);
      // v30: guarda a proporção da grade como ela aparece na tela — o PDF sai com a mesma (sem esticar na vertical)
      const corpo = pagina.querySelector('.rg-corpo');
      if (corpo?.clientHeight) proporcaoVista = corpo.clientWidth / corpo.clientHeight;
    } else limparAjuste(pagina);
  };
  window.addEventListener('resize', ajustar);
  requestAnimationFrame(ajustar);
  ajustar();
  // v29: na primeira carga as fontes da página podem chegar depois do ajuste; o texto cresce e o quadro cortava.
  document.fonts?.ready.then(() => { if (pagina.isConnected) ajustar(); });
  return ajustar;
}

/**
 * v27 — Fonte (px) dos quadros de valores: entre o mínimo legível e o máximo, a maior com que o conteúdo cabe.
 * Na impressão os limites são menores (a página A4 é mais densa que a tela).
 */
/** v29 — Altura mínima (px) da grade do Resumo Geral na tela. */
const ALTURA_MINIMA_GRADE = 500;

/** v30 — Proporção (largura ÷ altura) da grade na última vez que o Resumo Geral apareceu na tela. */
let proporcaoVista = null;

/**
 * v30 — Proporção da grade do Resumo Geral na tela de quem está usando o app: a medida da última vez que ele
 * apareceu ou, se ainda não apareceu nesta sessão, a estimada para a janela atual (mesma conta da tela:
 * largura útil × altura livre abaixo do cabeçalho, da barra de filtros e do título). O PDF usa essa proporção
 * para os quadros saírem como na tela — com a da folha A4 (mais alta), ficavam esticados na vertical.
 */
export function proporcaoNaTela() {
  if (proporcaoVista) return proporcaoVista;
  const cabecalho = document.querySelector('.app-header')?.offsetHeight ?? 56;
  const filtros = document.querySelector('.filtros')?.offsetHeight ?? 69;
  const TITULO_E_MARGENS = 20 + 16 + 58; // padding do conteúdo, folga do pé e linha do título com o espaço da grade
  const largura = window.innerWidth - 48;
  const altura = Math.max(ALTURA_MINIMA_GRADE, window.innerHeight - cabecalho - filtros - TITULO_E_MARGENS);
  return largura / altura;
}

// v29: máximo da tela 18 px — com a fonte global, títulos e gráficos usam o mesmo tamanho dos valores.
// v30: `folga` (PDF) — sobra de espaço para o texto que, reduzido com a página, quebra um pouco diferente.
export const FONTE_QUADRO = Object.freeze({ tela: { min: 10, max: 18 }, impressao: { min: 9, max: 18, folga: 0.94 } });

/** Arranjos alternativos por quadro (classe no conteúdo); o primeiro é o padrão, usado em caso de empate. */
const ARRANJOS = {
  economica: ['colunas-2', 'colunas-3', 'colunas-1'],
  custos: ['', 'custos-2x2', 'custos-1'],
};
/** Quadros sem texto a ajustar: gráficos (ajustam a própria fonte) e o velocímetro (SVG que acompanha o quadro). */
const SEM_AJUSTE = new Set(['curva', 'barras', 'assertividade', 'andamento']);

const cortado = (el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
/** v29: caixas internas que também não podem transbordar (ex.: os valores de "Custos por" dentro do fundo). */
const CAIXAS_INTERNAS = '.custo-item';
const quadroCabe = (cartao, conteudo) => !cortado(cartao) && !cortado(conteudo) && ![...conteudo.querySelectorAll(CAIXAS_INTERNAS)].some(cortado);

function aplicarArranjo(conteudo, arranjos, escolhido) {
  for (const a of arranjos) if (a) conteudo.classList.toggle(a, a === escolhido);
}

/** Maior fonte em que nada do quadro fica cortado, ou null se nem a mínima couber. */
function maiorFonte(cartao, conteudo, { min, max }) {
  const cabe = (f) => {
    conteudo.style.fontSize = `${f}px`;
    return quadroCabe(cartao, conteudo);
  };
  if (!cabe(min)) return null;
  let [menor, maior] = [min, max];
  if (cabe(max)) return max;
  while (maior - menor > 0.25) {
    const meio = (menor + maior) / 2;
    if (cabe(meio)) menor = meio;
    else maior = meio;
  }
  return Math.floor(menor * 4) / 4;
}

/** Quadros de valores (com texto a ajustar) da página, com o conteúdo e os arranjos possíveis de cada um. */
const quadrosDeValores = (pagina) => [...pagina.querySelectorAll('.rg-cartao')]
  .map((cartao) => ({ cartao, conteudo: cartao.querySelector(':scope > .rg-conteudo'), arranjos: ARRANJOS[cartao.dataset.quadro] ?? [''] }))
  .filter((q) => q.conteudo && !SEM_AJUSTE.has(q.cartao.dataset.quadro));

/** Maior fonte do quadro, no melhor arranjo (null se nem a mínima couber). */
function maiorFonteDoQuadro({ cartao, conteudo, arranjos }, limites) {
  let melhor = null;
  for (const a of arranjos) {
    aplicarArranjo(conteudo, arranjos, a);
    const fonte = maiorFonte(cartao, conteudo, limites);
    if (fonte !== null && (melhor === null || fonte > melhor + 0.5)) melhor = fonte;
  }
  return melhor;
}

/** Primeiro arranjo em que o quadro cabe na fonte `f` (null se nenhum). Deixa o quadro nesse arranjo e fonte. */
function arranjoNaFonte({ cartao, conteudo, arranjos }, f) {
  conteudo.style.fontSize = `${f}px`;
  for (const a of arranjos) {
    aplicarArranjo(conteudo, arranjos, a);
    if (quadroCabe(cartao, conteudo)) return a;
  }
  return null;
}

/**
 * v29 — Fonte global do Resumo Geral: todos os quadros de valores, os títulos dos quadros e os textos dos
 * gráficos usam UM tamanho só — o maior com que todos os quadros cabem (cada um no seu melhor arranjo). O tamanho
 * vai para `--fonte-rg` (base de toda a tela, css/paginas.css) e os gráficos o leem (ui/graficos.js).
 * Devolve true se todos couberam; quem não coube nem na mínima fica `apertado` (rola por dentro; no PDF a página
 * é ampliada até caber).
 */
export function ajustarQuadros(pagina, limites = FONTE_QUADRO.tela) {
  const quadros = quadrosDeValores(pagina);
  // v30: com `folga` (PDF), tudo precisa caber numa fonte um pouco maior (÷ folga) e a fonte usada é essa × folga,
  // no mesmo arranjo — sobra espaço para o texto que, reduzido com a página, quebra um pouco diferente.
  const folga = limites.folga ?? 1;
  const busca = { min: limites.min / folga, max: limites.max / folga };
  const definir = (f) => (f === null ? pagina.style.removeProperty('--fonte-rg') : pagina.style.setProperty('--fonte-rg', `${f}px`));
  pagina.classList.remove('com-escala'); // v31: a fonte global é calculada sem as escalas dos quadros
  const menorDosMaiores = () => Math.min(busca.max, ...quadros.map((q) => maiorFonteDoQuadro(q, busca) ?? busca.min));
  // 1ª estimativa com os títulos no tamanho padrão; 2ª com os títulos já na fonte estimada (eles ocupam espaço).
  definir(null);
  let fonte = menorDosMaiores();
  definir(fonte);
  fonte = menorDosMaiores();
  // Confirma com tudo na mesma fonte (títulos inclusive); se algo não couber, desce de 0,25 em 0,25 px.
  const todosCabem = (f) => { definir(f); return quadros.every((q) => arranjoNaFonte(q, f) !== null); };
  while (fonte > busca.min && !todosCabem(fonte)) fonte = Math.max(busca.min, fonte - 0.25);
  definir(fonte);
  const arranjos = quadros.map((q) => arranjoNaFonte(q, fonte));
  const final = folga < 1 ? Math.max(limites.min, Math.floor(fonte * folga * 4) / 4) : fonte;
  definir(final);
  pagina.classList.add('com-escala');
  let todos = true;
  quadros.forEach((q, i) => {
    // v31: quadro com escala — menor: a fonte global × escala; maior: até a global × escala, se couber.
    const e = escalaDoQuadro(q.cartao);
    let fq = final;
    let arranjo = arranjos[i];
    if (e !== 1) {
      const alvo = Math.round(final * e * 4) / 4;
      fq = e < 1 ? alvo : (maiorFonteDoQuadro(q, { min: final, max: alvo }) ?? final);
      arranjo = arranjoNaFonte(q, fq);
    }
    aplicarArranjo(q.conteudo, q.arranjos, arranjo ?? q.arranjos[0]);
    q.conteudo.style.fontSize = `${fq}px`;
    const coube = arranjo !== null && quadroCabe(q.cartao, q.conteudo);
    q.cartao.classList.toggle('apertado', !coube);
    todos = todos && coube;
  });
  // Gráficos acompanham a fonte global (redesenho sem animação).
  for (const canvas of pagina.querySelectorAll('canvas')) window.Chart?.getChart(canvas)?.update('none');
  return todos;
}

/** Telas pequenas (um quadro abaixo do outro): volta à fonte e ao arranjo padrão. */
function limparAjuste(pagina) {
  pagina.style.removeProperty('--fonte-rg');
  pagina.classList.remove('com-escala');
  for (const c of pagina.querySelectorAll('.rg-cartao')) {
    c.classList.remove('apertado');
    const conteudo = c.querySelector(':scope > .rg-conteudo');
    if (!conteudo) continue;
    conteudo.style.fontSize = '';
    aplicarArranjo(conteudo, ARRANJOS[c.dataset.quadro] ?? [''], null);
  }
}

/** Quadro CEF × Físico — mês de referência e mês seguinte. */
/** Desvio como selo colorido com seta (status nunca só pela cor). */
function seloDesvio(v) {
  if (typeof v !== 'number') return VAZIO;
  const tipo = Math.abs(v) < 0.0005 ? 'neutro' : v > 0 ? 'ok' : 'ruim';
  return h('span', { class: `selo-desvio ${tipo}`, title: tipo === 'ok' ? 'Adiantado' : tipo === 'ruim' ? 'Atrasado' : 'No planejado' },
    tipo === 'ok' ? '▲' : tipo === 'ruim' ? '▼' : '■', fmtPercentual(Math.abs(v), 1));
}

function quadroCefFisico(p) {
  const linha = (rotulo, cef, fisico, desvio = false) => h('tr', { class: desvio ? 'desvio' : '' },
    h('td', { class: 'rot' }, rotulo),
    h('td', {}, desvio ? seloDesvio(cef) : fmtPercentual(cef, 1)),
    h('td', {}, desvio ? seloDesvio(fisico) : fmtPercentual(fisico, 1)));
  const grupo = (texto, linhas) => [
    h('tr', {}, h('th', { class: 'grupo', rowspan: linhas.length + 1, scope: 'rowgroup' }, texto)),
    ...linhas,
  ];
  const { atual, proximo } = p;
  return h('div', { class: 'rg-cef-conteudo' },
    h('table', { class: 'cef-fisico', 'aria-label': 'Quadro CEF e Físico' },
      h('thead', {}, h('tr', {}, h('th', {}), h('th', {}),
        h('th', { scope: 'col' }, h('span', { class: 'pilula cef' }, 'CEF')),
        h('th', { scope: 'col' }, h('span', { class: 'pilula fisico' }, 'Físico')))),
      h('tbody', {},
        grupo(fmtMes(p.referencia), [
          linha('Avanço mês', atual.cef.avancoMes, atual.fisico.avancoMes),
          linha('Avanço acm', atual.cef.avancoAcm, atual.fisico.avancoAcm),
          linha('Cronograma', atual.cef.cronograma, atual.fisico.cronograma),
          linha('Previsto (rep1) acm', atual.cef.previsto, atual.fisico.previsto),
          linha('Desvio', atual.cef.desvio, atual.fisico.desvio, true),
        ]),
        grupo(fmtMes(p.seguinte), [
          linha('Projetado mês', proximo.cef.projetadoMes, proximo.fisico.projetadoMes),
          linha('Projetado acm', proximo.cef.projetadoAcm, proximo.fisico.projetadoAcm),
          linha('Cronograma', proximo.cef.cronograma, proximo.fisico.cronograma),
          linha('Previsto (rep1) acm', proximo.cef.previsto, proximo.fisico.previsto),
          linha('Desvio', proximo.cef.desvio, proximo.fisico.desvio, true),
        ]))),
    p.temCef ? null : h('p', { class: 'muted small rg-nota', style: { marginTop: '6px' } }, 'Obra sem curva CEF: valores CEF zerados.'));
}

function analiseEconomica(e) {
  const itens = [
    ['Orçado (R$)', fmtMoeda(e.orcado)],
    ['Projetado (R$)', fmtMoeda(e.projetado)],
    ['Desvio (R$)', fmtMoeda(e.desvio), classeSinal(e.desvio)],
    ['IEC', e.iec === null ? VAZIO : fmtNumero(e.iec, 4)],
    ['% de indireto', fmtPercentual(e.percIndireto)],
    ['Custo pago e a pagar (R$)', fmtMoeda(e.custoPagoAPagar)],
    ['Saldos OCs e contratos (R$)', fmtMoeda(e.saldosOcContratos)],
    ['Orç. de término (R$)', fmtMoeda(e.orcamentoTermino)],
    ['Passível de reajuste (R$)', fmtMoeda(e.passivelReajuste)],
    ['Total de aditivos (R$)', fmtMoeda(e.totalAditivos)],
    ['Aditivos aprovados (R$)', fmtMoeda(e.aditivosAprovados)],
    ['Aditivos à aprovar (R$)', fmtMoeda(e.aditivosAAprovar)],
    ['Custos não incidentes (R$)', fmtMoeda(e.custosNaoIncidentes)],
  ];
  // Grade de 2 colunas (rótulo sobre o valor): cabe na altura da tela junto com o quadro CEF × Físico.
  return h('dl', { class: 'economia-grade' }, itens.map(([rotulo, valor, classe]) => h('div', {}, h('dt', { title: rotulo }, rotulo), h('dd', { class: classe ?? '' }, valor))));
}

function custosPor(c) {
  const item = (sigla, nome, valor) => h('div', { class: 'custo-item', title: `${nome}: ${fmtMoeda(valor)}` }, h('span', { class: 'sigla' }, sigla), h('b', { class: 'tab' }, fmtMoeda(valor)), h('small', {}, nome));
  return h('div', {},
    h('div', { class: 'custos-por' },
      item('UH', 'por unidade', c.uh), item('AE', 'por m² equivalente', c.ae), item('AP', 'por m² privativo', c.ap), item('AC', 'por m² construído', c.ac)),
    c.uh === null && c.ae === null ? h('p', { class: 'muted small rg-nota', style: { marginTop: '8px' } }, 'Preencha Nº de UH e áreas no cadastro da obra.') : null);
}

function incc(i) {
  return h('dl', { class: 'lista-valores' },
    h('dt', {}, 'Base'), h('dd', {}, fmtIndice(i.base)),
    h('dt', {}, `Atual (${fmtMes(i.mesAtual)})`), h('dd', {}, fmtIndice(i.atual)),
    h('dt', {}, '% reajuste'), h('dd', {}, typeof i.reajuste === 'number' ? h('span', { class: 'selo-desvio info' }, fmtVariacao(i.reajuste)) : VAZIO),
    i.dataBase ? [h('dt', { class: 'muted small' }, 'Data-base'), h('dd', { class: 'muted small' }, fmtData(i.dataBase))] : null);
}
