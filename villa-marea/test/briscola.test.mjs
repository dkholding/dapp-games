import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo.js', 'zone/piano-terra/briscola.js');
const tutte = st => [...st.mazzo, ...st.mani.flat(), ...st.mano.map(g => g.carta), ...st.prese.flat()];

// Tutte le 40 carte ci sono una volta sola, e la briscola è in fondo al mazzo o già uscita.
function conserva(st) {
  const c = tutte(st);
  assert.equal(c.length, 40);
  assert.equal(new Set(c).size, 40);
  assert.ok(c.includes(st.briscola));
  if (st.mazzo.length) assert.equal(st.mazzo.at(-1), st.briscola);
}

test('nuova partita a 2 e a 4', () => {
  const S = V().giochi.briscola;
  const a = S.nuovaPartita('x');
  assert.deepEqual(a.mani.map(h => h.length), [3, 3]);
  assert.equal(a.mazzo.length, 34);
  assert.equal(a.turno, 1);
  assert.equal(a.obiettivo, 1);
  conserva(a);
  const b = S.nuovaPartita('x', { giocatori: 4, obiettivo: 3 });
  assert.deepEqual(b.mani.map(h => h.length), [3, 3, 3, 3]);
  assert.equal(b.mazzo.length, 28);
  assert.equal(b.prese.length, 2);
  assert.equal(b.obiettivo, 3);
  conserva(b);
  assert.deepEqual(S.nuovaPartita('x'), S.nuovaPartita('x'), 'stesso seme, stessa smazzata');
  assert.throws(() => S.nuovaPartita('x', { giocatori: 3 }));
});

test('chi prende la mano', () => {
  const S = V().giochi.briscola;
  const m = (...c) => c.map((carta, posto) => ({ posto, carta }));
  assert.equal(S.vincitoreMano(m('1C', '2S'), 'S'), 1, 'la briscola batte l\'asso del seme di uscita');
  assert.equal(S.vincitoreMano(m('4C', '1S'), 'D'), 0, 'fuori seme non vince mai');
  assert.equal(S.vincitoreMano(m('4C', '3C'), 'D'), 1, '3 batte 4');
  assert.equal(S.vincitoreMano(m('3C', '1C'), 'D'), 1, 'asso batte 3');
  assert.equal(S.vincitoreMano(m('10C', '7C'), 'D'), 0, 're batte 7');
  assert.equal(S.vincitoreMano(m('2D', '1C'), 'D'), 0, 'il 2 di briscola batte l\'asso');
  assert.equal(S.vincitoreMano(m('5B', '7B', '2D', '4D'), 'D'), 3, 'la briscola più alta');
  assert.equal(S.vincitoreMano(m('5B', '1C', '3S', '6B'), 'D'), 3, 'il più alto del seme di uscita');
});

test('conteggio: il mazzo intero vale 120, vince chi supera 60', () => {
  const Vx = V(), S = Vx.giochi.briscola, mazzo = Vx.mazzoNapoletano();
  assert.equal(mazzo.reduce((a, c) => a + S.punti(c), 0), 120);
  const r = S.contaSmazzata([mazzo.slice(0, 20), mazzo.slice(20)]);
  assert.equal(r.valori[0] + r.valori[1], 120);
  assert.deepEqual(S.contaSmazzata([mazzo, []]).vinta, [1, 0]);
  const mezzo = ['1D', '3D', '1C', '3C', '1S', '10S', '9S'];
  const sessanta = S.contaSmazzata([mezzo, mazzo.filter(c => !mezzo.includes(c))]);
  assert.deepEqual(sessanta.valori, [60, 60]);
  assert.equal(sessanta.pareggio, true);
  assert.deepEqual(sessanta.totale, [0, 0]);
});

test('mano chiusa: prende chi vince, pesca per primo, poi gli altri', () => {
  const Vx = V(), S = Vx.giochi.briscola;
  const st = S.nuovaPartita('pesca');
  const sb = st.briscola.slice(-1), altro = ['D', 'C', 'S', 'B'].find(x => x !== sb);
  const asso = '1' + altro, taglio = st.briscola === '2' + sb ? '4' + sb : '2' + sb;
  const pool = Vx.mazzoNapoletano().filter(c => ![asso, taglio, st.briscola].includes(c));
  st.mani = [[taglio, pool[0], pool[1]], [asso, pool[2], pool[3]]];
  st.mazzo = [...pool.slice(4), st.briscola];
  conserva(st);
  const a = S.applica(st, { carta: asso });
  assert.equal(a.turno, 0);
  assert.equal(a.ultimaMossa.chiudeMano, false);
  assert.deepEqual(a.mano, [{ posto: 1, carta: asso }]);
  const b = S.applica(a, { carta: taglio });
  assert.equal(b.ultimaMossa.chiudeMano, true);
  assert.equal(b.ultimaMossa.vincitore, 0);
  assert.deepEqual(b.prese[0].sort(), [asso, taglio].sort());
  assert.deepEqual(b.ultimaMossa.pescate, [{ posto: 0, carta: pool[4] }, { posto: 1, carta: pool[5] }]);
  assert.equal(b.turno, 0);
  assert.equal(b.mano.length, 0);
  assert.equal(st.mano.length, 0, 'lo stato di partenza non cambia');
  conserva(b);
});

test('mosse non valide', () => {
  const S = V().giochi.briscola;
  const st = S.nuovaPartita('x');
  assert.equal(S.mosseLegali(st, 0).length, 0, 'non è il suo turno');
  assert.equal(S.mosseLegali(st, 1).length, 3);
  const fuori = st.mani[0][0];
  assert.throws(() => S.applica(st, { carta: fuori }), /non in mano/);
  assert.throws(() => S.applica(st, { carta: st.mani[1][0], segnale: 'busso' }));
  assert.throws(() => S.applica(st, null));
});

test('abbandono e riepilogo', () => {
  const S = V().giochi.briscola;
  const st = S.nuovaPartita('x', { giocatori: 4 });
  const a = S.abbandona(st, 2);
  assert.equal(a.finita, true);
  assert.equal(a.vincitore, 1);
  assert.equal(a.abbandono, 2);
  assert.equal(S.riepilogo(st), null);
});

test('partite intere a 2 e a 4 finiscono, conservano le carte, contano 120', () => {
  for (const n of [2, 4]) for (const obiettivo of [1, 2, 3]) {
    const S = V().giochi.briscola;
    let st = S.nuovaPartita(`fine-${n}-${obiettivo}`, { giocatori: n, obiettivo }), passi = 0, smazzate = 0;
    while (!S.finita(st)) {
      conserva(st);
      const m = S.mossaDiRiserva(st, st.turno);
      assert.ok(S.mosseLegali(st, st.turno).some(x => x.carta === m.carta));
      const prima = st.smazzata;
      st = S.applica(st, m);
      if (st.smazzata !== prima || st.finita) {
        smazzate++;
        const d = st.ultimaSmazzata;
        assert.equal(d.valori[0] + d.valori[1], 120);
        assert.equal(d.carte[0] + d.carte[1], 40);
        const r = S.riepilogo(st);
        assert.equal(r.righe.length, 3);
        assert.deepEqual(r.totale, d.vinta);
      }
      assert.ok(++passi < 5000, 'la partita deve finire');
    }
    assert.ok(smazzate >= obiettivo);
    assert.equal(st.punti[st.vincitore], obiettivo);
    assert.equal(st.punti.filter(p => p === st.punti[st.vincitore]).length, 1);
    assert.deepEqual(S.mosseLegali(st, st.turno), []);
    assert.throws(() => S.applica(st, { carta: '1D' }));
  }
});

test('il mazziere ruota e apre chi gli sta dopo', () => {
  const S = V().giochi.briscola;
  let st = S.nuovaPartita('giro', { giocatori: 4, obiettivo: 99 });
  while (st.smazzata === 0) st = S.applica(st, S.mossaDiRiserva(st, st.turno));
  assert.equal(st.mazziere, 1);
  assert.equal(st.turno, 2);
  assert.equal(st.mano.length, 0);
});
