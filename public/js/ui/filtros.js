/**
 * Barra de filtros comum às abas, no estilo do AutoFiltro do Excel:
 * obras (várias, com pesquisa e agrupadas por cliente) e mês de referência (agrupado por ano). O intervalo dos
 * gráficos do Resumo Geral não é escolhido: vai do 1º mês da obra até o mês seguinte ao 100% do planejado.
 */
import { h } from '../core/dom.js';
import { fmtDataHora, fmtMes } from '../core/formato.js';
import { estado } from '../core/estado.js';
import { mesesDasObras } from '../domain/base.js';
import { intervaloMeses } from '../domain/normalizar.js';
import { pode } from '../domain/permissoes.js';
import { botaoAcao, toast } from './componentes.js';
import { filtroExcel } from './filtro-excel.js';
import { icone } from './icones.js';

/** Itens de mês para o filtro, agrupados por ano (como a árvore de datas do Excel). */
export function itensDeMes(meses) {
  return meses.map((m) => ({ valor: m, rotulo: fmtMes(m), grupo: m.slice(0, 4) }));
}

export function itensDeObras(base) {
  return base.obras.map((o) => ({ valor: o.chave, rotulo: o.nome, grupo: o.cliente ?? 'Sem cliente' }));
}

export function barraFiltros() {
  const base = estado.base('obra');
  const { obras, referencia } = estado.filtro;
  const meses = mesesDasObras(base, obras);
  const todosMeses = itensDeMes(meses.length ? intervaloMeses(meses[0], meses.at(-1)) : []);

  return h('div', { class: 'filtros', role: 'search' },
    filtroExcel({
      rotulo: 'Obras', itens: itensDeObras(base), selecionados: obras, multiplo: true, testeId: 'filtro-obras', largura: 340,
      aoAplicar: (valores) => estado.definirFiltro({ obras: valores }),
    }),
    filtroExcel({
      rotulo: 'Mês de referência', itens: todosMeses, selecionados: referencia, multiplo: false, testeId: 'mes-referencia', largura: 220, destaque: true,
      aoAplicar: (v) => estado.definirFiltro({ referencia: v }),
    }),
    h('div', { class: 'info' },
      h('span', { class: 'muted small' }, `${estado.bruto?.fonte ?? ''} · lido em ${fmtDataHora(estado.bruto?.atualizadoEm)}`),
      botaoAtualizarDados()));
}

/** Relê as planilhas no SharePoint agora (só para quem edita conteúdo; some no modo apresentação). */
export function botaoAtualizarDados(classe = 'btn ghost sm') {
  if (!pode(estado.usuario?.papel, 'editarConteudo')) return null;
  return botaoAcao([icone('atualizar', { tamanho: 16 }), 'Atualizar dados'], async () => {
    await estado.carregarDados({ forcarServidor: true });
    if (!estado.erro) toast('success', `Dados atualizados do SharePoint · lido em ${fmtDataHora(estado.bruto?.atualizadoEm)}`);
  }, `${classe} so-edicao`);
}

/**
 * Nas abas de uma obra só (Físico, Econômico, TxC, Fotos): escolhe entre as obras filtradas.
 * `filtro`: o da tela (padrão) ou o da exportação em PDF, que fixa uma obra só.
 */
export function obraUnica(base, aoTrocar, filtro = estado.filtro) {
  const obras = base.obras.filter((o) => filtro.obras.includes(o.chave));
  const atual = obras.find((o) => o.chave === filtro.obraUnica) ?? obras[0] ?? null;
  const seletor = obras.length > 1
    ? filtroExcel({
      rotulo: 'Obra exibida', multiplo: false, largura: 300,
      itens: obras.map((o) => ({ valor: o.chave, rotulo: o.nome, grupo: o.cliente ?? 'Sem cliente' })),
      selecionados: atual?.chave,
      aoAplicar: (v) => { estado.filtro.obraUnica = v; aoTrocar(); },
    })
    : null;
  return { obra: atual, seletor };
}

