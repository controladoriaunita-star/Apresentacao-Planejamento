/**
 * Arquivos estáticos de public/. Na hospedagem PHP (Hostinger) o próprio Apache serve esta pasta.
 */
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { CABECALHOS_SEGURANCA } from './respostas.mjs';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

/** @returns {Promise<boolean>} true se respondeu */
export async function servirEstatico(publicDir, caminhoUrl, res) {
  const relativo = caminhoUrl === '/' ? '/index.html' : caminhoUrl;
  const alvo = normalize(join(publicDir, decodeURIComponent(relativo)));
  if (!alvo.startsWith(publicDir + sep)) return false; // bloqueia "../"
  try {
    const info = await stat(alvo);
    if (!info.isFile()) return false;
    const dados = await readFile(alvo);
    const ext = extname(alvo).toLowerCase();
    res.writeHead(200, {
      ...CABECALHOS_SEGURANCA,
      'content-type': TIPOS[ext] ?? 'application/octet-stream',
      'content-length': dados.length,
      // HTML/JS/CSS sem cache longo: o app não tem hash nos nomes de arquivo (não há build).
      'cache-control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=86400',
    });
    res.end(dados);
    return true;
  } catch {
    return false;
  }
}
