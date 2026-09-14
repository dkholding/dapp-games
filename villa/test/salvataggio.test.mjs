import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const finto = () => {
  const m = new Map();
  return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('giocatore e zone hanno chiavi separate', () => {
  const V = carica('motore/base.js', 'motore/salvataggio.js');
  const s = finto(), a = V.archivio(s);
  assert.deepEqual(a.giocatore(), { nome: '', aspetto: 0 });
  a.salvaGiocatore({ nome: 'Aless', aspetto: 2 });
  a.salvaZona('carte', { giocate: 3 });
  a.salvaZona('veranda', { giocate: 9 });
  assert.deepEqual([...s.m.keys()].sort(), ['villa.carte.v1', 'villa.giocatore.v1', 'villa.veranda.v1']);
  const b = V.archivio(s);
  assert.equal(b.giocatore().nome, 'Aless');
  assert.equal(b.zona('carte').giocate, 3);
  assert.equal(b.zona('veranda').giocate, 9);
  assert.deepEqual(b.zona('giardino'), {});
});

test('JSON rotto e storage che lancia eccezioni', () => {
  const V = carica('motore/base.js', 'motore/salvataggio.js');
  const s = finto(); s.m.set('villa.carte.v1', '{rotto');
  assert.deepEqual(V.archivio(s).zona('carte'), {});
  const cattivo = { getItem() { throw new Error('bloccato'); }, setItem() { throw new Error('bloccato'); } };
  const a = V.archivio(cattivo);
  a.salvaZona('carte', { giocate: 1 });
  assert.equal(a.zona('carte').giocate, 1);
});
