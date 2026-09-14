import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo.js',
  'zone/piano-terra/scopa.js', 'zone/piano-terra/bot-scopa.js');
const legale = (S, st, m) => S.mosseLegali(st, st.turno)
  .some(x => x.carta === m.carta && x.presa.length === m.presa.length && x.presa.every(c => m.presa.includes(c)));

// Gioca una partita intera: livelli[posto] dice il livello del bot a quel posto.
function partita(Vx, seme, livelli, rng) {
  const S = Vx.giochi.scopa;
  let st = S.nuovaPartita(seme, { giocatori: livelli.length }), passi = 0;
  while (!S.finita(st)) {
    const m = S.bot(st, st.turno, livelli[st.turno], rng);
    assert.ok(legale(S, st, m), 'il bot deve fare solo mosse legali');
    st = S.applica(st, m);
    assert.ok(++passi < 20000);
  }
  return st;
}

test('i bot di ogni livello fanno solo mosse legali e finiscono la partita', () => {
  const Vx = V();
  for (const liv of [1, 5, 10]) for (let i = 0; i < 20; i++) {
    partita(Vx, `legali-${liv}-${i}`, i % 2 ? [liv, liv] : [liv, liv, liv, liv], Vx.rng(Vx.sha256('r' + i)));
  }
});

test('il livello 10 batte il livello 1 più di metà delle volte', () => {
  const Vx = V();
  let vinte = 0;
  for (let i = 0; i < 40; i++) {
    const forte = i % 2;
    const livelli = forte ? [1, 10] : [10, 1];
    const st = partita(Vx, 'forza' + i, livelli, Vx.rng(Vx.sha256('b' + i)));
    if (st.vincitore === forte) vinte++;
  }
  assert.ok(vinte > 20, `vinte ${vinte} su 40`);
});

test('il bot non guarda le carte degli altri', () => {
  const Vx = V(), S = Vx.giochi.scopa;
  for (let i = 0; i < 30; i++) {
    const st = S.nuovaPartita('segreto' + i);
    const altro = structuredClone(st);
    const tolte = new Set([...st.mani[1], ...st.tavola, ...st.mani[0]]);
    altro.mani[0] = Vx.mazzoNapoletano().filter(c => !tolte.has(c)).slice(0, 3);
    const a = S.bot(st, 1, 10, Vx.rng(Vx.sha256('s' + i)));
    const b = S.bot(altro, 1, 10, Vx.rng(Vx.sha256('s' + i)));
    assert.deepEqual(a, b);
  }
});
