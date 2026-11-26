/**
 * Copia as bibliotecas de terceiros usadas pelo navegador para public/vendor.
 * O front não tem etapa de build: o servidor (Node hoje, PHP amanhã) só serve arquivos estáticos,
 * então as libs ficam versionadas dentro de public/vendor. Rode `npm run vendor` após atualizar
 * chart.js, xlsx, heic2any, utif ou pako no package.json.
 * heic2any (HEIC/HEIF), utif + pako (TIFF) só são carregados quando alguém escolhe uma imagem nesses formatos.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const destino = join(raiz, 'public', 'vendor');
mkdirSync(destino, { recursive: true });

const arquivos = [
  ['node_modules/chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['node_modules/heic2any/dist/heic2any.min.js', 'heic2any.min.js'],
  ['node_modules/utif/UTIF.js', 'utif.js'],
  ['node_modules/pako/dist/pako_inflate.min.js', 'pako_inflate.min.js'],
  // PDF da IAT/IST gerado no navegador (para baixar e anexar ao e-mail enviado pelo servidor)
  ['node_modules/jspdf/dist/jspdf.umd.min.js', 'jspdf.umd.min.js'],
  ['node_modules/html2canvas/dist/html2canvas.min.js', 'html2canvas.min.js'],
];

for (const [origem, nome] of arquivos) {
  // Leitura + escrita (e não copyFile): na pasta sincronizada do OneDrive/SharePoint o copyFile falha e pode apagar o destino.
  const alvo = join(destino, nome);
  let dados;
  try {
    dados = readFileSync(join(raiz, origem));
  } catch (e) {
    // Arquivo só "na nuvem" (OneDrive) ou ilegível: mantém a cópia já versionada em public/vendor.
    if (!existsSync(alvo)) throw e;
    console.warn(`mantido: public/vendor/${nome} (não foi possível ler ${origem}: ${e.code})`);
    continue;
  }
  if (existsSync(alvo) && readFileSync(alvo).equals(dados)) {
    console.log(`igual: public/vendor/${nome}`);
    continue;
  }
  writeFileSync(alvo, dados);
  console.log(`copiado ${origem} → public/vendor/${nome}`);
}
