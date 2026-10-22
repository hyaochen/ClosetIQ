import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileFields } from '../src/lib/tile.js';

const base = { thumbnailPath: 'u/thumbnail/a-thumbnail.webp' };

test('tileFields: DONE with cutout uses the cutout thumbnail', () => {
  const r = tileFields({ ...base, cutoutStatus: 'DONE', cutoutPath: 'u/cutout/a.png', cutoutThumbPath: 'u/cutout/a-thumb.webp' });
  assert.deepEqual(r, { tileThumbPath: 'u/cutout/a-thumb.webp', tileCutout: true });
});

test('tileFields: DONE without a thumb falls back to the cutout file', () => {
  const r = tileFields({ ...base, cutoutStatus: 'DONE', cutoutPath: 'u/cutout/a.png', cutoutThumbPath: null });
  assert.deepEqual(r, { tileThumbPath: 'u/cutout/a.png', tileCutout: true });
});

test('tileFields: non-DONE statuses keep the original thumbnail', () => {
  for (const cutoutStatus of ['NONE', 'PENDING', 'FAILED', 'SKIPPED']) {
    const r = tileFields({ ...base, cutoutStatus, cutoutPath: 'u/cutout/a.png', cutoutThumbPath: 'u/cutout/a-thumb.webp' });
    assert.deepEqual(r, { tileThumbPath: base.thumbnailPath, tileCutout: false }, cutoutStatus);
  }
});

test('tileFields: no image gives null', () => {
  assert.deepEqual(tileFields(undefined), { tileThumbPath: null, tileCutout: false });
});
