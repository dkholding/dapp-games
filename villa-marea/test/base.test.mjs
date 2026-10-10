import test from 'node:test';
import assert from 'node:assert/strict';
import { carica } from './carica.mjs';

test('sha256 vettori noti', () => {
  const V = carica('motore/base.js');
  assert.equal(V.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(V.sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(V.sha256('a'.repeat(100)), '2816597888e4a0d3a36b82b83316ab32680eb8f00f8cd3b904d681246d285a0e');
});

test('mescola ripetibile col seme, permutazione', () => {
  const V = carica('motore/base.js');
  const a = [...Array(40).keys()];
  const m1 = V.mescola(a, 'seme-1'), m2 = V.mescola(a, 'seme-1'), m3 = V.mescola(a, 'seme-2');
  assert.deepEqual(m1, m2);
  assert.notDeepEqual(m1, m3);
  assert.deepEqual([...m1].sort((x, y) => x - y), a);
  assert.deepEqual(a, [...Array(40).keys()]);
});
