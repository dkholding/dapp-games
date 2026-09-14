import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SORG = join(dirname(fileURLToPath(import.meta.url)), '..', 'sorgente');

// Carica i file del sorgente nello stesso contesto, come fa l'ingresso impacchettato.
export function carica(...file) {
  delete globalThis.V;
  for (const f of file) vm.runInThisContext(readFileSync(join(SORG, f), 'utf8'), { filename: f });
  return globalThis.V;
}
