/**
 * Gera tests/fixtures/planilhas-exemplo.json: três obras fictícias no MESMO formato que o Microsoft Graph
 * devolve (matriz de valores com cabeçalho na primeira linha, datas como serial do Excel e os cabeçalhos
 * reais, inclusive espaços duplos). Serve para os testes de regressão e para o modo demonstração
 * (DATA_SOURCE=exemplo) — nenhum dado real de obra fica no repositório.
 *
 * Curvas lineares e valores redondos para que os testes possam conferir os cálculos à mão.
 * Rode: npm run fixture
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MESES = Array.from({ length: 24 }, (_, i) => `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
/** Último mês com realizado (o "mês fechado" dos testes). */
export const MES_FECHADO = '2026-03';
const N_FECHADOS = MESES.indexOf(MES_FECHADO) + 1; // 15

const serial = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, 1) - Date.UTC(1899, 11, 30)) / 86_400_000);
};

export const OBRAS = [
  // realizadoMes: avanço mensal até o mês fechado; planejadoMes: replanejado linear
  { nome: 'Residencial Alpha', cliente: 'Cliente XPTO', uau: 101, realizadoMes: 0.04, planejadoMes: 1 / 24, cef: false, orcamento: 10_000_000 },
  { nome: 'Edifício Beta', cliente: 'Construtora Beta', uau: 102, realizadoMes: 0.05, planejadoMes: 1 / 20, cef: true, orcamento: 30_000_000 },
  { nome: 'Torre Gama', cliente: 'Cliente XPTO', uau: 103, realizadoMes: 0.1, planejadoMes: 0.1, cef: false, orcamento: 5_000_000 },
];

const CAB_INFOS = [
  'Nome da Obra', 'Cliente', 'Nº Obra UAU', 'Item', 'Mês do Fechamento', 'Homens/ mês', 'Houve Replanejamento?', 'Fim Projetado de obra',
  'Previsto Original Acumulado - Cliente', 'Previsto Original Acumulado - Obra', '1º Replanejado Acumulado - Cliente', '1º Replanejado Acumulado - Obra',
  'Previsto Original Mês - Cliente', 'Previsto Original Mês - Obra', '1º Replanejado Mês - Cliente', '1º Replanejado Mês - Obra',
  'Replanejado Atual Acumulado - Cliente', 'Replanejado Atual Mês - Cliente', 'Replanejado Atual  Acumulado - Obra', 'Replanejado Atual Mês - Obra',
  'Realizado Acumulado', 'Realizado Mês', 'Meta Acumulada - Inicial', 'Meta Acumulada - Atual', 'Meta Acumulada - Mês Subsequente',
  'Meta Mês - Mês Subsequente', 'Meta Mês - Inicial', 'Meta Mês - Atual', 'Comentário Cliente', 'Comentário Obra', 'Principais metas Cliente',
  'Principais Metas Obra', 'Cronograma Acumulado - Banco 1ª Fase', 'Cronograma Mês - Banco 1ª Fase', 'Previsto Acumulado - Banco 1ª Fase ',
  'Previsto Mês - Banco 1ª Fase', 'Realizado/Projetado Acumulado - Banco 1ª Fase', 'Realizado/Projetado Mês - Banco 1ª Fase',
  'Consideração Mês', 'Assertividade', 'Sem estrutura e elevador',
];

const CAB_ORC = ['Nome da Obra', 'Cliente', 'Nº Obra UAU', 'ITEM', 'Índice', 'ITEM Pai', 'ITEM Filho', 'Descrição', 'Orçamento Base Físico'];

const CAB_ECON = [
  'Nome da Obra', 'Item', 'Descrição', 'Mês do Fechamento', 'Avanço', 'Custo Pago', 'NFs Lançadas', 'Saldos OC', 'Saldos Contratos',
  'Custo em Sistema', 'Comprometimentos e Rateios', 'Custo Lançado', 'Saldo de Orçamento', 'Orçamento de Término', 'Custo Projetado Total',
  'Resultado Projetado Obra', 'IEC Obra', 'Resultado Sem Correção', 'IEC Sem correção', '% Contratado', 'Custo Passível de Reajuste',
  'Custo Lançado Mês', 'Custo Pago Mês', 'Variação Mês - Custo', 'Variações principais', 'Variação do mês', 'Contingências',
  'Custos Fora Contrato', 'Total de Aditivos', 'Aditivos sem Aprovação', 'Custo Total Projetado (sem correção)',
];

const CAB_FISICO = [
  'Column4', 'Nome da Obra', 'Cliente', 'Nº Obra UAU', 'Item', 'Mês do Fechamento', 'Previsto Acumulado Cliente', 'Previsto Acumulado Obra ',
  '1º Replanejado Acumulado - Cliente', '1º Replanejado Acumulado - Obra', 'Replanejado Atual  Acumulado - Cliente', 'Replanejado Atual  Acumulado - Obra',
  'Realizado Acumulado', 'Realizado Mês', 'Meta Mês - Inicial', 'Meta Mês - Atual', 'Meta Mês - Mês Subsequente', 'Assertividade',
  'Meta Acumulada - Inicial', 'Meta Acumulada - Atual', 'Meta Acumulado - Mês Subsequente', 'Comentários - Cliente', 'Comentários - Obra',
  'Peso Planejado na Meta', 'Peso Atraso / Adiantamento', 'Peso Atraso / Adiantamento Cliente',
];

/** Itens da EAP fictícia: participação no orçamento e fator de avanço em relação à obra. */
const ITENS = [
  { item: '01', descricao: 'Serviços Iniciais', parte: 0.1, fator: 1 },
  { item: '02', descricao: 'Estrutura', parte: 0.6, fator: 1 },
  { item: '02.01', descricao: 'Estrutura/Viga/Lajes', parte: 0.4, fator: 1 },
  { item: '02.02', descricao: 'Escadas', parte: 0.2, fator: 1 },
  { item: '16', descricao: 'Despesas Indiretas', parte: 0.3, fator: 1 },
];

const r = (v) => Math.round(v * 1e10) / 1e10;
const acumulado = (porMes, i) => Math.min(1, r(porMes * (i + 1)));

function curvas(obra, i) {
  const fechado = i < N_FECHADOS;
  const realizadoAte = (n) => Math.min(1, r(obra.realizadoMes * Math.min(n, N_FECHADOS)));
  const realizadoAcm = realizadoAte(i + 1); // nos meses futuros a planilha repete o último acumulado
  const realizadoMes = fechado ? r(realizadoAcm - realizadoAte(i)) : 0;
  const replanMes = acumulado(obra.planejadoMes, i) - (i ? acumulado(obra.planejadoMes, i - 1) : 0);
  return {
    realizadoAcm,
    realizadoMes,
    replanAcm: acumulado(obra.planejadoMes, i),
    replanMes: r(replanMes),
    previstoOriginalAcm: acumulado(1 / 24, i),
    metaMesAtual: r(replanMes),
    assertividade: fechado && replanMes > 0 ? r(realizadoMes / replanMes) : 0,
  };
}

function gerar() {
  const infos = [CAB_INFOS];
  const orc = [CAB_ORC];
  const econ = [CAB_ECON];
  const fisico = [CAB_FISICO];

  for (const obra of OBRAS) {
    orc.push([obra.nome, obra.cliente, obra.uau, 'Geral', 0, 'Geral', '-', 'Geral', obra.orcamento]);
    ITENS.forEach((it, k) => orc.push([obra.nome, obra.cliente, obra.uau, it.item, k + 1, it.item.split('.')[0], it.item.includes('.') ? it.item : '-', it.descricao, obra.orcamento * it.parte]));

    MESES.forEach((mes, i) => {
      const c = curvas(obra, i);
      const seguinte = curvas(obra, Math.min(i + 1, MESES.length - 1));
      const cef = obra.cef ? { cron: acumulado(0.04, i), cronMes: 0.04, prev: acumulado(0.045, i), prevMes: 0.045, real: acumulado(0.05, i), realMes: 0.05 } : null;
      infos.push([
        obra.nome, obra.cliente, obra.uau, 'Geral', serial(mes), i < N_FECHADOS ? 100 : '', 'Não', '',
        c.previstoOriginalAcm * 0.9, c.previstoOriginalAcm, c.replanAcm * 0.9, c.replanAcm,
        r(1 / 24 * 0.9), r(1 / 24), c.replanMes * 0.9, c.replanMes,
        c.replanAcm * 0.9, c.replanMes * 0.9, c.replanAcm, c.replanMes,
        c.realizadoAcm, c.realizadoMes, c.replanAcm, c.replanAcm, Math.min(1, r(c.realizadoAcm + seguinte.replanMes)),
        seguinte.replanMes, c.replanMes, c.metaMesAtual, i === N_FECHADOS - 1 ? 'Comentário para o cliente' : '0',
        i === N_FECHADOS - 1 ? 'Comentário interno da obra' : '0', '0', i === N_FECHADOS - 1 ? 'Concluir estrutura' : '0',
        cef?.cron ?? '', cef?.cronMes ?? '', cef?.prev ?? '', cef?.prevMes ?? '', cef?.real ?? '', cef?.realMes ?? '',
        '1', c.assertividade, '',
      ]);

      const custoProjetadoGeral = obra.orcamento * 0.98;
      econ.push([obra.nome, 'Geral', '0', serial(mes), c.realizadoAcm, obra.orcamento * 0.4, obra.orcamento * 0.05, obra.orcamento * 0.02,
        obra.orcamento * 0.03, 0, 0, obra.orcamento * 0.5, 0, obra.orcamento * 0.48, custoProjetadoGeral, obra.orcamento * 0.02, 0.98,
        -obra.orcamento * 0.01, 1.01, 0.8, obra.orcamento * 0.2, 1000, 2000, -500, '0', '0', '0', -10_000, 50_000, 20_000, obra.orcamento * 1.01]);
      for (const it of ITENS.filter((x) => !x.item.includes('.'))) {
        econ.push([obra.nome, it.item, it.descricao.toUpperCase(), serial(mes), c.realizadoAcm, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          custoProjetadoGeral * it.parte, obra.orcamento * 0.02 * it.parte, 0.98, 0, 1.01, 0.8, 0, 0, 0, 0,
          it.item === '02' ? 'Economia no contrato de estrutura' : '0', '0', '0', 0, 0, 0, 0]);
      }

      for (const it of ITENS.filter((x) => x.item !== '16')) {
        fisico.push(['', obra.nome, obra.cliente, obra.uau, it.item, serial(mes), c.previstoOriginalAcm * 0.9, c.previstoOriginalAcm,
          c.replanAcm * 0.9, c.replanAcm, c.replanAcm * 0.9, c.replanAcm, c.realizadoAcm, c.realizadoMes, c.replanMes, c.metaMesAtual,
          seguinte.replanMes, c.assertividade, c.replanAcm, c.replanAcm, Math.min(1, r(c.realizadoAcm + seguinte.replanMes)),
          '0', it.item === '02.01' ? 'Atraso na concretagem da laje' : '0', 0.01 * it.parte, r((c.realizadoAcm - c.replanAcm) * it.parte), 0]);
      }
    });
  }
  return { 'BD_Infos Gerais': infos, 'BD_Orc': orc, 'BD_Econômico': econ, 'BD_Físico por atividade': fisico };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destino = join(dirname(fileURLToPath(import.meta.url)), 'planilhas-exemplo.json');
  writeFileSync(destino, JSON.stringify(gerar()));
  console.log(`gerado ${destino}`);
}

export { gerar, MESES };
