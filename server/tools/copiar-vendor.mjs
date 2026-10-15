/**
 * Copia as bibliotecas de terceiros usadas pelo navegador para public/vendor.
 * O front não tem etapa de build: o servidor (Node hoje, PHP amanhã) só serve arquivos estáticos,
 * então as libs ficam versionadas dentro de public/vendor. Rode `npm run vendor` após atualizar
 * chart.js ou xlsx no package.json.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const destino = join(raiz, 'public', 'vendor');
mkdirSync(destino, { recursive: true });

const arquivos = [
  ['node_modules/chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
];

for (const [origem, nome] of arquivos) {
  copyFileSync(join(raiz, origem), join(destino, nome));
  console.log(`copiado ${origem} → public/vendor/${nome}`);
}
