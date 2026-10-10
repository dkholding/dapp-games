import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'motore/salvataggio.js', 'motore/economia.js');
const finto = () => { const m = new Map(); return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const CONF = { moneta: { nome: 'Fiches', iniziale: 1000, regalo: 100 }, trattenuta: 0.05,
  catalogo: [{ id: 'blu', nome: 'Dorso Riviera', prezzo: 300 }, { id: 'oro', nome: 'Dorso Barocco', prezzo: 5000 }] };

test('saldo, regalo del giorno, pagamenti', () => {
  const Vx = V(), s = finto();
  const e = new Vx.Economia(Vx.archivio(s), 'carte', CONF);
  assert.equal(e.saldo(), 1000);
  assert.equal(e.regalo('2026-09-14'), 100);
  assert.equal(e.regalo('2026-09-14'), 0);
  assert.equal(e.regalo('2026-09-15'), 100);
  assert.equal(e.paga(5000, 'troppo'), false);
  assert.equal(e.paga(200, 'posta'), true);
  assert.equal(e.saldo(), 1000);
  const f = new Vx.Economia(Vx.archivio(s), 'carte', CONF);
  assert.equal(f.saldo(), 1000, 'salvato');
  const altra = new Vx.Economia(Vx.archivio(s), 'veranda', CONF);
  assert.equal(altra.saldo(), 1000);
  altra.paga(500, 'x');
  assert.equal(new Vx.Economia(Vx.archivio(s), 'carte', CONF).saldo(), 1000, 'zone separate');
});

test('livelli e poste', () => {
  const Vx = V(), e = new Vx.Economia(Vx.archivio(finto()), 'carte', CONF);
  assert.equal(e.livello(), 1);
  for (let i = 0; i < 17; i++) e.registraPartita({ gioco: 'scopa', vinto: true });
  assert.equal(e.d.xp, 510);
  assert.equal(e.livello(), 5);
  assert.equal(e.d.perGioco.scopa.vinte, 17);
  assert.equal(e.vincitaPerGiocatore(100, 2), 190);
  assert.equal(e.vincitaPerGiocatore(100, 4), 190);
});

test('NFT di prova', () => {
  const Vx = V(), e = new Vx.Economia(Vx.archivio(finto()), 'carte', CONF);
  assert.equal(e.compra('oro'), false);
  assert.equal(e.compra('blu'), true);
  assert.equal(e.compra('blu'), false);
  assert.equal(e.equipaggiato().id, 'blu');
  assert.equal(e.saldo(), 700);
  assert.equal(e.equipaggia('oro'), false);
  assert.equal(e.equipaggia(null), true);
});

test('economia della villa: da bere e abiti, separata dalle fiches', () => {
  const Vx = carica('motore/base.js', 'motore/salvataggio.js', 'motore/economia.js', 'zone/villa.js');
  const s = finto(), A = Vx.archivio(s);
  const villa = new Vx.Economia(A, Vx.VILLA.salvataggio, Vx.VILLA.economia);
  const carte = new Vx.Economia(A, 'carte', CONF);
  assert.equal(villa.saldo(), 100);
  assert.equal(villa.consuma('spritz', 1000), true);
  assert.equal(villa.saldo(), 80);
  assert.equal(villa.bevanda(1000 + 60000).id, 'spritz');
  assert.equal(villa.bevanda(1000 + 20 * 60000), null);
  assert.equal(villa.consuma('inesistente', 0), false);
  assert.equal(villa.compra('abito-capitano'), false, 'non bastano i Ducati');
  assert.equal(villa.compra('abito-lino'), true);
  assert.equal(villa.equipaggiato().id, 'abito-lino');
  assert.equal(carte.saldo(), 1000, 'le fiches non si toccano');
  assert.ok(s.m.has('villa.generale.v1'));
});

test('tornei: programma, tabellone, avanzamento, premi', () => {
  const Vx = V(), T = Vx.tornei, ora = Date.UTC(2026, 8, 14, 10, 7);
  const p = T.programma(ora, ['scopa', 'briscola', 'tressette']);
  assert.equal(p.length, 4);
  assert.equal(p[1].inizio - ora, 23 * 60 * 1000);
  assert.ok(p.every((t, i) => i === 0 || t.inizio - p[i - 1].inizio === T.MEZZORA));
  const tab = T.tabellone(p[1], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  assert.equal(tab.partecipanti.length, 8);
  assert.deepEqual(T.tabellone(p[1], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']), tab, 'ripetibile');
  const r = Vx.rng(Vx.sha256('x'));
  T.avanza(tab, true, r); assert.equal(tab.turni[1].length, 4); assert.ok(tab.turni[1].includes(0));
  T.avanza(tab, true, r); T.avanza(tab, true, r);
  assert.equal(tab.posizione, 1);
  const t2 = T.tabellone(p[2], ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
  T.avanza(t2, true, r); T.avanza(t2, false, r);
  assert.equal(t2.posizione, 3);
  assert.equal(T.premio(1, 100), 400); assert.equal(T.premio(3, 100), 100); assert.equal(T.premio(5, 100), 0);
});
