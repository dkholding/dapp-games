import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo-francese.js', 'zone/piano-terra/combinazioni.js',
  'zone/piano-terra/burraco.js');
const tutte = st => [...st.mazzo, ...st.scarti, ...st.mani.flat(), ...st.giochi.flatMap(g => g.carte), ...st.pozzetti.flat()];

function conserva(st) {
  const c = tutte(st);
  assert.equal(c.length, 108);
  assert.equal(new Set(c).size, 108);
}

// Mani, scarti e combinazioni scelti a mano; il resto va nei pozzetti (se ancora da prendere) e nel mazzo.
function imposta(Vx, st, { mani, scarti = ['KF#2'], giochi = [], turno = 0, fase = 'gioca', preso = [false, false] }) {
  const usate = new Set([...mani.flat(), ...scarti, ...giochi.flatMap(g => g.carte)]);
  const resto = Vx.mazzoFrancese().filter(c => !usate.has(c));
  st.mani = mani.map(h => h.slice());
  st.scarti = scarti.slice();
  st.giochi = giochi.map(g => ({ posto: g.squadra, jolly: [], ...g }));
  st.pozzettoPreso = preso.slice();
  st.pozzetti = preso.map(p => p ? [] : resto.splice(0, 11));
  st.mazzo = resto;
  st.turno = turno; st.fase = fase;
  conserva(st);
  return st;
}

const SETTE_PULITO = ['2C#1', '3C#1', '4C#1', '5C#1', '6C#1', '7C#1', '8C#1'];
const SETTE_SPORCO = ['3Q#1', '4Q#1', '5Q#1', 'JK#1', '7Q#1', '8Q#1', '9Q#1'];

test('nuova partita a 2 e a 4', () => {
  const G = V().giochi.burraco;
  const a = G.nuovaPartita('x');
  assert.deepEqual(a.mani.map(h => h.length), [11, 11]);
  assert.deepEqual(a.pozzetti.map(p => p.length), [11, 11]);
  assert.deepEqual(a.pozzettoPreso, [false, false]);
  assert.equal(a.scarti.length, 1);
  assert.equal(a.mazzo.length, 108 - 22 - 22 - 1);
  assert.equal(a.obiettivo, 2005);
  assert.equal(a.turno, 1);
  conserva(a);
  const b = G.nuovaPartita('x', { giocatori: 4, breve: true });
  assert.deepEqual(b.mani.map(h => h.length), [11, 11, 11, 11]);
  assert.equal(b.mazzo.length, 108 - 44 - 22 - 1);
  assert.equal(b.obiettivo, 1005);
  assert.deepEqual([0, 1, 2, 3].map(p => G.squadra(b, p)), [0, 1, 0, 1]);
  assert.deepEqual(b.punti, [0, 0]);
  conserva(b);
  assert.deepEqual(G.nuovaPartita('x'), G.nuovaPartita('x'));
  assert.throws(() => G.nuovaPartita('x', { giocatori: 3 }));
  assert.deepEqual(G.mosseLegali(a, 1), [{ tipo: 'pesca', da: 'mazzo' }, { tipo: 'pesca', da: 'scarto' }]);
  assert.deepEqual(G.mosseLegali(a, 0), []);
});

test('pescare dagli scarti prende tutto il monte', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('monte'), {
    mani: [['9P#1', '4F#1'], ['KP#1']], scarti: ['5C#1', '6C#1', '7C#1'], fase: 'pesca' });
  const s = G.applica(st, { tipo: 'pesca', da: 'scarto' });
  assert.deepEqual(s.mani[0], ['9P#1', '4F#1', '5C#1', '6C#1', '7C#1']);
  assert.deepEqual(s.scarti, []);
  assert.deepEqual(s.ultimaMossa.carte, ['5C#1', '6C#1', '7C#1']);
  assert.deepEqual(G.mosseLegali(s, 0).map(m => m.carta).sort(), s.mani[0].slice().sort());
  const t = G.applica(s, { tipo: 'cala', gruppi: [['7C#1', '5C#1', '6C#1']] });
  assert.deepEqual(t.giochi[0].carte, ['5C#1', '6C#1', '7C#1']);
  assert.equal(t.giochi[0].squadra, 0);
  conserva(t);
  const vuoto = { ...s, scarti: [], fase: 'pesca' };
  assert.deepEqual(G.mosseLegali(vuoto, 0), [{ tipo: 'pesca', da: 'mazzo' }]);
  assert.throws(() => G.applica(vuoto, { tipo: 'pesca', da: 'scarto' }));
});

test('a 4 si attacca solo alle combinazioni della propria coppia', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('coppie', { giocatori: 4 }), {
    mani: [['8C#1', '8Q#1', '9P#1'], ['KP#1'], ['4F#1'], ['3P#1']],
    giochi: [{ squadra: 1, carte: ['5C#1', '6C#1', '7C#1'], tipo: 'scala' },
      { squadra: 0, carte: ['5Q#1', '6Q#1', '7Q#1'], tipo: 'scala' }] });
  assert.equal(G.puoAttaccare(st, 0, 0, ['8C#1']), false, 'combinazione avversaria');
  assert.throws(() => G.applica(st, { tipo: 'attacca', gioco: 0, carte: ['8C#1'] }), /proprie/);
  assert.equal(G.puoAttaccare(st, 0, 1, ['8Q#1']), true, 'calata dal compagno');
  const s = G.applica(st, { tipo: 'attacca', gioco: 1, carte: ['8Q#1'] });
  assert.deepEqual(s.giochi[1].carte, ['5Q#1', '6Q#1', '7Q#1', '8Q#1']);
  assert.equal(G.puoAttaccare(s, 0, 1, ['JK#2']), false, 'matta non in mano');
  conserva(s);
});

test('pozzetto preso calando tutto: si continua il turno', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('pozz'), { mani: [['5C#1', '6C#1', '7C#1'], ['KP#1']] });
  const pozzetto = st.pozzetti[0].slice();
  const s = G.applica(st, { tipo: 'cala', gruppi: [['5C#1', '6C#1', '7C#1']] });
  assert.deepEqual(s.mani[0], pozzetto);
  assert.deepEqual(s.pozzetti[0], []);
  assert.deepEqual(s.pozzettoPreso, [true, false]);
  assert.equal(s.ultimaMossa.pozzetto, true);
  assert.equal(s.turno, 0);
  assert.equal(s.fase, 'gioca');
  conserva(s);
  // Dopo il pozzetto non si può restare senza carte da scartare.
  const t = imposta(Vx, G.nuovaPartita('pozz'), { mani: [['5C#1', '6C#1', '7C#1'], ['KP#1']], preso: [true, false] });
  assert.equal(G.puoCalare(t, 0, [['5C#1', '6C#1', '7C#1']]), false);
  assert.throws(() => G.applica(t, { tipo: 'cala', gruppi: [['5C#1', '6C#1', '7C#1']] }), /scartare/);
});

test('pozzetto preso scartando l\'ultima carta', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('pozz2'), { mani: [['9P#1'], ['KP#1']] });
  const pozzetto = st.pozzetti[0].slice();
  const s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.deepEqual(s.mani[0], pozzetto);
  assert.equal(s.pozzettoPreso[0], true);
  assert.equal(s.ultimaMossa.pozzetto, true);
  assert.equal(s.ultimaMossa.chiude, false);
  assert.equal(s.turno, 1);
  assert.equal(s.smazzata, 0);
  conserva(s);
});

test('chiudere: pozzetto preso, almeno un burraco e scarto finale', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const senza = imposta(Vx, G.nuovaPartita('chiudi'), {
    mani: [['9P#1', '8C#2', '4F#1'], ['KP#1', 'QP#1']], preso: [true, true],
    giochi: [{ squadra: 0, carte: ['5C#1', '6C#1', '7C#1'], tipo: 'scala' }] });
  assert.equal(G.puoAttaccare(senza, 0, 0, ['8C#2']), true, 'restano due carte');
  const due = G.applica(senza, { tipo: 'attacca', gioco: 0, carte: ['8C#2'] });
  assert.equal(G.puoCalare(due, 0, [['9P#1']]), false);
  const una = imposta(Vx, G.nuovaPartita('chiudi'), {
    mani: [['9P#1', '8C#2'], ['KP#1', 'QP#1']], preso: [true, true],
    giochi: [{ squadra: 0, carte: ['5C#1', '6C#1', '7C#1'], tipo: 'scala' }] });
  assert.equal(G.puoAttaccare(una, 0, 0, ['8C#2']), false, 'resterebbe una carta senza burraco');
  const ferma = { ...structuredClone(una), mani: [['9P#1'], ['KP#1', 'QP#1']] };
  assert.deepEqual(G.mosseLegali(ferma, 0), []);
  assert.equal(G.mossaDiRiserva(ferma, 0), null);
  // Con il burraco appena fatto si resta con una carta e la si scarta: chiusura.
  const st = imposta(Vx, G.nuovaPartita('chiudi'), {
    mani: [['9P#1', '8C#1'], ['KP#1', 'QP#1']], preso: [true, true],
    giochi: [{ squadra: 0, carte: SETTE_PULITO.slice(0, 6), tipo: 'scala' }] });
  assert.equal(G.puoAttaccare(st, 0, 0, ['8C#1']), true, 'il burraco appena fatto permette di restare con una carta');
  let s = G.applica(st, { tipo: 'attacca', gioco: 0, carte: ['8C#1'] });
  assert.deepEqual(s.mani[0], ['9P#1']);
  assert.equal(s.ultimaMossa.pozzetto, undefined);
  assert.deepEqual(G.mosseLegali(s, 0), [{ tipo: 'scarta', carta: '9P#1' }]);
  const fine = G.applica(s, { tipo: 'scarta', carta: '9P#1' });
  const d = fine.ultimaSmazzata;
  assert.equal(d.chiude, 0);
  assert.equal(fine.ultimaMossa.chiude, true);
  assert.deepEqual(d.chiusura, [100, 0]);
  assert.deepEqual(d.puliti, [1, 0]);
  assert.equal(d.calate[0], 20 + 5 * 5 + 10);
  assert.deepEqual(d.totale, [55 + 200 + 100, -20]);
  assert.equal(fine.smazzata, 1);
  assert.equal(fine.finita, false);
  conserva(fine);
});

test('conteggio: burraco pulito e sporco, pozzetto non preso, carte in mano', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('conta'), {
    mani: [['KP#1', '3F#1'], ['JK#2', '2F#1', 'AF#1']], preso: [true, false],
    giochi: [{ squadra: 0, carte: SETTE_PULITO, tipo: 'scala' },
      { squadra: 0, carte: SETTE_SPORCO, tipo: 'scala' },
      { squadra: 1, carte: ['9C#1', '9Q#2', '9F#1'], tipo: 'tris' }] });
  const d = G.contaSmazzata(st, 0);
  assert.equal(d.calate[0], (20 + 5 * 5 + 10) + (5 * 4 + 30 + 10 + 10));
  assert.deepEqual(d.puliti, [1, 0]);
  assert.deepEqual(d.sporchi, [1, 0]);
  assert.deepEqual(d.burraco, [300, 0]);
  assert.deepEqual(d.mano, [-15, -65]);
  assert.deepEqual(d.chiusura, [100, 0]);
  assert.deepEqual(d.pozzetto, [0, -100]);
  assert.deepEqual(d.totale, [125 + 300 - 15 + 100, 30 - 65 - 100]);
  // Una scala di 7 col 2 al posto suo resta pulita anche se la matta è un 2.
  const sei = imposta(Vx, G.nuovaPartita('conta'), {
    mani: [['KP#1'], ['QP#1']], giochi: [{ squadra: 1, carte: ['3P#1', '4P#1', '5P#1', '2P#1', '7P#1', '8P#1', '9P#1'], tipo: 'scala' }] });
  assert.deepEqual(G.contaSmazzata(sei, null).sporchi, [0, 1], '2 fuori posto = sporco');
});

test('il mazzo finisce: smazzata chiusa senza chiusura, poi si ricomincia', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('fine'), { mani: [['9P#1', '4F#1'], ['KP#1']], preso: [false, false] });
  st.mani[1].push(...st.mazzo.slice(2)); st.mazzo = st.mazzo.slice(0, 2);
  conserva(st);
  let s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.smazzata, 0, 'restano 2 carte: si continua');
  s = G.applica(s, { tipo: 'pesca', da: 'mazzo' });
  assert.equal(s.mazzo.length, 1);
  s = G.applica(s, { tipo: 'scarta', carta: 'KP#1' });
  assert.equal(s.smazzata, 1);
  assert.equal(s.ultimaSmazzata.chiude, null);
  assert.deepEqual(s.ultimaSmazzata.pozzetto, [-100, -100]);
  assert.deepEqual(s.punti, s.ultimaSmazzata.totale);
  assert.ok(s.punti[1] < -500, 'tante carte in mano');
  assert.equal(s.mazziere, 1);
  assert.equal(s.turno, 0);
  const r = G.riepilogo(s);
  assert.deepEqual(r.totale, s.ultimaSmazzata.totale);
  assert.equal(r.righe.length, 5);
  conserva(s);
});

test('fine partita: vince chi supera l\'obiettivo da solo in testa', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = imposta(Vx, G.nuovaPartita('vinci', { breve: true }), {
    mani: [['9P#1'], ['KP#1']], preso: [true, true],
    giochi: [{ squadra: 0, carte: SETTE_PULITO, tipo: 'scala' }] });
  st.punti = [900, 1200];
  const s = G.applica(st, { tipo: 'scarta', carta: '9P#1' });
  assert.equal(s.ultimaSmazzata.totale[0], 55 + 200 + 100);
  assert.deepEqual(s.punti, [1255, 1190]);
  assert.equal(s.finita, true);
  assert.equal(s.vincitore, 0);
  assert.deepEqual(G.mosseLegali(s, s.turno), []);
  // Pari in testa: si continua.
  const p = imposta(Vx, G.nuovaPartita('vinci', { breve: true }), {
    mani: [['9P#1'], ['KP#1']], preso: [true, true],
    giochi: [{ squadra: 0, carte: SETTE_PULITO, tipo: 'scala' }] });
  p.punti = [835, 1200];
  const q = G.applica(p, { tipo: 'scarta', carta: '9P#1' });
  assert.deepEqual(q.punti, [1190, 1190]);
  assert.equal(q.finita, false);
});

test('mosse non valide, riserva e abbandono', () => {
  const Vx = V(), G = Vx.giochi.burraco;
  const st = G.nuovaPartita('x', { giocatori: 4 });
  assert.throws(() => G.applica(st, null));
  assert.throws(() => G.applica(st, { tipo: 'scarta', carta: st.mani[1][0] }), /pescare/);
  assert.throws(() => G.applica(st, { tipo: 'pesca', da: 'boh' }));
  const s = G.applica(st, { tipo: 'pesca', da: 'mazzo' });
  assert.throws(() => G.applica(s, { tipo: 'pesca', da: 'mazzo' }));
  assert.throws(() => G.applica(s, { tipo: 'cala', gruppi: [[s.mani[1][0]]] }));
  assert.throws(() => G.applica(s, { tipo: 'cala', gruppi: [[s.mani[0][0], s.mani[0][1], s.mani[0][2]]] }), /non in mano/);
  assert.throws(() => G.applica(s, { tipo: 'attacca', gioco: 0, carte: [s.mani[1][0]] }));
  assert.equal(G.mossaDiRiserva(st, 1).da, 'mazzo');
  const r = G.mossaDiRiserva(s, 1), R = { gioco: 'burraco' };
  const k = c => Vx.combinazioni.selvaggia(c, R) ? -1 : Vx.combinazioni.punti(c, R);
  assert.equal(k(r.carta), Math.max(...s.mani[1].map(k)));
  assert.equal(G.mossaDiRiserva(s, 0), null);
  const a = G.abbandona(s, 3);
  assert.equal(a.finita, true);
  assert.equal(a.vincitore, 0);
  assert.equal(G.abbandona(G.nuovaPartita('y'), 0).vincitore, 1);
  assert.equal(G.riepilogo(st), null);
});
