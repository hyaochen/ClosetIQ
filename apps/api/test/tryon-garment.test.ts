import { test } from 'node:test';
import assert from 'node:assert/strict';
import { garmentSource } from '../src/services/tryon.service.js';

const img = { displayPath: '使用者/display/毛衣.webp', originalPath: '使用者/original/毛衣.webp', cutoutPath: '使用者/cutout/毛衣.webp' };

test('已有去背圖時直接用存好的去背圖', () => {
  assert.deepEqual(garmentSource({ ...img, cutoutStatus: 'DONE' }), { stored: '使用者/cutout/毛衣.webp' });
});

test('使用者選了原圖（SKIPPED）就照原圖送，不再即時去背', () => {
  assert.deepEqual(garmentSource({ ...img, cutoutStatus: 'SKIPPED' }), { stored: '使用者/display/毛衣.webp' });
});

test('沒有可用的去背圖時即時去背，失敗退回顯示圖', () => {
  for (const st of ['NONE', 'PENDING', 'FAILED', null, undefined]) {
    assert.deepEqual(garmentSource({ ...img, cutoutStatus: st }), {
      live: '使用者/original/毛衣.webp',
      fallback: '使用者/display/毛衣.webp',
    });
  }
});

test('DONE 但沒有路徑時也走即時去背', () => {
  assert.deepEqual(garmentSource({ ...img, cutoutPath: null, cutoutStatus: 'DONE' }), {
    live: '使用者/original/毛衣.webp',
    fallback: '使用者/display/毛衣.webp',
  });
});
