/**
 * Armazém de documentos JSON do sistema (cache das planilhas do SharePoint e estado do INCC).
 * - Local: arquivos em DATA_DIR/<nome>.json.
 * - Supabase: objetos no Storage em `sistema/<nome>.json` — compartilhados entre as instâncias da Vercel
 *   (que não têm disco persistente).
 * Interface: ler(nome) → objeto | null · gravar(nome, objeto)
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const arquivoSeguro = (nome) => nome.replace(/[^\w/-]+/g, '_');

export class ArmazemLocal {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  async ler(nome) {
    const caminho = join(this.dataDir, `${arquivoSeguro(nome)}.json`);
    return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
  }

  async gravar(nome, objeto) {
    const caminho = join(this.dataDir, `${arquivoSeguro(nome)}.json`);
    mkdirSync(dirname(caminho), { recursive: true });
    await writeFile(caminho, JSON.stringify(objeto));
  }
}

export class ArmazemSupabase {
  constructor(cliente) {
    this.cliente = cliente;
  }

  async ler(nome) {
    const dados = await this.cliente.lerObjeto(`sistema/${arquivoSeguro(nome)}.json`).catch(() => null);
    return dados ? JSON.parse(dados.toString('utf8')) : null;
  }

  async gravar(nome, objeto) {
    await this.cliente.gravarObjeto(`sistema/${arquivoSeguro(nome)}.json`, Buffer.from(JSON.stringify(objeto)));
  }
}
