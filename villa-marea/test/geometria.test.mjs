import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

const V = () => carica('motore/base.js', 'motore/geometria.js');

test('muro con aperture', () => {
  const m = V().muro(0, 100, 1000, 100, [[200, 300], [600, 700]]);
  assert.deepEqual(m.map(r => [r.x, r.w]), [[0, 200], [300, 300], [700, 300]]);
  assert.equal(m[0].h, 16);
  const v = V().muro(50, 0, 50, 500, [[0, 100]]);
  assert.deepEqual(v.map(r => [r.y, r.h]), [[100, 400]]);
});

test('urti: il cerchio viene spinto fuori', () => {
  const Vx = V();
  assert.equal(Vx.urtoRett(0, 0, 10, { x: 20, y: -5, w: 10, h: 10 }), null);
  const s = Vx.urtoRett(15, 0, 10, { x: 20, y: -5, w: 10, h: 10 });
  assert.ok(Math.abs(s.x + 5) < 1e-9 && s.y === 0);
  const c = Vx.urtoCerchio(0, 0, 10, { x: 15, y: 0, r: 10 });
  assert.ok(Math.abs(c.x + 5) < 1e-9);
});

test('percorso aggira un muro passando dalla porta', () => {
  const Vx = V();
  const muri = Vx.muro(0, 500, 1000, 500, [[800, 900]]);
  const g = new Vx.Griglia(1000, 1000, { rett: muri, cerchi: [{ x: 300, y: 250, r: 60 }] }, 14);
  const p = g.percorso(100, 100, 100, 900);
  assert.ok(p && p.length >= 2);
  const tutti = [{ x: 100, y: 100 }, ...p];
  for (let i = 1; i < tutti.length; i++) assert.ok(g.visibile(tutti[i - 1].x, tutti[i - 1].y, tutti[i].x, tutti[i].y));
  assert.ok(p.some(q => q.x > 780 && q.x < 920), 'passa dalla porta');
  assert.deepEqual(p[p.length - 1], { x: 100, y: 900 });
  const fuori = g.percorso(100, 100, 100, 5900);
  assert.ok(fuori[fuori.length - 1].y < 1000, 'una meta fuori mappa si ferma dentro');
});

test('destinazione chiusa: nessun percorso', () => {
  const Vx = V();
  const muri = [...Vx.muro(0, 500, 1000, 500, [])];
  const g = new Vx.Griglia(1000, 1000, { rett: muri, cerchi: [] }, 14);
  assert.equal(g.percorso(100, 100, 100, 900), null);
});
