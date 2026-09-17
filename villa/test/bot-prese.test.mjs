import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo.js', 'zone/piano-terra/briscola.js',
  'zone/piano-terra/tressette.js', 'zone/piano-terra/bot-prese.js');
const GIOCHI = ['briscola', 'tressette'];
const legale = (G, st, m) => G.mosseLegali(st, st.turno).some(x => x.carta === m.carta && x.segnale === m.segnale);
const conta = st => new Set([...st.mazzo, ...st.mani.flat(), ...st.mano.map(g => g.carta), ...st.prese.flat()]).size;

// Gioca una partita intera: livelli[posto] dice il livello del bot a quel posto.
function partita(G, seme, livelli, rng, controlla) {
  let st = G.nuovaPartita(seme, { giocatori: livelli.length }), passi = 0;
  while (!G.finita(st)) {
    const m = G.bot(st, st.turno, livelli[st.turno], rng);
    assert.ok(legale(G, st, m), 'il bot deve fare solo mosse legali');
    if (controlla) controlla(st, m);
    st = G.applica(st, m);
    assert.equal(conta(st), 40);
    assert.ok(++passi < 20000);
  }
  return st;
}

test('i bot di ogni livello fanno solo mosse legali e finiscono la partita, a 2 e a 4', () => {
  const Vx = V();
  for (const g of GIOCHI) for (const liv of [1, 5, 10]) for (let i = 0; i < 6; i++) {
    const st = partita(Vx.giochi[g], `legali-${g}-${liv}-${i}`, i % 2 ? [liv, liv] : [liv, liv, liv, liv], Vx.rng(Vx.sha256('r' + i)));
    assert.equal(st.punti.filter(p => p === st.punti[st.vincitore]).length, 1);
  }
});

test('livelli misti al tavolo a 4', () => {
  const Vx = V();
  for (const g of GIOCHI) for (let i = 0; i < 4; i++)
    partita(Vx.giochi[g], `misti-${g}-${i}`, [1, 10, 5, 3], Vx.rng(Vx.sha256('x' + i)));
});

test('il livello 10 batte il livello 1 più di metà delle volte (a 2)', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    let vinte = 0;
    for (let i = 0; i < 40; i++) {
      const forte = i % 2;
      const st = partita(Vx.giochi[g], `forza-${g}-${i}`, forte ? [1, 10] : [10, 1], Vx.rng(Vx.sha256('b' + i)));
      if (st.vincitore === forte) vinte++;
    }
    assert.ok(vinte > 20, `${g}: vinte ${vinte} su 40`);
  }
});

test('stesso rng, stessa partita', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    const a = partita(Vx.giochi[g], 'ripeti', [5, 7], Vx.rng(Vx.sha256('q')));
    const b = partita(Vx.giochi[g], 'ripeti', [5, 7], Vx.rng(Vx.sha256('q')));
    assert.deepEqual(a, b);
  }
});

// Rimescola le carte che il posto non può vedere: mani degli altri e mazzo coperto
// (restano al loro posto la briscola scoperta e le carte pescate a vista del tressette a due).
function nascondi(Vx, st, posto, seme) {
  const altro = structuredClone(st);
  const pubbliche = new Set((st.pescate || []).map(x => x.carta));
  if (st.gioco === 'briscola' && st.mazzo.length) pubbliche.add(st.briscola);
  const coperte = [];
  for (let q = 0; q < st.n; q++) if (q !== posto) coperte.push(...st.mani[q].filter(c => !pubbliche.has(c)));
  coperte.push(...st.mazzo.filter(c => !pubbliche.has(c)));
  const mescolate = Vx.mescola(coperte, seme);
  for (let q = 0; q < st.n; q++) if (q !== posto) altro.mani[q] = st.mani[q].map(c => pubbliche.has(c) ? c : mescolate.shift());
  altro.mazzo = st.mazzo.map(c => pubbliche.has(c) ? c : mescolate.shift());
  return altro;
}

test('il bot non guarda le carte degli altri né il mazzo', () => {
  const Vx = V();
  for (const g of GIOCHI) for (const n of [2, 4]) {
    const G = Vx.giochi[g];
    let diversi = 0;
    for (let i = 0; i < 12; i++) {
      let st = G.nuovaPartita(`segreto-${g}-${n}-${i}`, { giocatori: n });
      const r = Vx.rng(Vx.sha256('avanti' + i)), passi = Math.floor(r() * 36);
      for (let k = 0; k < passi && !st.finita; k++) st = G.applica(st, G.bot(st, st.turno, 1, r));
      if (st.finita) continue;
      for (const liv of [3, 6, 10]) {
        const altro = nascondi(Vx, st, st.turno, 'm' + i);
        if (JSON.stringify(altro.mani) !== JSON.stringify(st.mani)) diversi++;
        const a = G.bot(st, st.turno, liv, Vx.rng(Vx.sha256('s' + i)));
        const b = G.bot(altro, st.turno, liv, Vx.rng(Vx.sha256('s' + i)));
        assert.deepEqual(a, b, `${g} a ${n}, livello ${liv}`);
      }
    }
    assert.ok(diversi > 10, 'le mani nascoste devono cambiare davvero');
  }
});

test('memoria: il livello 3 non ricorda, il 10 ricorda tutto', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    const G = Vx.giochi[g];
    let st = G.nuovaPartita('memoria');
    for (let k = 0; k < 12; k++) st = G.applica(st, G.mossaDiRiserva(st, st.turno));
    const prese = st.prese.flat();
    assert.ok(prese.length > 0);
    assert.deepEqual(G.carteRicordate(st, 3), []);
    assert.deepEqual(G.carteRicordate(st, 10), prese);
    assert.ok(G.carteRicordate(st, 6).length <= prese.length);
  }
});

// Mette in mano al posto di turno le carte indicate e costruisce la mano in corso.
function prepara(Vx, G, st, mia, inTavola) {
  const usate = [...mia, ...inTavola.map(g => g.carta), st.briscola].filter(Boolean);
  const pool = Vx.mazzoNapoletano().filter(c => !usate.includes(c));
  const k = st.gioco === 'briscola' ? 3 : 10;
  const posto = (inTavola.at(-1).posto + 1) % st.n;
  st.mano = inTavola; st.turno = posto;
  for (let q = 0; q < st.n; q++) st.mani[q] = q === posto ? mia.slice() : pool.splice(0, k - (inTavola.some(x => x.posto === q) ? 1 : 0));
  st.mazzo = st.gioco === 'briscola' ? [...pool.splice(0, st.mazzo.length - 1), st.briscola] : pool.splice(0, st.mazzo.length);
  st.prese = st.prese.map(() => []); st.prese[0] = pool;
  assert.equal(conta(st), 40);
  return posto;
}

test('briscola: ultimo a giocare prende i carichi con la carta più economica, non spreca briscole', () => {
  const Vx = V(), G = Vx.giochi.briscola;
  const st = G.nuovaPartita('euristica');
  st.briscola = '7D'; st.mazzo = [...st.mazzo.filter(c => c !== '7D'), '7D'];
  const assoDiCoppe = structuredClone(st);
  let p = prepara(Vx, G, assoDiCoppe, ['2D', '4D', '5S'], [{ posto: 1, carta: '1C' }]);
  assert.equal(G.bot(assoDiCoppe, p, 10, () => 0.5).carta, '2D', 'taglia l\'asso con la briscola più bassa');
  const scartina = structuredClone(st);
  p = prepara(Vx, G, scartina, ['2D', '5S', '1B'], [{ posto: 1, carta: '4C' }]);
  assert.equal(G.bot(scartina, p, 10, () => 0.5).carta, '5S', 'su una mano da zero non si usa la briscola né il carico');
  const tre = structuredClone(st);
  p = prepara(Vx, G, tre, ['1C', '6D', '4S'], [{ posto: 1, carta: '3C' }]);
  assert.equal(G.bot(tre, p, 10, () => 0.5).carta, '1C', 'prende il 3 con l\'asso dello stesso seme');
});

test('tressette a 4: non supera la carta vincente del compagno, prende se ci sono punti', () => {
  const Vx = V(), G = Vx.giochi.tressette;
  const st = G.nuovaPartita('compagno', { giocatori: 4 });
  const a = structuredClone(st);
  let p = prepara(Vx, G, a, ['3C', '4C', '5B', '6B', '7B', '4S', '5S', '6S', '7S', '4D'],
    [{ posto: 0, carta: '5C' }, { posto: 1, carta: '1C' }, { posto: 2, carta: '6C' }]);
  // posto 3 è ultimo, il compagno (1) ha l'asso vincente: si risponde basso.
  assert.equal(p, 3);
  assert.equal(G.bot(a, p, 10, () => 0.5).carta, '4C');
  const b = structuredClone(st);
  p = prepara(Vx, G, b, ['3C', '4C', '5B', '6B', '7B', '4S', '5S', '6S', '7S', '4D'],
    [{ posto: 0, carta: '5C' }, { posto: 1, carta: '6C' }, { posto: 2, carta: '1C' }]);
  assert.equal(G.bot(b, p, 10, () => 0.5).carta, '3C', 'l\'avversario ha l\'asso: lo prende col 3');
});

test('tressette a 4: i segnali partono solo da chi apre, busso solo col 3 del seme', () => {
  const Vx = V(), G = Vx.giochi.tressette;
  let segnali = 0;
  for (let i = 0; i < 6; i++) {
    partita(G, 'segnali' + i, [10, 7, 10, 4], Vx.rng(Vx.sha256('g' + i)), (st, m) => {
      if (!m.segnale) return;
      segnali++;
      assert.equal(st.mano.length, 0);
      if (m.segnale === 'busso') assert.ok(st.mani[st.turno].includes('3' + m.carta.slice(-1)));
    });
    const due = G.nuovaPartita('due' + i);
    assert.ok(!G.bot(due, due.turno, 10, Vx.rng(Vx.sha256('h' + i))).segnale);
  }
  assert.ok(segnali > 0, 'almeno un segnale');
});
