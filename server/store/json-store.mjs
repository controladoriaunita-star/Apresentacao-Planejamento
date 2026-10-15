/**
 * Persistência em arquivos JSON dentro de DATA_DIR — usada em desenvolvimento, nos testes e no modo
 * demonstração (STORE=local). Em produção a mesma interface é atendida pelo Supabase (supabase-store.mjs).
 *
 * Interface comum (assíncrona) das coleções:
 *   listar() · obter(id) · buscarPor(campo, valor) · inserir(registro) · atualizar(id, campos)
 *   remover(id) · upsertPor(campo, registro)
 *
 * Escrita atômica (arquivo temporário + rename) e fila por arquivo para gravações simultâneas.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class ColecaoJson {
  #arquivo;
  #fila = Promise.resolve();

  constructor(dataDir, nome) {
    this.#arquivo = join(dataDir, `${nome}.json`);
    mkdirSync(dirname(this.#arquivo), { recursive: true });
  }

  /** Lê sempre do disco: o arquivo é pequeno e outra instância pode tê-lo alterado. */
  #ler() {
    if (!existsSync(this.#arquivo)) return [];
    const dados = JSON.parse(readFileSync(this.#arquivo, 'utf8'));
    return Array.isArray(dados) ? dados : [];
  }

  #alterar(alterar) {
    const tarefa = this.#fila.then(async () => {
      const lista = this.#ler();
      const resultado = await alterar(lista);
      mkdirSync(dirname(this.#arquivo), { recursive: true }); // a pasta pode ter sido apagada com o servidor no ar
      const temporario = `${this.#arquivo}.${process.pid}.tmp`;
      await writeFile(temporario, JSON.stringify(lista, null, 2));
      await rename(temporario, this.#arquivo);
      return resultado;
    });
    this.#fila = tarefa.catch(() => {});
    return tarefa;
  }

  async listar() {
    return this.#ler();
  }

  async obter(id) {
    return this.#ler().find((r) => r.id === id) ?? null;
  }

  async buscarPor(campo, valor) {
    return this.#ler().find((r) => r[campo] === valor) ?? null;
  }

  inserir(registro) {
    const novo = { id: randomUUID(), criadoEm: new Date().toISOString(), ...registro };
    return this.#alterar((lista) => { lista.push(novo); return novo; });
  }

  atualizar(id, campos) {
    return this.#alterar((lista) => {
      const i = lista.findIndex((r) => r.id === id);
      if (i < 0) return null;
      lista[i] = { ...lista[i], ...campos, id, atualizadoEm: new Date().toISOString() };
      return lista[i];
    });
  }

  remover(id) {
    return this.#alterar((lista) => {
      const i = lista.findIndex((r) => r.id === id);
      return i < 0 ? null : lista.splice(i, 1)[0];
    });
  }

  /** Atualiza o registro com o mesmo `campo` ou cria um novo (ex.: cadastro por chave da obra). */
  upsertPor(campo, registro) {
    return this.#alterar((lista) => {
      const i = lista.findIndex((r) => r[campo] === registro[campo]);
      const agora = new Date().toISOString();
      if (i >= 0) {
        lista[i] = { ...lista[i], ...registro, id: lista[i].id, atualizadoEm: agora };
        return lista[i];
      }
      const novo = { id: randomUUID(), criadoEm: agora, atualizadoEm: agora, ...registro };
      lista.push(novo);
      return novo;
    });
  }
}
