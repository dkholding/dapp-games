import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo-francese.js', 'zone/piano-terra/combinazioni.js',
  'zone/piano-terra/scala40.js');
const tutte = st => [...st.mazzo, ...st.scarti, ...st.mani.flat(), ...st.giochi.flatMap(g => g.carte)];

function conserva(st) {
  const c = tutte(st);
  assert.equal(c.length, 108);
  assert.equal(new Set(c).size, 108);
}

// Mani scelte a mano; il resto delle carte va nel mazzo (in ordine fisso).
function imposta(Vx, st, mani, scarti, mazzoInCima = []) {
  const usate = new Set([...mani.flat(), ...scarti, ...mazzoInCima]);
  st.mani = mani.map(h => h.slice());
  st.scarti = scarti.slice();
  st.mazzo = [...mazzoInCima, ...Vx.mazzoFrancese().filter(c => !usate.has(c))];
  st.giochi = [];
  conserva(st);
  return st;
}

// Riempitivo che non forma combinazioni utili.
const SPARSE = ['2C#2', '4Q#2', '6F#2', '8P#2', '10C#2', 'QQ#2', '3F#2', '5P#2', '7C#2', '9Q#2', 'JF#2', 'KP#2', '2Q#2'];

test('nuova partita a 2 e a 4', () => {
  const G = V().giochi.scala40;
  const a = G.nuovaPartita('x');
  assert.deepEqual(a.mani.map(h => h.length), [13, 13]);
  assert.equal(a.scarti.length, 1);
  assert.equal(a.mazzo.length, 108 - 26 - 1);
  assert.equal(a.turno, 1);
  assert.equal(a.fase, 'pesca');
  assert.equal(a.obiettivo, 101);
  conserva(a);
  const b = G.nuovaPartita('x', { giocatori: 4, breve: true });
  assert.deepEqual(b.mani.map(h => h.length), [13, 13, 13, 13]);
  assert.equal(b.obiettivo, 51);
  assert.deepEqual(b.punti, [0, 0, 0, 0]);
  assert.equal(G.squadra(b, 3), 3, 'a 4 ognuno per sé');
  conserva(b);
  assert.deepEqual(G.nuovaPartita('x'), G.nuovaPartita('x'));
  assert.throws(() => G.nuovaPartita('x', { giocatori: 5 }));
  assert.deepEqual(G.mosseLegali(a, 0), []);
  assert.deepEqual(G.mosseLegali(a, 1), [{ tipo: 'pesca', da: 'mazzo' }]);
});

test('apertura: servono 40 punti nella stessa calata', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = imposta(Vx, G.nuovaPartita('ap'), [
    SPARSE,
    ['5C#1', '6C#1', '7C#1', '10Q#1', 'JQ#1', 'QQ#1', 'KQ#1', 'AF#1', '2F#1', '3F#1', '9P#1', '9C#1', '4P#1'],
  ], ['8Q#1']);
  let s = G.applica(st, { tipo: 'pesca', da: 'mazzo' });
  assert.equal(s.mani[1].length, 14);
  assert.throws(() => G.applica(s, { tipo: 'cala', gruppi: [['5C#1', '6C#1', '7C#1']] }), /40/);
  assert.throws(() => G.applica(s, { tipo: 'cala', gruppi: [['5C#1', '6C#1', '7C#1'], ['AF#1', '2F#1', '3F#1']] }), /40/);
  assert.equal(G.puoCalare(s, 1, [['10Q#1', 'JQ#1', 'QQ#1']]), false, '30 punti');
  assert.equal(G.puoCalare(s, 1, [['10Q#1', 'JQ#1', 'QQ#1', 'KQ#1']]), true, '40 punti');
  assert.equal(G.puoCalare(s, 0, [['10Q#1', 'JQ#1', 'QQ#1', 'KQ#1']]), false, 'non è il suo turno');
  assert.equal(G.puoAttaccare(s, 1, 0, ['9C#1']), false);
  s = G.applica(s, { tipo: 'cala', gruppi: [['5C#1', '6C#1', '7C#1'], ['10Q#1', 'JQ#1', 'QQ#1']] });
  assert.equal(s.aperto[1], true, '18 + 30');
  assert.equal(s.giochi.length, 2);
  assert.equal(s.ultimaMossa.apre, true);
  conserva(s);
  // Aperto: ora si cala e si attacca liberamente.
  s = G.applica(s, { tipo: 'attacca', gioco: 1, carte: ['KQ#1'] });
  assert.deepEqual(s.giochi[1].carte, ['10Q#1', 'JQ#1', 'QQ#1', 'KQ#1']);
  s = G.applica(s, { tipo: 'cala', gruppi: [['AF#1', '2F#1', '3F#1']] });
  assert.equal(G.puoAttaccare(s, 1, 0, ['9C#1']), false);
  assert.throws(() => G.applica(s, { tipo: 'attacca', gioco: 0, carte: ['9C#1'] }));
  assert.throws(() => G.applica(s, { tipo: 'attacca', gioco: 7, carte: ['9C#1'] }));
  conserva(s);
  const legali = G.mosseLegali(s, 1);
  assert.equal(legali.length, s.mani[1].length);
  assert.ok(legali.every(m => m.tipo === 'scarta'));
  s = G.applica(s, legali[0]);
  assert.equal(s.turno, 0);
  assert.equal(s.fase, 'pesca');
  assert.equal(st.giochi.length, 0, 'lo stato di partenza non cambia');
});

test('prendere lo scarto prima di aprire: solo per aprire con quella carta', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const mano = ['10Q#1', 'JQ#1', 'KQ#1', '5C#1', '9P#1', '2C#1', '4Q#1', '6F#1', '8P#1', '3F#1', '5P#1', '7C#1', 'AQ#1'];
  const st = imposta(Vx, G.nuovaPartita('sc'), [SPARSE, mano], ['QQ#1']);
  assert.deepEqual(G.mosseLegali(st, 1).map(m => m.da), ['mazzo', 'scarto']);
  const no = imposta(Vx, G.nuovaPartita('sc'), [SPARSE, mano], ['4C#1']);
  assert.deepEqual(G.mosseLegali(no, 1).map(m => m.da), ['mazzo']);
  assert.throws(() => G.applica(no, { tipo: 'pesca', da: 'scarto' }), /scarto/);
  let s = G.applica(st, { tipo: 'pesca', da: 'scarto' });
  assert.equal(s.ultimaMossa.carta, 'QQ#1');
  assert.deepEqual(G.mosseLegali(s, 1), [], 'finché non apre non può scartare');
  assert.throws(() => G.applica(s, { tipo: 'scarta', carta: '5C#1' }), /aprire/);
  const riserva = G.mossaDiRiserva(s, 1);
  assert.equal(riserva.tipo, 'cala');
  assert.ok(riserva.gruppi.flat().includes('QQ#1'));
  s = G.applica(s, riserva);
  assert.equal(s.aperto[1], true);
  assert.ok(G.mosseLegali(s, 1).length > 0);
  assert.equal(G.mossaDiRiserva(s, 1).tipo, 'scarta');
  conserva(s);
  // Chi ha già aperto prende lo scarto quando vuole, ma non lo riscarta subito.
  const aperto = imposta(Vx, G.nuovaPartita('sc'), [SPARSE, mano], ['4C#1']);
  aperto.aperto[1] = true;
  s = G.applica(aperto, { tipo: 'pesca', da: 'scarto' });
  assert.ok(!G.mosseLegali(s, 1).some(m => m.carta === '4C#1'));
  assert.throws(() => G.applica(s, { tipo: 'scarta', carta: '4C#1' }));
  s = G.applica(s, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.turno, 0);
});

// Tre giocatori a metà smazzata: il posto 1 ha aperto e sta per scartare.
function finale(Vx, G, opzioni, mano1) {
  const st = G.nuovaPartita('pen', { giocatori: 3, ...opzioni });
  const tavolo = ['5C#1', '6C#1', '7C#1'];
  imposta(Vx, st, [['AC#1', 'KQ#1', 'JK#1', '5F#1'], mano1, SPARSE], ['3C#1'], tavolo);
  st.mazzo = st.mazzo.filter(c => !tavolo.includes(c));
  st.giochi = [{ squadra: 1, posto: 1, carte: tavolo, tipo: 'scala', jolly: [] }];
  st.aperto = [true, true, false];
  st.turno = 1; st.fase = 'gioca';
  conserva(st);
  return st;
}

test('chiusura e penalità', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const due = finale(Vx, G, {}, ['8C#1', '9P#1']);
  assert.equal(G.puoAttaccare(due, 1, 0, ['8C#1']), true);
  assert.equal(G.puoCalare(due, 1, [['8C#1', '9P#1']]), false);
  let s = G.applica(due, { tipo: 'attacca', gioco: 0, carte: ['8C#1'] });
  assert.deepEqual(s.giochi[0].carte, ['5C#1', '6C#1', '7C#1', '8C#1']);
  assert.equal(G.puoAttaccare(finale(Vx, G, {}, ['8C#1']), 1, 0, ['8C#1']), false, 'deve restare una carta');
  assert.deepEqual(G.mosseLegali(s, 1), [{ tipo: 'scarta', carta: '9P#1' }]);
  s = G.applica(s, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.smazzata, 1, 'smazzata chiusa');
  const d = s.ultimaSmazzata;
  assert.equal(d.chiude, 1);
  assert.equal(s.ultimaMossa.chiude, true);
  assert.deepEqual(d.totale, [11 + 10 + 25 + 5, 0, 100], 'asso 11, figura 10, jolly 25; chi non ha aperto 100');
  assert.deepEqual(s.punti, [51, 0, 100]);
  assert.deepEqual(s.eliminati, [false, false, false], 'fuori solo sopra 101');
  assert.deepEqual(s.aperto, [false, false, false], 'nuova smazzata');
  assert.deepEqual(s.mani.map(h => h.length), [13, 13, 13]);
  const r = G.riepilogo(s);
  assert.deepEqual(r.totale, [51, 0, 100]);
  assert.equal(r.righe.length, 4);
  assert.deepEqual(r.righe[0].valori, ['sì', 'sì', 'no']);
  assert.deepEqual(r.righe[2].valori, ['·', 'sì', '·']);
  conserva(s);
  assert.equal(G.penalita(['AC#1', 'KQ#1', 'JK#1', '5F#1']), 51);
});

test('eliminazioni: sopra la soglia si esce, vince l\'ultimo rimasto', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = finale(Vx, G, { breve: true }, ['9P#1']);
  st.punti = [10, 40, 0];
  const s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.deepEqual(s.punti, [61, 40, 100]);
  assert.deepEqual(s.eliminati, [true, false, true]);
  assert.equal(s.finita, true);
  assert.equal(s.vincitore, 1);
  assert.deepEqual(G.mosseLegali(s, s.turno), []);
  assert.throws(() => G.applica(s, { tipo: 'pesca', da: 'mazzo' }), /finita/);
  // A 51 esatti si resta dentro.
  const t = finale(Vx, G, { breve: true }, ['9P#1']);
  const u = G.applica(t, { tipo: 'scarta', carta: '9P#1' });
  assert.deepEqual(u.eliminati, [false, false, true]);
  assert.equal(u.finita, false);
});

test('senza più carte da pescare la smazzata finisce senza chiusura', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = finale(Vx, G, { breve: true }, ['9P#1', '4F#1']);
  st.mani[2].push(...st.mazzo, ...st.scarti); st.mazzo = []; st.scarti = [];
  conserva(st);
  st.punti = [30, 60, 0];
  const s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.ultimaSmazzata.chiude, null);
  assert.deepEqual(s.ultimaSmazzata.totale, [51, 4, 100]);
  // Tutti oltre 51: vince chi ha meno punti.
  assert.deepEqual(s.eliminati, [true, true, true]);
  assert.equal(s.finita, true);
  assert.equal(s.vincitore, 1);
});

test('dopo un\'eliminazione il giocatore fuori non riceve carte', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = G.nuovaPartita('fuori', { giocatori: 3 });
  st.eliminati = [false, true, false];
  st.punti = [10, 120, 0];
  st.giochi = [];
  st.aperto = [true, false, false];
  st.mani[0] = [st.mani[0][0]];
  st.mazzo.push(...st.mani[1], ...st.mani[2]);
  st.mani[1] = []; st.mani[2] = [];
  st.turno = 0; st.fase = 'gioca';
  const s = G.applica(st, { tipo: 'scarta', carta: st.mani[0][0] });
  assert.equal(s.smazzata, 1);
  assert.deepEqual(s.mani.map(h => h.length), [13, 0, 13]);
  assert.equal(s.mazziere, 2, 'il mazziere salta chi è fuori');
  assert.equal(s.turno, 0);
  conserva(s);
});

test('dopo aver preso lo scarto deve restare un\'altra carta da scartare', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = finale(Vx, G, {}, ['8C#1']);
  st.fase = 'pesca';
  st.scarti = ['9P#1'];
  st.mazzo = st.mazzo.filter(c => c !== '9P#1').concat('3C#1');
  conserva(st);
  const s = G.applica(st, { tipo: 'pesca', da: 'scarto' });
  assert.deepEqual(s.presaScarto, { carta: '9P#1', obbligo: false });
  assert.equal(G.puoAttaccare(s, 1, 0, ['8C#1']), false, 'resterebbe solo la carta presa');
  assert.deepEqual(G.mosseLegali(s, 1), [{ tipo: 'scarta', carta: '8C#1' }]);
});

test('dopo tre rimescolate, a mazzo finito la smazzata si chiude', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = finale(Vx, G, {}, ['9P#1', '4F#1']);
  st.scarti.push(...st.mazzo); st.mazzo = [];
  st.rimescolate = G.MAX_RIMESCOLATE;
  conserva(st);
  const s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.smazzata, 1);
  assert.equal(s.ultimaSmazzata.chiude, null);
  assert.deepEqual(s.ultimaSmazzata.totale, [51, 4, 100]);
  conserva(s);
});

test('mazzo finito: si rimescolano gli scarti tranne quello in cima', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = G.nuovaPartita('rim');
  st.turno = 1; st.fase = 'gioca';
  st.mani[1].push(st.mazzo.shift());
  st.scarti.push(...st.mazzo); st.mazzo = [];
  conserva(st);
  const carta = st.mani[1][0];
  const s = G.applica(st, { tipo: 'scarta', carta });
  assert.deepEqual(s.scarti, [carta]);
  assert.equal(s.mazzo.length, 108 - 26 - 1);
  assert.equal(s.fase, 'pesca');
  assert.deepEqual(G.applica(st, { tipo: 'scarta', carta }).mazzo, s.mazzo, 'rimescolata ripetibile');
  conserva(s);
});

test('mosse non valide e abbandono', () => {
  const Vx = V(), G = Vx.giochi.scala40;
  const st = G.nuovaPartita('x');
  assert.throws(() => G.applica(st, null));
  assert.throws(() => G.applica(st, { tipo: 'scarta', carta: st.mani[1][0] }), /pescare/);
  assert.throws(() => G.applica(st, { tipo: 'boh' }));
  assert.throws(() => G.applica(st, { tipo: 'pesca', da: 'cielo' }));
  const s = G.applica(st, { tipo: 'pesca', da: 'mazzo' });
  assert.throws(() => G.applica(s, { tipo: 'pesca', da: 'mazzo' }), /pescato/);
  assert.throws(() => G.applica(s, { tipo: 'scarta', carta: s.mani[0][0] }), /non in mano/);
  assert.throws(() => G.applica(s, { tipo: 'cala', gruppi: 'x' }));
  assert.equal(G.mossaDiRiserva(st, 1).da, 'mazzo');
  const r = G.mossaDiRiserva(s, 1);
  assert.equal(r.tipo, 'scarta');
  const k = c => Vx.francese.jolly(c) ? -1 : Vx.combinazioni.punti(c, { gioco: 'scala40' });
  assert.equal(k(r.carta), Math.max(...s.mani[1].map(k)), 'scarta la carta che pesa di più');
  const a = G.abbandona(s, 1);
  assert.equal(a.finita, true);
  assert.equal(a.vincitore, 0);
  assert.equal(a.abbandono, 1);
  assert.equal(G.riepilogo(st), null);
  const q = G.abbandona(G.nuovaPartita('y', { giocatori: 4 }), 0);
  assert.equal(q.vincitore, 1);
});
