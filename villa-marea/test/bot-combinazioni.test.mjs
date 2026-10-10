import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo-francese.js', 'zone/piano-terra/combinazioni.js',
  'zone/piano-terra/scala40.js', 'zone/piano-terra/burraco.js', 'zone/piano-terra/bot-combinazioni.js');
const GIOCHI = ['scala40', 'burraco'];
const tutte = st => [...st.mazzo, ...st.scarti, ...st.mani.flat(), ...st.giochi.flatMap(g => g.carte), ...(st.pozzetti || []).flat()];
const MAX_CHIAMATE = 60;   // mosse del bot dentro un solo turno

// La mossa è ammessa? Pesca e scarto devono stare fra le mosse legali; calate e attacchi passano dai controlli.
function legale(G, st, m) {
  const p = st.turno;
  if (m.tipo === 'cala') return G.puoCalare(st, p, m.gruppi);
  if (m.tipo === 'attacca') return G.puoAttaccare(st, p, m.gioco, m.carte);
  return G.mosseLegali(st, p).some(x => x.tipo === m.tipo && x.da === m.da && x.carta === m.carta);
}

function conserva(st) {
  const c = tutte(st);
  assert.equal(c.length, 108);
  assert.equal(new Set(c).size, 108);
}

// Partita intera fra bot (livelli[posto]); breve per stare nei tempi.
function partita(G, seme, livelli, rng) {
  let st = G.nuovaPartita(seme, { giocatori: livelli.length, breve: true }), passi = 0, nelTurno = 0, turno = st.turno;
  while (!G.finita(st)) {
    const m = G.bot(st, st.turno, livelli[st.turno], rng);
    assert.ok(m, 'il bot deve sempre avere una mossa');
    assert.ok(legale(G, st, m), `mossa non legale: ${JSON.stringify(m)}`);
    const prima = st.turno;
    st = G.applica(st, m);
    conserva(st);
    if (st.turno === prima && !st.finita) assert.ok(++nelTurno < MAX_CHIAMATE, 'il turno deve finire');
    else nelTurno = 0;
    assert.ok(++passi < 30000, 'la partita deve finire');
  }
  return st;
}

test('i bot fanno solo mosse legali e finiscono la partita, a 2 e a 4', () => {
  const Vx = V();
  const tavoli = [[1, 10], [5, 5], [10, 10], [10, 5], [1, 5, 10, 5], [5, 5, 5, 5], [10, 1, 10, 1]];
  for (const g of GIOCHI) tavoli.forEach((liv, i) => {
    const G = Vx.giochi[g];
    const st = partita(G, `legali-${g}-${i}`, liv, Vx.rng(Vx.sha256('r' + i)));
    if (g === 'burraco') {
      const max = Math.max(...st.punti);
      assert.ok(max >= st.obiettivo);
      assert.equal(st.punti[st.vincitore], max);
      assert.equal(st.punti.filter(p => p === max).length, 1);
    } else {
      assert.equal(st.eliminati[st.vincitore], false);
      assert.ok(st.eliminati.filter(x => !x).length <= 1);
    }
    assert.ok(G.riepilogo(st));
    assert.deepEqual(G.mosseLegali(st, st.turno), []);
    assert.equal(G.bot(st, st.turno, 5, Math.random), null);
  });
});

test('il livello 10 batte il livello 1 più di metà delle volte (a 2)', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    let vinte = 0;
    for (let i = 0; i < 30; i++) {
      const forte = i % 2;
      const st = partita(Vx.giochi[g], `forza-${g}-${i}`, forte ? [1, 10] : [10, 1], Vx.rng(Vx.sha256('b' + i)));
      if (st.vincitore === forte) vinte++;
    }
    assert.ok(vinte > 15, `${g}: vinte ${vinte} su 30`);
  }
});

test('il livello 10 batte il livello 3 (a 2)', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    let vinte = 0;
    for (let i = 0; i < 12; i++) {
      const forte = i % 2;
      const st = partita(Vx.giochi[g], `medio-${g}-${i}`, forte ? [3, 10] : [10, 3], Vx.rng(Vx.sha256('m' + i)));
      if (st.vincitore === forte) vinte++;
    }
    assert.ok(vinte >= 6, `${g}: vinte ${vinte} su 12`);
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

// Rimescola ciò che il posto non vede: mani degli altri, mazzo, pozzetti (le dimensioni restano).
function nascondi(Vx, st, posto, seme) {
  const altro = structuredClone(st);
  const coperte = [...st.mazzo, ...(st.pozzetti || []).flat()];
  for (let q = 0; q < st.n; q++) if (q !== posto) coperte.push(...st.mani[q]);
  const m = Vx.mescola(coperte, seme);
  altro.mazzo = st.mazzo.map(() => m.shift());
  if (st.pozzetti) altro.pozzetti = st.pozzetti.map(p => p.map(() => m.shift()));
  for (let q = 0; q < st.n; q++) if (q !== posto) altro.mani[q] = st.mani[q].map(() => m.shift());
  return altro;
}

test('il bot non guarda le carte degli altri, il mazzo né i pozzetti', () => {
  const Vx = V();
  for (const g of GIOCHI) for (const n of [2, 4]) {
    const G = Vx.giochi[g];
    let diversi = 0, provati = 0;
    for (let i = 0; i < 10; i++) {
      let st = G.nuovaPartita(`segreto-${g}-${n}-${i}`, { giocatori: n });
      const r = Vx.rng(Vx.sha256('avanti' + i)), passi = Math.floor(r() * 120);
      for (let k = 0; k < passi && !st.finita; k++) st = G.applica(st, G.bot(st, st.turno, 8, r));
      if (st.finita) continue;
      for (const liv of [3, 6, 10]) {
        const altro = nascondi(Vx, st, st.turno, 'm' + i + liv);
        if (JSON.stringify(altro.mazzo) !== JSON.stringify(st.mazzo)) diversi++;
        const a = G.bot(st, st.turno, liv, Vx.rng(Vx.sha256('s' + i)));
        const b = G.bot(altro, st.turno, liv, Vx.rng(Vx.sha256('s' + i)));
        assert.deepEqual(a, b, `${g} a ${n}, livello ${liv}`);
        provati++;
      }
    }
    assert.ok(provati >= 15 && diversi >= 15, 'le carte nascoste devono cambiare davvero');
  }
});

test('livello 1: pesca dal mazzo e non cala mai', () => {
  const Vx = V();
  for (const g of GIOCHI) {
    const G = Vx.giochi[g], r = Vx.rng(Vx.sha256('uno'));
    let st = G.nuovaPartita('uno-' + g);
    for (let k = 0; k < 60 && !st.finita; k++) {
      const m = G.bot(st, st.turno, 1, r);
      if (st.turno === 0) {
        assert.ok(m.tipo === 'scarta' || m.da === 'mazzo', JSON.stringify(m));
      }
      st = G.applica(st, st.turno === 0 ? m : G.bot(st, st.turno, 1, r));
    }
    assert.equal(st.giochi.length, 0);
  }
});

test('scala 40: il bot apre con 40 punti e prende lo scarto che gli serve per aprire', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = G.nuovaPartita('apri');
  const mano = ['10Q#1', 'JQ#1', 'KQ#1', '5C#1', '9P#1', '2C#1', '4Q#1', '6F#1', '8P#1', '3F#1', '5P#1', '7C#1', 'AQ#1'];
  const usate = new Set([...mano, 'QQ#1']);
  const resto = Vx.mazzoFrancese().filter(c => !usate.has(c));
  st.mani = [resto.splice(0, 13), mano]; st.scarti = ['QQ#1']; st.mazzo = resto; st.turno = 1; st.fase = 'pesca';
  conserva(st);
  const m = G.bot(st, 1, 7, () => 0.5);
  assert.deepEqual(m, { tipo: 'pesca', da: 'scarto' });
  let s = G.applica(st, m);
  const c = G.bot(s, 1, 7, () => 0.5);
  assert.equal(c.tipo, 'cala');
  assert.ok(c.gruppi.flat().includes('QQ#1'));
  s = G.applica(s, c);
  assert.equal(s.aperto[1], true);
  assert.equal(G.bot(s, 1, 7, () => 0.5).tipo, 'scarta');
});

test('scarto: il bot tiene le carte che legano e al livello alto non regala al prossimo', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = G.nuovaPartita('scarto');
  const mano = ['5C#1', '6C#1', '4Q#1', 'KP#1'];
  const tavolo = ['10F#1', 'JF#1', 'QF#1'];
  const usate = new Set([...mano, ...tavolo]);
  const resto = Vx.mazzoFrancese().filter(c => !usate.has(c));
  st.mani = [mano, resto.splice(0, 11)]; st.pozzetti = [resto.splice(0, 11), resto.splice(0, 11)];
  st.scarti = [resto.shift()]; st.mazzo = resto;
  st.giochi = [{ squadra: 1, posto: 1, carte: tavolo, tipo: 'scala', jolly: [] }];
  st.turno = 0; st.fase = 'gioca';
  conserva(st);
  assert.deepEqual(G.bot(st, 0, 10, () => 0.5), { tipo: 'scarta', carta: 'KP#1' }, 'la carta isolata');
  // Se la K di picche servisse all'avversario, al livello 10 scarta un'altra carta.
  st.giochi[0].carte = ['10P#1', 'JP#1', 'QP#1'];
  st.mazzo = [...st.mazzo.filter(c => !['10P#1', 'JP#1', 'QP#1'].includes(c)), ...tavolo];
  conserva(st);
  const alto = G.bot(st, 0, 10, () => 0.5);
  assert.equal(alto.carta, '4Q#1');
  assert.equal(G.bot(st, 0, 5, () => 0.5).carta, 'KP#1', 'sotto il livello 6 non ci pensa');
  // Una matta non si scarta.
  st.mani[0] = ['5C#1', 'JK#1', '4Q#1', 'KP#1'];
  st.mazzo = [...st.mazzo.filter(c => c !== 'JK#1'), '6C#1'];
  conserva(st);
  for (const liv of [2, 5, 10]) assert.notEqual(G.bot(st, 0, liv, () => 0.5).carta, 'JK#1');
});
