/**
 * Dashboard Segurança → botão **Pirâmide de Bird** (primeiro indicador, antes de "Nº de acidentes por período").
 * Níveis (domain/seguranca.js → PIRAMIDE_BIRD): FT = acidente grave, CPT + SPT = lesão leve, TRJ = dano material,
 * QA = quase acidente. Usa os indicadores já carregados pelo Dashboard (mesmos filtros de obras e ano).
 */
import { h } from '../core/dom.js';
import { fmtNumero, fmtPercentual, VAZIO } from '../core/formato.js';
import { calcularPiramideBird, SIGLA_QUASE } from '../domain/seguranca.js';
import { vazio } from '../ui/componentes.js';
import { seloTipo } from './admin-seguranca.js';

/** Siglas do nível, cada uma na cor da classificação do acidente (CPT azul, SPT verde, TRJ laranja, FT vermelho, QA amarelo). */
const siglas = (n) => h('span', { class: 'bird-siglas' }, (n.tipos ?? [n.tipo]).map(seloTipo));
const num = (v, casas = 0) => (typeof v === 'number' ? fmtNumero(v, casas) : VAZIO);
/** Número com 1 casa quando pequeno e sem casas quando grande (proporções e esperados). */
const prop = (v) => (typeof v !== 'number' ? VAZIO : fmtNumero(v, v !== 0 && Math.abs(v) < 100 && !Number.isInteger(v) ? 1 : 0));

/**
 * Conteúdo do botão "Pirâmide de Bird" do Dashboard Segurança.
 * @param {object} ind  indicadores de GET /api/seguranca/indicadores (já com os filtros de obras e ano)
 */
export function conteudoPiramideBird(ind) {
  const p = calcularPiramideBird({ ...Object.fromEntries(ind.porTipo.map((t) => [t.rotulo, t.valor])), [SIGLA_QUASE]: ind.quaseAcidentes });
  if (!p.total) return vazio('Nenhuma ocorrência registrada', 'Não há registros para as obras e anos selecionados.');
  const ancora = p.niveis.find((n) => n.ancora);
  const [, , dano, quase] = p.niveis;

  // ── Indicadores da pirâmide (o total já está no quadro de totais do Dashboard) ──
  const kpi = (rotulo, valor, detalhe) => h('div', { class: 'bird-kpi' }, h('p', { class: 'l' }, rotulo), h('b', { class: 'v' }, valor), h('small', {}, detalhe));
  const totais = h('div', { class: 'bird-kpis' },
    kpi('Proporção observada', h('span', { class: 'bird-proporcao' }, p.niveis.map((n, i) => [i ? h('i', {}, ':') : null, prop(n.proporcaoObservada)])),
      'Bird: 1 : 10 : 30 : 600'),
    kpi('Índice de gravidade', fmtPercentual(p.gravidade, 1), 'ocorrências com lesão (grave + leve)'),
    kpi('Quase acidentes por acidente com lesão', num(p.basePorLesao, 2), `Bird espera ${num(p.basePorLesaoBird, 1)}`));

  // ── Pirâmide (4 faixas de um triângulo) + rótulos ──
  const faixas = p.niveis.map((n, i) => {
    const topo = i / 4;
    const base = (i + 1) / 4;
    const lado = (y) => `${50 - y * 50}%`;
    const ladoD = (y) => `${50 + y * 50}%`;
    return h('div', {
      class: `bird-faixa ${n.ancora ? 'ancora' : ''}`,
      style: { background: `var(${n.cor})`, clipPath: `polygon(${lado(topo)} 0, ${ladoD(topo)} 0, ${ladoD(base)} 100%, ${lado(base)} 100%)` },
      title: `${n.nome}: ${n.ocorrencias}`,
    }, h('span', {}, num(n.ocorrencias)));
  });
  const rotulos = p.niveis.map((n) => h('div', { class: 'bird-rotulo' },
    h('div', { class: 'bird-rotulo-topo' },
      h('i', { class: 'seg-marca', style: { background: `var(${n.cor})` } }),
      h('b', {}, n.nome), siglas(n)),
    h('small', {}, n.descricao),
    h('div', { class: 'bird-rotulo-numeros' },
      h('span', {}, h('b', {}, num(n.ocorrencias)), ' registradas'),
      h('span', {}, h('b', {}, prop(n.esperado)), ' esperadas por Bird'),
      h('span', { class: `bird-cobertura ${n.cobertura === null ? '' : n.cobertura >= 1 ? 'ok' : 'baixa'}` }, n.cobertura === null ? VAZIO : `${fmtPercentual(n.cobertura, 0)} do esperado`))));

  // ── Tabela dos níveis ──
  const tabela = h('div', { class: 'sheet bird-tabela' }, h('table', {},
    h('thead', {}, h('tr', {}, ['Nível', 'Classificação da pirâmide', 'Classificação do acidente', 'Registradas', '% do total', 'Proporção observada', 'Proporção Bird', 'Esperadas por Bird', 'Registradas ÷ esperadas'].map((t) => h('th', {}, t)))),
    h('tbody', {}, p.niveis.map((n) => h('tr', { class: n.ancora ? 'bird-linha-ancora' : '' },
      h('td', {}, n.nivel),
      h('td', { class: 'esq' }, h('i', { class: 'seg-marca', style: { background: `var(${n.cor})` } }), n.nome),
      h('td', { class: 'esq' }, siglas(n)),
      h('td', {}, num(n.ocorrencias)),
      h('td', {}, fmtPercentual(n.percentual, 1)),
      h('td', {}, prop(n.proporcaoObservada)),
      h('td', {}, num(n.proporcao)),
      h('td', {}, prop(n.esperado)),
      h('td', {}, n.cobertura === null ? VAZIO : fmtPercentual(n.cobertura, 1)))))));

  // ── Por ano ──
  const anos = ind.porAnoTipo ?? [];
  const porAno = anos.length > 1 ? h('div', { class: 'sheet bird-tabela' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, 'Ano'), p.niveis.map((n) => h('th', {}, h('i', { class: 'seg-marca', style: { background: `var(${n.cor})` } }), n.nome)), h('th', {}, 'Total'), h('th', {}, 'Proporção observada'))),
    h('tbody', {}, anos.map((a) => {
      const pa = calcularPiramideBird(a);
      return h('tr', {},
        h('td', { class: 'esq' }, h('b', {}, a.ano)),
        pa.niveis.map((n) => h('td', {}, num(n.ocorrencias))),
        h('td', {}, h('b', {}, num(pa.total))),
        h('td', {}, pa.niveis.map((n) => prop(n.proporcaoObservada)).join(' : ')));
    })))) : null;

  // ── Leitura do indicador ──
  const leitura = [
    `A pirâmide de Bird (1969) diz que, para cada acidente grave, ocorrem em média 10 acidentes com lesão leve, 30 com dano material e 600 quase acidentes. A base larga é o que permite agir antes do acidente grave.`,
    `Referência deste período: ${ancora.nome.toLowerCase()} (${num(ancora.ocorrencias)} registro(s)) — o nível mais alto com ocorrência. Dele saem os valores esperados dos demais níveis.`,
    `Dano material: ${num(dano.ocorrencias)} registrado(s) para ${prop(dano.esperado)} esperado(s) (${fmtPercentual(dano.cobertura, 0)}). Quase acidentes: ${num(quase.ocorrencias)} para ${prop(quase.esperado)} esperado(s) (${fmtPercentual(quase.cobertura, 0)}).`,
    (quase.cobertura ?? 1) < 1
      ? 'Base abaixo do esperado: em geral indica que quase acidentes e danos sem lesão estão sendo pouco registrados — ampliar o relato desses eventos melhora a prevenção.'
      : 'Base dentro ou acima do esperado: os eventos de menor gravidade estão sendo registrados na proporção prevista.',
  ];

  const bloco = (titulo, ...conteudo) => h('section', { class: 'bird-bloco' }, h('h4', { class: 'bird-subtitulo' }, titulo), ...conteudo);
  return h('div', { class: 'bird' },
    totais,
    h('div', { class: 'bird-corpo' },
      h('div', { class: 'bird-grafico', role: 'img', 'aria-label': p.niveis.map((n) => `${n.nome}: ${n.ocorrencias}`).join(', ') },
        h('div', { class: 'bird-piramide' }, faixas), h('div', { class: 'bird-rotulos' }, rotulos)),
      h('div', { class: 'bird-leitura' },
        h('h4', { class: 'bird-subtitulo' }, 'Como ler'),
        h('ul', {}, leitura.map((t) => h('li', {}, t))),
        h('p', { class: 'muted small' }, 'Classificação da pirâmide: ', p.niveis.map((n, i) => [i ? ' · ' : null, siglas(n), ` = ${n.nome.replace('Acidente com ', '').toLowerCase()}`])))),
    bloco('Classificação da pirâmide', tabela),
    porAno ? bloco('Evolução por ano', porAno) : null);
}
