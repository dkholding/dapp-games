import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo.js', 'zone/piano-terra/tressette.js');
const tutte = st => [...st.mazzo, ...st.mani.flat(), ...st.mano.map(g => g.carta), ...st.prese.flat()];
function conserva(st) {
  const c = tutte(st);
  assert.equal(c.length, 40);
  assert.equal(new Set(c).size, 40);
}

test('nuova partita a 2 e a 4', () => {
  const S = V().giochi.tressette;
  const a = S.nuovaPartita('x');
  assert.deepEqual(a.mani.map(h => h.length), [10, 10]);
  assert.equal(a.mazzo.length, 20);
  assert.equal(a.turno, 1);
  assert.equal(a.obiettivo, 21);
  conserva(a);
  const b = S.nuovaPartita('x', { giocatori: 4 });
  assert.deepEqual(b.mani.map(h => h.length), [10, 10, 10, 10]);
  assert.equal(b.mazzo.length, 0);
  assert.equal(b.prese.length, 2);
  conserva(b);
  assert.throws(() => S.nuovaPartita('x', { giocatori: 3 }));
});

test('chi prende la mano: il 3 batte l\'asso, fuori seme non vince', () => {
  const S = V().giochi.tressette;
  const m = (...c) => c.map((carta, posto) => ({ posto, carta }));
  assert.equal(S.vincitoreMano(m('1C', '3C')), 1, '3 batte asso');
  assert.equal(S.vincitoreMano(m('2C', '3C')), 1, '3 batte 2');
  assert.equal(S.vincitoreMano(m('1C', '2C')), 1, '2 batte asso');
  assert.equal(S.vincitoreMano(m('10C', '1C')), 1, 'asso batte re');
  assert.equal(S.vincitoreMano(m('4C', '3S')), 0, 'fuori seme non vince mai');
  assert.equal(S.vincitoreMano(m('4C', '3S', '5C', '2D')), 2);
  assert.equal(S.vincitoreMano(m('7B', '8B', '10B', '9B')), 2, 're batte cavallo e fante');
});

test('obbligo di rispondere al seme', () => {
  const S = V().giochi.tressette;
  const st = S.nuovaPartita('seme');
  const pool = V().mazzoNapoletano().filter(c => !['4C', '3C', '1S', '5C'].includes(c));
  st.mani = [['3C', '1S', '5C', ...pool.slice(0, 7)], ['4C', ...pool.slice(7, 16)]];
  st.mazzo = pool.slice(16, 36);
  conserva(st);
  const a = S.applica(st, { carta: '4C' });
  const legali = S.mosseLegali(a, 0).map(m => m.carta).sort();
  assert.deepEqual(legali, a.mani[0].filter(c => c.endsWith('C')).sort());
  assert.throws(() => S.applica(a, { carta: '1S' }), /rispondere/);
  const b = S.applica(a, { carta: '3C' });
  assert.equal(b.ultimaMossa.vincitore, 0);
  // Senza carte del seme si può giocare qualsiasi carta.
  const c = structuredClone(a);
  c.mani[0] = c.mani[0].filter(x => !x.endsWith('C'));
  c.mazzo.push(...a.mani[0].filter(x => x.endsWith('C')));
  assert.equal(S.mosseLegali(c, 0).length, c.mani[0].length);
  assert.throws(() => S.applica(a, { carta: '9Z' }), /non in mano/);
});

test('tressette a due: pesca prima chi vince, le carte pescate sono pubbliche', () => {
  const S = V().giochi.tressette;
  const st = S.nuovaPartita('pesca');
  const pool = V().mazzoNapoletano().filter(c => !['1B', '3B'].includes(c));
  st.mani = [['3B', ...pool.slice(0, 9)], ['1B', ...pool.slice(9, 18)]];
  st.mazzo = pool.slice(18);
  const a = S.applica(st, { carta: '1B' });
  const b = S.applica(a, { carta: '3B' });
  assert.equal(b.ultimaMossa.chiudeMano, true);
  assert.equal(b.ultimaMossa.vincitore, 0);
  assert.deepEqual(b.ultimaMossa.pescate, [{ posto: 0, carta: pool[18] }, { posto: 1, carta: pool[19] }]);
  assert.deepEqual(b.pescate, b.ultimaMossa.pescate);
  assert.ok(b.mani[0].includes(pool[18]) && b.mani[1].includes(pool[19]));
  assert.equal(b.terzi[0], 4, 'asso (3/3) più il 3 (1/3)');
  assert.equal(b.turno, 0);
  assert.equal(st.mano.length, 0, 'lo stato di partenza non cambia');
  conserva(b);
});

test('conteggio: 11 punti a smazzata, arrotondati per difetto, ultima presa +1', () => {
  const Vx = V(), S = Vx.giochi.tressette, mazzo = Vx.mazzoNapoletano();
  assert.equal(mazzo.reduce((a, c) => a + S.terzi(c), 0), 32);
  const r = S.contaSmazzata([mazzo.slice(0, 20), mazzo.slice(20)], 1);
  assert.deepEqual(r.ultima, [0, 1]);
  assert.equal(r.totale[0] + r.totale[1], 11);
  const s = S.contaSmazzata([['1D', '2D', '3D', '10D'], mazzo.filter(c => !['1D', '2D', '3D', '10D'].includes(c))], 0);
  assert.deepEqual(s.terziCarte, [6, 26]);
  assert.deepEqual(s.totale, [3, 8]);
});

test('segnali solo a coppie e solo a chi apre la mano', () => {
  const S = V().giochi.tressette;
  const due = S.nuovaPartita('s2');
  assert.ok(S.mosseLegali(due, due.turno).every(m => !m.segnale));
  assert.throws(() => S.applica(due, { carta: due.mani[due.turno][0], segnale: 'busso' }));
  const st = S.nuovaPartita('s4', { giocatori: 4 });
  const p = st.turno, mosse = S.mosseLegali(st, p);
  assert.equal(mosse.length, 40);
  for (const s of ['busso', 'striscio', 'volo']) assert.equal(mosse.filter(m => m.segnale === s).length, 10);
  const carta = st.mani[p][0];
  assert.throws(() => S.applica(st, { carta, segnale: 'fischio' }));
  const a = S.applica(st, { carta, segnale: 'volo' });
  assert.equal(a.ultimaMossa.segnale, 'volo');
  assert.deepEqual(a.segnali, [{ posto: p, carta, segnale: 'volo' }]);
  assert.ok(S.mosseLegali(a, a.turno).every(m => !m.segnale), 'chi risponde non segnala');
  assert.throws(() => S.applica(a, { carta: S.mosseLegali(a, a.turno)[0].carta, segnale: 'busso' }));
});

test('abbandono e riepilogo', () => {
  const S = V().giochi.tressette;
  const st = S.nuovaPartita('x');
  const a = S.abbandona(st, 0);
  assert.equal(a.finita, true);
  assert.equal(a.vincitore, 1);
  assert.equal(S.riepilogo(st), null);
});

test('partite intere a 2 e a 4 finiscono, conservano le carte, 11 punti a smazzata', () => {
  for (const n of [2, 4]) {
    const S = V().giochi.tressette;
    let st = S.nuovaPartita('fine-' + n, { giocatori: n }), passi = 0, smazzate = 0;
    while (!S.finita(st)) {
      conserva(st);
      const m = S.mossaDiRiserva(st, st.turno);
      assert.ok(S.mosseLegali(st, st.turno).some(x => x.carta === m.carta && !x.segnale));
      const prima = st.smazzata;
      st = S.applica(st, m);
      if (st.smazzata !== prima || st.finita) {
        smazzate++;
        const d = st.ultimaSmazzata;
        assert.equal(d.totale[0] + d.totale[1], 11);
        assert.equal(d.carte[0] + d.carte[1], 40);
        assert.equal(st.ultimaMossa.ultima, true);
        const r = S.riepilogo(st);
        assert.deepEqual(r.righe.map(x => x.nome), ['Carte prese', 'Punti delle carte', 'Ultima presa']);
        assert.deepEqual(r.totale, d.totale);
        if (!st.finita) {
          assert.equal(st.mazziere, smazzate % n);
          assert.equal(st.turno, (st.mazziere + 1) % n);
        }
      }
      assert.ok(++passi < 20000, 'la partita deve finire');
    }
    assert.ok(smazzate >= 2);
    assert.ok(st.punti[st.vincitore] >= 21);
    assert.equal(st.punti.filter(p => p === st.punti[st.vincitore]).length, 1);
    assert.deepEqual(S.mosseLegali(st, st.turno), []);
  }
});
