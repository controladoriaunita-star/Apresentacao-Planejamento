/**
 * Sobe o servidor dos testes de tela a partir de uma pasta de dados vazia (primeiro acesso).
 * A limpeza fica aqui (e não num globalSetup) porque o Playwright sobe o servidor antes do setup.
 */
import { rmSync } from 'node:fs';

rmSync(new URL('../../data/e2e', import.meta.url), { recursive: true, force: true });
await import('../../server/index.mjs');
