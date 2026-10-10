// Unisce guscio + motore + zone in un file unico per ogni ingresso della Villa.
// Uso: node villa/impacchetta.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VILLA = dirname(fileURLToPath(import.meta.url));
const SORG = join(VILLA, 'sorgente'), RADICE = join(VILLA, '..');
const ingressi = JSON.parse(readFileSync(join(SORG, 'ingressi.json'), 'utf8'));
const guscio = readFileSync(join(SORG, 'guscio.html'), 'utf8');

for (const [nome, ing] of Object.entries(ingressi)) {
  const js = ing.file.map(f => `// ---- ${f}\n` + readFileSync(join(SORG, f), 'utf8')).join('\n');
  if (/<\/script/i.test(js)) throw new Error(`${nome}: il codice contiene "</script"`);
  const html = guscio.replace('<!--TITOLO-->', ing.titolo)
    .replace('/*INGRESSO*/', JSON.stringify(nome))
    .replace('/*CODICE*/', () => js);
  const out = join(RADICE, ing.uscita);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log(`${ing.uscita}  ${Math.round(html.length / 1024)} KB`);
}
