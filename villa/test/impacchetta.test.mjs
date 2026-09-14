import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const VILLA = join(dirname(fileURLToPath(import.meta.url)), '..');

test('impacchetta produce villa/carte/index.html autonomo', () => {
  execFileSync(process.execPath, [join(VILLA, 'impacchetta.mjs')]);
  const html = readFileSync(join(VILLA, 'carte', 'index.html'), 'utf8');
  assert.match(html, /V\.sha256/);
  assert.match(html, /INGRESSO="carte"/);
  assert.doesNotMatch(html, /\/\*CODICE\*\/|<!--TITOLO-->|\/\*INGRESSO\*\//);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=["']?https?:/i);
});
