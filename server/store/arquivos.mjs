/**
 * Arquivos enviados (fotos, imagens de TxC, planilhas e imagens das telas do cliente).
 *
 * Dois repositórios com a mesma interface:
 * - RepositorioArquivosLocal (STORE=local): binários em DATA_DIR/arquivos/<id>, metadados em JSON;
 *   o envio passa pelo servidor (POST /api/arquivos com o corpo cru).
 * - RepositorioArquivosSupabase (STORE=supabase): binários no Supabase Storage (bucket privado),
 *   metadados na tabela `arquivos`. O navegador envia direto ao Storage por URL assinada — assim a
 *   Vercel não limita o tamanho (4,5 MB por requisição) — e a leitura redireciona para uma URL assinada.
 *
 * Interface: prepararEnvio(meta) · salvar({nome, tipo, dados, usuario}) · ler(id) · remover(id)
 *   ler() devolve { registro, dados } (local) ou { registro, redirecionar } (Supabase).
 */
import { mkdirSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ColecaoJson } from './json-store.mjs';
import { ColecaoSupabase } from './supabase-store.mjs';

/** Tipos aceitos → categoria. Qualquer outro tipo é recusado. */
export const TIPOS_ACEITOS = {
  'image/png': 'imagem',
  'image/jpeg': 'imagem',
  'image/webp': 'imagem',
  'image/gif': 'imagem',
  'application/pdf': 'pdf',
  'text/csv': 'planilha',
  'application/vnd.ms-excel': 'planilha',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'planilha',
  'application/vnd.ms-excel.sheet.macroEnabled.12': 'planilha',
};

const novoRegistro = ({ nome, tipo, tamanho, usuario }) => ({
  id: randomUUID(), nome, tipo, categoria: TIPOS_ACEITOS[tipo], tamanho, enviadoPor: usuario, criadoEm: new Date().toISOString(),
});

export class RepositorioArquivosLocal {
  constructor(dataDir) {
    this.pasta = join(dataDir, 'arquivos');
    mkdirSync(this.pasta, { recursive: true });
    this.meta = new ColecaoJson(dataDir, 'arquivos');
  }

  /** No modo local o próprio servidor recebe o arquivo. */
  async prepararEnvio() {
    return { envio: { modo: 'servidor' } };
  }

  async salvar({ nome, tipo, dados, usuario }) {
    const registro = novoRegistro({ nome, tipo, tamanho: dados.length, usuario });
    await writeFile(join(this.pasta, registro.id), dados);
    return this.meta.inserir(registro);
  }

  async ler(id) {
    const registro = await this.meta.obter(id);
    if (!registro) return null;
    return { registro, dados: await readFile(join(this.pasta, id)) };
  }

  async remover(id) {
    await this.meta.remover(id);
    await unlink(join(this.pasta, id)).catch(() => {});
  }
}

export class RepositorioArquivosSupabase {
  constructor(cliente) {
    this.cliente = cliente;
    this.meta = new ColecaoSupabase(cliente, 'arquivos');
  }

  #caminho = (registro) => `anexos/${registro.id}`;

  /** Registra o arquivo e devolve a URL assinada para o navegador enviar direto ao Storage. */
  async prepararEnvio({ nome, tipo, tamanho, usuario }) {
    const registro = novoRegistro({ nome, tipo, tamanho, usuario });
    const url = await this.cliente.urlDeEnvio(this.#caminho(registro));
    await this.meta.inserir({ ...registro, caminho: this.#caminho(registro) });
    return { registro, envio: { modo: 'direto', url, metodo: 'PUT', cabecalhos: { 'content-type': tipo } } };
  }

  /** Envio pelo servidor (arquivos pequenos e compatibilidade com o modo local). */
  async salvar({ nome, tipo, dados, usuario }) {
    const registro = novoRegistro({ nome, tipo, tamanho: dados.length, usuario });
    await this.cliente.gravarObjeto(this.#caminho(registro), dados, tipo);
    return this.meta.inserir({ ...registro, caminho: this.#caminho(registro) });
  }

  async ler(id) {
    const registro = await this.meta.obter(id);
    if (!registro) return null;
    return { registro, redirecionar: await this.cliente.urlDeLeitura(registro.caminho ?? this.#caminho(registro)) };
  }

  async remover(id) {
    const registro = await this.meta.remover(id);
    if (registro) await this.cliente.removerArquivos([registro.caminho ?? this.#caminho(registro)]);
  }
}
