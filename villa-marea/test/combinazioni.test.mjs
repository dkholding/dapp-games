import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'zone/piano-terra/mazzo-francese.js', 'zone/piano-terra/combinazioni.js');
const S = { gioco: 'scala40' }, B = { gioco: 'burraco' };
const tipo = (Vx, carte, r) => (Vx.combinazioni.valida(carte, r) || {}).tipo || null;

test('mazzo francese: 108 carte, nomi e valori', () => {
  const Vx = V(), m = Vx.mazzoFrancese(), F = Vx.francese;
  assert.equal(m.length, 108);
  assert.equal(new Set(m).size, 108);
  assert.equal(m.filter(F.jolly).length, 4);
  assert.equal(Vx.mazzoFrancese(1, 2).length, 54);
  assert.ok(m.includes('10C#1') && m.includes('QP#2') && m.includes('JK#3'));
  assert.equal(F.valore('AC#1'), 1);
  assert.equal(F.valore('10Q#2'), 10);
  assert.equal(F.valore('JF#1'), 11);
  assert.equal(F.valore('QQ#1'), 12);
  assert.equal(F.valore('KP#2'), 13);
  assert.equal(F.valore('JK#1'), 0);
  assert.equal(F.seme('QQ#1'), 'Q');
  assert.equal(F.seme('10P#1'), 'P');
  assert.equal(F.seme('JK#2'), null);
  assert.equal(F.nome('10C#1'), '10');
  assert.equal(F.nome('AC#2'), 'A');
  assert.equal(F.nome('KQ#1'), 'K');
  assert.equal(F.jolly('JK#4'), true);
  assert.equal(F.jolly('JC#1'), false);
});

test('scale: asso basso e alto, niente giro, una matta sola', () => {
  const Vx = V(), C = Vx.combinazioni;
  for (const r of [S, B]) {
    assert.equal(tipo(Vx, ['AC#1', '2C#1', '3C#1'], r), 'scala', 'A-2-3');
    assert.equal(tipo(Vx, ['QC#1', 'KC#1', 'AC#1'], r), 'scala', 'Q-K-A');
    assert.equal(tipo(Vx, ['KC#1', 'AC#1', '3C#1'], r), null, 'K-A-3 non vale');
    assert.equal(tipo(Vx, ['5C#1', '6C#1', '8C#1'], r), null, 'buco senza matta');
    assert.equal(tipo(Vx, ['5C#1', '6Q#1', '7C#1'], r), null, 'semi diversi');
    assert.equal(tipo(Vx, ['5C#1', '6C#1'], r), null, 'due carte non bastano');
    assert.equal(tipo(Vx, ['JK#1', 'JK#2', '5C#1'], r), null, 'due jolly non valgono');
    assert.equal(tipo(Vx, ['JK#1', 'JK#2', '5C#1', '6C#1'], r), null);
    assert.equal(tipo(Vx, ['5C#1', '5C#1', '6C#1'], r), null, 'id ripetuto');
  }
  assert.equal(tipo(Vx, ['KC#1', 'AC#1', '2C#1'], S), null, 'K-A-2 non vale (niente giro)');
  assert.deepEqual(Vx.combinazioni.valida(['KC#1', 'AC#1', '2C#1'], B).ordine, ['2C#1', 'KC#1', 'AC#1'],
    'nel Burraco il 2 diventa pinella: Q-K-A');
  const r = C.valida(['7C#1', '5C#1', 'JK#1'], S);
  assert.deepEqual(r.ordine, ['5C#1', 'JK#1', '7C#1'], 'il jolly va nel buco');
  assert.deepEqual(r.jolly, ['JK#1']);
  assert.deepEqual(C.valida(['KC#1', 'JK#1', 'QC#1'], S).ordine, ['QC#1', 'KC#1', 'JK#1']);
  assert.deepEqual(C.valida(['KC#1', 'JK#1', 'AC#1'], S).ordine, ['JK#1', 'KC#1', 'AC#1'], 'Q-K-A col jolly al posto della Q');
  assert.equal(tipo(Vx, ['QC#1', 'KC#1', 'AC#1', '2C#1'], S), null);
  // Scala 40: niente scala di 14 (A…K…A); nel burraco si può con due assi.
  const tutta = ['AC#1', ...['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map(n => n + 'C#1'), 'AC#2'];
  assert.equal(tipo(Vx, tutta, S), null);
  assert.equal(tipo(Vx, tutta, B), 'scala');
  assert.equal(tipo(Vx, [...tutta.slice(0, 13), 'JK#1'], S), null, 'il jolly non può fare da secondo asso');
});

test('tris: semi diversi nella Scala 40, combinazioni libere nel Burraco', () => {
  const Vx = V();
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', '5F#1'], S), 'tris');
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', '5F#1', '5P#1'], S), 'tris', 'poker');
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', '5C#2'], S), null, 'seme doppio nella Scala 40');
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', 'JK#1'], S), 'tris');
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', '5F#1', '5P#1', 'JK#1'], S), null, 'più di 4 carte');
  assert.equal(tipo(Vx, ['5C#1', 'JK#2', 'JK#1'], S), null);
  assert.equal(tipo(Vx, ['2C#1', '2Q#1', '2F#1'], S), 'tris', 'nella Scala 40 i 2 sono carte normali');
  assert.equal(tipo(Vx, ['5C#1', '5C#2', '5Q#1'], B), 'tris', 'nel Burraco il seme si può ripetere');
  assert.equal(tipo(Vx, ['5C#1', '5C#2', '5Q#1', '5Q#2', '5F#1', '5F#2', '5P#1', '5P#2', '2C#1'], B), 'tris');
  assert.equal(tipo(Vx, ['5C#1', '5Q#1', '2F#1'], B), 'tris', 'pinella come matta');
  assert.equal(tipo(Vx, ['5C#1', '2Q#1', 'JK#1'], B), null, 'pinella e jolly: due matte');
  assert.equal(tipo(Vx, ['2C#1', '2Q#1', '2F#1'], B), null, 'solo pinelle');
});

test('burraco: il 2 al suo posto è naturale, altrove è pinella', () => {
  const Vx = V(), C = Vx.combinazioni;
  let r = C.valida(['4C#1', '2C#1', '3C#1'], B);
  assert.deepEqual(r.ordine, ['2C#1', '3C#1', '4C#1']);
  assert.deepEqual(r.jolly, [], '2-3-4 dello stesso seme è pulita');
  r = C.valida(['2C#1', '3C#1', '4C#1', '5C#1', '6C#1', '7C#1', '8C#1'], B);
  assert.equal(r.jolly.length, 0, 'burraco pulito col 2 naturale');
  r = C.valida(['2Q#1', '3C#1', '4C#1'], B);
  assert.deepEqual(r.jolly, ['2Q#1']);
  r = C.valida(['2C#2', '2C#1', '3C#1', '4C#1'], B);
  assert.equal(r.jolly.length, 1, 'un 2 naturale e uno pinella');
  assert.equal(r.ordine.length, 4);
  assert.equal(tipo(Vx, ['2C#1', '3C#1', '5C#1'], B), 'scala', '2 come pinella nel buco');
  assert.deepEqual(C.valida(['2C#1', '3C#1', '5C#1'], B).ordine, ['3C#1', '2C#1', '5C#1']);
  assert.equal(tipo(Vx, ['2C#1', '3C#1', '5C#1'], S), null, 'nella Scala 40 no');
  assert.equal(tipo(Vx, ['2Q#1', 'JK#1', '3C#1', '4C#1'], B), null);
  assert.equal(tipo(Vx, ['AC#1', '2C#1', '3C#1', 'JK#1'], B), 'scala');
});

test('valori: apertura della Scala 40 e carte del Burraco', () => {
  const C = V().combinazioni;
  assert.equal(C.valore(['AC#1', '2C#1', '3C#1'], S), 6, 'asso basso vale 1');
  assert.equal(C.valore(['QC#1', 'KC#1', 'AC#1'], S), 31, 'asso alto vale 11');
  assert.equal(C.valore(['AC#1', 'AQ#1', 'AF#1'], S), 33);
  assert.equal(C.valore(['5C#1', 'JK#1', '7C#1'], S), 18, 'il jolly vale la carta che sostituisce');
  assert.equal(C.valore(['JC#1', 'JQ#1', 'JK#1'], S), 30);
  assert.equal(C.valore(['10C#1', 'JC#1', 'QC#1', 'KC#1'], S), 40);
  assert.equal(C.valore(['5C#1', '6C#1'], S), 0);
  assert.deepEqual(['JK#1', '2C#1', 'AC#1', 'KC#1', '8C#1', '7C#1', '3C#1'].map(c => C.punti(c, B)), [30, 20, 15, 10, 10, 5, 5]);
  assert.deepEqual(['JK#1', 'AC#1', 'KC#1', 'JC#1', '7C#1', '2C#1'].map(c => C.punti(c, S)), [25, 11, 10, 10, 7, 2]);
  assert.equal(C.valore(['2C#1', '3C#1', '4C#1'], B), 30);
  assert.equal(C.valore(['5C#1', '5Q#1', 'JK#1'], B), 40);
});

test('attaccare: la combinazione cresce e resta dello stesso tipo', () => {
  const C = V().combinazioni;
  const g = { carte: ['5C#1', '6C#1', '7C#1'], tipo: 'scala' };
  assert.deepEqual(C.puoAttaccare(g, ['8C#1'], S).ordine, ['5C#1', '6C#1', '7C#1', '8C#1']);
  assert.deepEqual(C.puoAttaccare(g, ['4C#2', '3C#1'], S).ordine, ['3C#1', '4C#2', '5C#1', '6C#1', '7C#1']);
  assert.equal(C.puoAttaccare(g, ['8Q#1'], S), null);
  assert.equal(C.puoAttaccare(g, ['9C#1'], S), null);
  assert.deepEqual(C.puoAttaccare(g, ['JK#1'], S).ordine, ['5C#1', '6C#1', '7C#1', 'JK#1']);
  const sporca = { carte: ['5C#1', 'JK#1', '7C#1'], tipo: 'scala' };
  assert.equal(C.puoAttaccare(sporca, ['2Q#1'], B), null, 'seconda matta');
  assert.deepEqual(C.puoAttaccare(sporca, ['6C#1'], S).ordine, ['5C#1', '6C#1', '7C#1', 'JK#1'], 'il jolly scivola in fondo');
  const t = { carte: ['9C#1', '9Q#1', '9F#1'], tipo: 'tris' };
  assert.ok(C.puoAttaccare(t, ['9P#1'], S));
  assert.equal(C.puoAttaccare(t, ['9P#1', 'JK#1'], S), null, 'Scala 40: al massimo 4');
  assert.equal(C.puoAttaccare(t, ['9C#2'], S), null);
  assert.ok(C.puoAttaccare(t, ['9C#2', '9C#1'].slice(0, 1), B));
  assert.equal(C.puoAttaccare(t, [], S), null);
});

test('suggerimenti: combinazioni valide, disgiunte, prese dalla mano', () => {
  const Vx = V(), C = Vx.combinazioni;
  for (const r of [S, B]) for (let i = 0; i < 40; i++) {
    const mano = Vx.mescola(Vx.mazzoFrancese(), `sugg-${r.gioco}-${i}`).slice(0, 11 + (i % 4) * 6);
    const gr = C.suggerisci(mano, r), tutte = gr.flat();
    assert.equal(new Set(tutte).size, tutte.length);
    for (const g of gr) {
      assert.ok(g.every(c => mano.includes(c)));
      assert.deepEqual(C.valida(g, r).ordine, g, 'già in ordine');
    }
  }
  const mano = ['10C#1', 'JC#1', 'QC#1', 'KC#1', '5Q#1', '5F#1', '5P#1', '9P#2', 'JK#1', '3F#1'];
  const gr = C.suggerisci(mano, S);
  assert.ok(gr.some(g => g.length >= 4 && g.includes('10C#1')));
  assert.ok(gr.some(g => g.includes('5Q#1') && g.includes('5F#1')));
  assert.ok(gr.reduce((a, g) => a + C.valore(g, S), 0) >= 55);
  assert.deepEqual(C.suggerisci(['5C#1', '9Q#1', 'KP#1'], S), []);
});
