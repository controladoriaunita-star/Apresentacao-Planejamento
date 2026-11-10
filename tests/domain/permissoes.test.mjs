import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pode } from '../../public/js/domain/permissoes.js';

test('Exportar PDF da apresentação Cliente: só Dev e Planejamento', () => {
  assert.equal(pode('dev', 'exportarPdf'), true);
  assert.equal(pode('planejamento', 'exportarPdf'), true);
  assert.equal(pode('viewer', 'exportarPdf'), false);
  assert.equal(pode('seguranca', 'exportarPdf'), false);
  assert.equal(pode(undefined, 'exportarPdf'), false);
});
