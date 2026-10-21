import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePieceImagePath } from '../src/services/canvas.service.js';

test('cutout DONE 時畫布用去背圖', () => {
  assert.equal(
    resolvePieceImagePath({ displayPath: 'u/display/a.webp', cutoutPath: 'u/cutout/a.webp', cutoutStatus: 'DONE' }),
    'u/cutout/a.webp'
  );
});

test('cutout 未完成或失敗時退回顯示圖', () => {
  for (const st of ['NONE', 'PENDING', 'FAILED', null, undefined]) {
    assert.equal(
      resolvePieceImagePath({ displayPath: 'u/display/a.webp', cutoutPath: 'u/cutout/a.webp', cutoutStatus: st }),
      'u/display/a.webp'
    );
  }
});

test('DONE 但沒有路徑時退回顯示圖', () => {
  assert.equal(
    resolvePieceImagePath({ displayPath: 'u/display/a.webp', cutoutPath: null, cutoutStatus: 'DONE' }),
    'u/display/a.webp'
  );
});
