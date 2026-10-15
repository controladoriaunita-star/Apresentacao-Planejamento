/**
 * Coleções no Supabase (STORE=supabase), com a mesma interface de ColecaoJson.
 * O servidor acessa com a chave service role; as tabelas têm RLS ligado e nenhuma política, ou seja,
 * ninguém lê o banco direto do navegador — tudo passa pela API (mesmo contrato da versão PHP).
 * Tabelas e colunas: supabase/migrations/001_apresentacao.sql.
 */
import { randomUUID } from 'node:crypto';

const paraSnake = (k) => k.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const paraCamel = (k) => k.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

/** Converte as chaves do objeto (camelCase no app ↔ snake_case no banco). */
export const linhaPadrao = {
  paraLinha: (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [paraSnake(k), v])),
  deLinha: (linha) => Object.fromEntries(Object.entries(linha).map(([k, v]) => [paraCamel(k), v])),
};

/**
 * Cadastro de obras: os campos do formulário variam (public/js/domain/cadastro-obra.js), então ficam numa
 * coluna `dados` (jsonb); `chave` e `obra` ficam em colunas próprias para busca e unicidade.
 */
export const linhaCadastro = {
  paraLinha: ({ id, chave, obra, atualizadoEm, atualizadoPor, criadoEm, ...dados }) => linhaPadrao.paraLinha({ id, chave, obra, atualizadoEm, atualizadoPor, criadoEm, dados }),
  deLinha: (linha) => {
    const { dados, ...resto } = linhaPadrao.deLinha(linha);
    return { ...(dados ?? {}), ...resto };
  },
};

export class ColecaoSupabase {
  constructor(cliente, tabela, { mapa = linhaPadrao, ordem = null } = {}) {
    this.cliente = cliente;
    this.tabela = tabela;
    this.mapa = mapa;
    this.ordem = ordem;
  }

  async listar() {
    return (await this.cliente.selecionar(this.tabela, {}, this.ordem)).map(this.mapa.deLinha);
  }

  async obter(id) {
    return this.buscarPor('id', id);
  }

  async buscarPor(campo, valor) {
    const [linha] = await this.cliente.selecionar(this.tabela, { [paraSnake(campo)]: valor });
    return linha ? this.mapa.deLinha(linha) : null;
  }

  async inserir(registro) {
    const agora = new Date().toISOString();
    return this.mapa.deLinha(await this.cliente.inserir(this.tabela, this.mapa.paraLinha({ id: randomUUID(), criadoEm: agora, ...registro })));
  }

  async atualizar(id, campos) {
    const atual = await this.obter(id);
    if (!atual) return null;
    const linha = await this.cliente.atualizar(this.tabela, { id }, this.mapa.paraLinha({ ...atual, ...campos, id, atualizadoEm: new Date().toISOString() }));
    return linha ? this.mapa.deLinha(linha) : null;
  }

  async remover(id) {
    const linha = await this.cliente.remover(this.tabela, { id });
    return linha ? this.mapa.deLinha(linha) : null;
  }

  async upsertPor(campo, registro) {
    const atual = await this.buscarPor(campo, registro[campo]);
    if (atual) return this.atualizar(atual.id, registro);
    return this.inserir({ ...registro, atualizadoEm: new Date().toISOString() });
  }
}
