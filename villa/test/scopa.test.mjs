import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo.js', 'zone/piano-terra/scopa.js');
const conta = st => st.mazzo.length + st.tavola.length + st.mani.flat().length + st.prese.flat().length;

test('mazzo: 40 carte diverse', () => {
  const m = V().mazzoNapoletano();
  assert.equal(m.length, 40);
  assert.equal(new Set(m).size, 40);
});

test('nuova partita a 2 e a 4', () => {
  const S = V().giochi.scopa;
  const a = S.nuovaPartita('x', { giocatori: 2 });
  assert.equal(a.tavola.length, 4);
  assert.deepEqual(a.mani.map(h => h.length), [3, 3]);
  assert.equal(a.mazzo.length, 30);
  assert.equal(a.turno, 1);
  assert.equal(conta(a), 40);
  const b = S.nuovaPartita('x', { giocatori: 4 });
  assert.equal(b.prese.length, 2);
  assert.equal(b.mazzo.length, 24);
  assert.equal(conta(b), 40);
});

test('prese: la carta singola uguale ha la precedenza sulla somma', () => {
  const S = V().giochi.scopa;
  assert.deepEqual(S.prese(['3D', '4C', '7S'], '7B'), [['7S']]);
  assert.deepEqual(S.prese(['3D', '4C'], '7B'), [['3D', '4C']]);
  assert.equal(S.prese(['1C', '4S', '2B', '3D'], '5D').length, 2);
  assert.deepEqual(S.prese(['9C'], '2D'), []);
});

test('obbligo di presa e presa non valida', () => {
  const S = V().giochi.scopa;
  const st = S.nuovaPartita('x');
  st.tavola = ['2D', '3C', '9S']; st.mani[1] = ['5S', '8B', '1C']; st.turno = 1;
  const m = S.mosseLegali(st, 1);
  assert.deepEqual(m.filter(x => x.carta === '5S').map(x => x.presa), [['2D', '3C']]);
  assert.equal(S.mosseLegali(st, 0).length, 0);
  assert.throws(() => S.applica(st, { carta: '5S', presa: [] }));
  assert.throws(() => S.applica(st, { carta: '7D', presa: [] }));
});

test("scopa conta, ma non all'ultima carta della smazzata", () => {
  const S = V().giochi.scopa;
  const st = S.nuovaPartita('x');
  st.tavola = ['2D', '3C']; st.mani[1] = ['5S', '8B', '1C']; st.turno = 1;
  const d = S.applica(st, { carta: '5S', presa: ['2D', '3C'] });
  assert.equal(d.scope[1], 1);
  assert.equal(d.tavola.length, 0);
  assert.equal(d.ultimaMossa.scopa, true);
  assert.equal(st.scope[1], 0, 'lo stato di partenza non cambia');

  const u = S.nuovaPartita('x');
  u.mazzo = []; u.mani = [[], ['5S']]; u.tavola = ['2D', '3C']; u.turno = 1; u.prese = [[], []];
  const f = S.applica(u, { carta: '5S', presa: ['2D', '3C'] });
  assert.equal(f.ultimaSmazzata.scope[1], 0);
  assert.equal(f.ultimaMossa === null || f.ultimaMossa.scopa === false, true);
});

test('conteggio della smazzata', () => {
  const Vx = V(), S = Vx.giochi.scopa;
  const p0 = [...Vx.mazzoNapoletano().filter(c => c.endsWith('D')), '7C', '7S', '7B'];
  const p1 = Vx.mazzoNapoletano().filter(c => !p0.includes(c));
  const r = S.contaSmazzata([p0, p1], [2, 0]);
  assert.deepEqual(r.carte, [0, 1]);
  assert.deepEqual(r.denari, [1, 0]);
  assert.deepEqual(r.settebello, [1, 0]);
  assert.deepEqual(r.primiera, [1, 0]);
  assert.deepEqual(r.totale, [5, 1]);
  assert.equal(S.valorePrimiera(['7D', '7C', '7S']), 0);
  assert.equal(S.valorePrimiera(['7D', '6C', '1S', '10B']), 21 + 18 + 16 + 10);
});

test('una partita intera finisce e conserva le carte', () => {
  for (const n of [2, 4]) {
    const S = V().giochi.scopa;
    let st = S.nuovaPartita('fine-' + n, { giocatori: n }), passi = 0;
    while (!S.finita(st)) {
      assert.equal(conta(st), 40);
      st = S.applica(st, S.mossaDiRiserva(st, st.turno));
      assert.ok(++passi < 20000, 'la partita deve finire');
    }
    assert.ok(st.punti[st.vincitore] >= 11);
    assert.equal(st.punti.filter(p => p === st.punti[st.vincitore]).length, 1);
    assert.deepEqual(S.mosseLegali(st, st.turno), []);
  }
});
