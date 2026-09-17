import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const VILLA = join(dirname(fileURLToPath(import.meta.url)), '..');

test('impacchetta produce villa/carte/index.html autonomo', () => {
  execFileSync(process.execPath, [join(VILLA, 'impacchetta.mjs')]);
  const html = readFileSync(join(VILLA, 'carte', 'index.html'), 'utf8');
  assert.match(html, /V\.sha256/);
  assert.match(html, /INGRESSO="carte"/);
  assert.doesNotMatch(html, /\/\*CODICE\*\/|<!--TITOLO-->|\/\*INGRESSO\*\//);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=["']?https?:/i);
  assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|WebSocket\(/);
});

test("il codice dell'ingresso si carica tutto insieme", () => {
  execFileSync(process.execPath, [join(VILLA, 'impacchetta.mjs')]);
  const html = readFileSync(join(VILLA, 'carte', 'index.html'), 'utf8');
  const js = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  delete globalThis.V;
  vm.runInThisContext(js, { filename: 'carte/index.html' });
  assert.equal(typeof globalThis.V.Tavolo, 'function');
  assert.equal(typeof globalThis.V.giochi.scopa.bot, 'function');
  assert.ok(globalThis.V.zone['piano-terra'].mappa.tavoli.length >= 19);
  assert.equal(typeof globalThis.V.Mondo, 'function');
  for (const g of ['scopa', 'briscola', 'tressette']) assert.equal(typeof globalThis.V.giochi[g].bot, 'function');
});
