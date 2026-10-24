import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, editionName, parseAmount, switchLayout } from './index.ts';

test('convert applies rate and fee on top', () => {
  const { converted, toPay } = convert(5000, 0.2, 10);
  assert.equal(converted, 1000);
  assert.ok(Math.abs(toPay - 1100) < 1e-9);
  assert.equal(convert(100, 1, 0).toPay, 100);
});

test('switchLayout fixes wrong keyboard layout both ways', () => {
  assert.equal(switchLayout('ыефдлук 2'), 'stalker 2');
  assert.equal(switchLayout('dtlmvfr'), 'ведьмак');
});

test('parseAmount accepts numbers only', () => {
  assert.equal(parseAmount('5 000'), 5000);
  assert.equal(parseAmount('12,5'), 12.5);
  assert.equal(parseAmount('gta 5'), null);
  assert.equal(parseAmount('-5'), null);
});

test('editionName strips price and discount markup', () => {
  assert.equal(editionName('ELDEN RING Deluxe Edition - 29 999₸'), 'ELDEN RING Deluxe Edition');
  assert.equal(editionName('Cyberpunk 2077 - <span class="discount_original_price">17 999₸</span> 5 399₸'), 'Cyberpunk 2077');
  assert.equal(editionName('S.T.A.L.K.E.R. 2 - Ultimate - 25 000₸'), 'S.T.A.L.K.E.R. 2 - Ultimate');
});
