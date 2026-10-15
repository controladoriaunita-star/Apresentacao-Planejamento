/**
 * Gera os relatórios em docs/:
 *   docs/MANUAL_DE_USO.html  — como usar
 *   docs/MAPA_DE_DADOS.html  — funcionalidades e origem de cada informação, com telas anotadas
 *
 * Passos para atualizar depois de mudar o app:
 *   node tests/tools/capturar-telas.cjs   (novas capturas e posições em docs/img)
 *   node docs/relatorios/gerar.mjs        (regera os HTML)
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { manualDeUso } from './manual-de-uso.mjs';
import { mapaDeDados } from './mapa-de-dados.mjs';

const DOCS = join(import.meta.dirname, '..');
writeFileSync(join(DOCS, 'MANUAL_DE_USO.html'), manualDeUso());
writeFileSync(join(DOCS, 'MAPA_DE_DADOS.html'), mapaDeDados());
console.log('gerados docs/MANUAL_DE_USO.html e docs/MAPA_DE_DADOS.html');
