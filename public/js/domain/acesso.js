/**
 * v26 — Acesso por obra e por apresentação. Fonte única usada pelo servidor (o que entregar) e pelo front
 * (o que mostrar).
 *
 * Cada usuário guarda:
 *   - `obras`: null = todas as obras (inclui as que entrarem depois na planilha) ou lista de chaves
 *     (`chaveObra` do nome) — lista vazia = nenhuma obra;
 *   - `apresentacoes`: "ambas" (padrão), "obra" ou "cliente".
 *
 * A restrição só vale para o papel Viewer: Dev, Planejamento e Segurança veem tudo, mesmo que os campos
 * estejam gravados. Usuários criados antes da v26 não têm os campos e continuam vendo tudo.
 *
 * Apresentação Cliente sozinha: as colunas "- Obra" das planilhas (previstos, comentários e metas internos)
 * não saem do servidor. A apresentação Obra usa também as colunas "- Cliente" (Painel de obras), então quem
 * tem só a Obra recebe as duas variantes — só não abre a apresentação Cliente nem o conteúdo "Somente Cliente".
 */
import { ABAS, CAMPOS_ECONOMICO, CAMPOS_FISICO_ATIVIDADE, CAMPOS_INFOS_GERAIS, CAMPOS_ORCAMENTO } from './colunas.js';
import { apareceNa, destinoDaMidia, destinoDaTela } from './conteudo.js';
import { chaveObra, normalizarCabecalho } from './normalizar.js';

export const APRESENTACOES = Object.freeze({
  ambas: 'Obra e Cliente',
  obra: 'Somente Obra',
  cliente: 'Somente Cliente',
});

const VISOES = ['obra', 'cliente'];

/** Valida o que vem do formulário de usuários. Campo ausente (undefined) não entra no resultado. */
export function normalizarAcesso({ obras, apresentacoes } = {}) {
  const acesso = {};
  if (obras !== undefined) {
    if (obras !== null && !Array.isArray(obras)) throw new Error('Obras: envie a lista de obras ou null para todas.');
    acesso.obras = obras === null ? null : [...new Set(obras.map(chaveObra).filter(Boolean))];
  }
  if (apresentacoes !== undefined) {
    if (!Object.hasOwn(APRESENTACOES, apresentacoes)) throw new Error('Apresentação inválida.');
    acesso.apresentacoes = apresentacoes;
  }
  return acesso;
}

/**
 * O que o usuário pode ver.
 *   restrito   há alguma limitação (falso = vê tudo, nenhum filtro é aplicado)
 *   visoes     apresentações liberadas, na ordem ["obra", "cliente"]
 *   obra(chave) / visao(v)   testes
 */
export function acessoDe(usuario) {
  const viewer = usuario?.papel === 'viewer';
  const lista = viewer && Array.isArray(usuario.obras) ? new Set(usuario.obras) : null;
  const apresentacoes = viewer && Object.hasOwn(APRESENTACOES, usuario.apresentacoes ?? '') ? usuario.apresentacoes : 'ambas';
  const visoes = VISOES.filter((v) => apareceNa(apresentacoes, v));
  return {
    restrito: Boolean(lista) || apresentacoes !== 'ambas',
    todasObras: !lista,
    visoes,
    obra: (chave) => !lista || lista.has(chaveObra(chave)),
    visao: (v) => visoes.includes(v),
  };
}

const CAMPOS_DA_ABA = {
  [ABAS.infosGerais]: CAMPOS_INFOS_GERAIS,
  [ABAS.fisicoAtividade]: CAMPOS_FISICO_ATIVIDADE,
  [ABAS.orcamento]: CAMPOS_ORCAMENTO,
  [ABAS.economico]: CAMPOS_ECONOMICO,
};

/** Matriz {colunas, linhas} da aba só com as obras liberadas e, para quem tem só o Cliente, sem as colunas "- Obra". */
export function filtrarMatriz(matriz, nomeAba, acesso) {
  if (!acesso.restrito) return matriz;
  let { colunas, linhas } = matriz;
  if (!acesso.todasObras) {
    const iNome = colunas.findIndex((c) => normalizarCabecalho(c) === 'nome da obra');
    linhas = iNome < 0 ? [] : linhas.filter((l) => acesso.obra(l[iNome]));
  }
  if (!acesso.visao('obra')) {
    const internas = new Set((CAMPOS_DA_ABA[nomeAba] ?? []).filter((c) => c[2]).map((c) => normalizarCabecalho(c[1])));
    const manter = colunas.map((c, i) => (internas.has(normalizarCabecalho(c)) ? -1 : i)).filter((i) => i >= 0);
    if (manter.length < colunas.length) {
      colunas = manter.map((i) => colunas[i]);
      linhas = linhas.map((l) => manter.map((i) => l[i]));
    }
  }
  return { ...matriz, colunas, linhas };
}

/** Mídia (TxC/foto) de obra liberada e com destino em alguma apresentação liberada. */
export function podeVerMidia(midia, acesso) {
  return acesso.obra(midia.chaveObra) && acesso.visoes.some((v) => apareceNa(destinoDaMidia(midia), v));
}

/** Tela extra: destino em apresentação liberada e de todas as obras (lista vazia) ou de alguma obra liberada. */
export function podeVerTela(tela, acesso) {
  return acesso.visoes.some((v) => apareceNa(destinoDaTela(tela), v))
    && (!tela.obras?.length || tela.obras.some((o) => acesso.obra(o)));
}

/**
 * Obra do Cadastro de obras cujos acidentes o usuário pode ler: obra liberada e, para quem tem só a
 * apresentação Cliente, marcada com "Segurança do Trabalho na apresentação Cliente".
 */
export function podeVerSeguranca(cadastro, acesso) {
  return acesso.obra(cadastro.chave) && (acesso.visao('obra') || cadastro.segurancaCliente === 'sim');
}
