import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorsCompatible, itemsCompatible, summarizeCompatibility } from '../src/services/compatibility.js';
import { computeWardrobeGaps, gapsFilledBy } from '../src/services/wardrobe-gaps.js';
import { analyzeCandidate, type WardrobeItem } from '../src/services/wishlist-analysis.js';

const mk = (o: Partial<WardrobeItem> & { id: string; category: string; colorFamily: string }): WardrobeItem => ({
  name: o.id, subcategory: null, seasons: [], occasions: [], pattern: 'SOLID',
  recentWearCount: 0, totalWearCount: 0, ...o,
});

test('中性色一律相容', () => {
  for (const n of ['BLACK', 'WHITE', 'GREY', 'BEIGE', 'BROWN']) {
    for (const c of ['RED', 'GREEN', 'PURPLE', 'MULTI', 'BLUE']) assert.equal(colorsCompatible(n, c), true);
  }
});

test('紅配綠不相容，藍配橘相容，同色系相容', () => {
  assert.equal(colorsCompatible('RED', 'GREEN'), false);
  assert.equal(colorsCompatible('GREEN', 'RED'), false);
  assert.equal(colorsCompatible('BLUE', 'ORANGE'), true);
  assert.equal(colorsCompatible('GREEN', 'GREEN'), true);
  assert.equal(colorsCompatible('MULTI', 'RED'), false);
});

test('季節與場合：空陣列視為不限，無交集不搭', () => {
  const top = { category: 'TOP', colorFamily: 'WHITE', seasons: ['SUMMER'], occasions: ['CASUAL'] };
  assert.equal(itemsCompatible(top, { category: 'BOTTOM', colorFamily: 'BLACK', seasons: [], occasions: [] }), true);
  assert.equal(itemsCompatible(top, { category: 'BOTTOM', colorFamily: 'BLACK', seasons: ['WINTER'], occasions: ['CASUAL'] }), false);
  assert.equal(itemsCompatible(top, { category: 'BOTTOM', colorFamily: 'BLACK', seasons: ['SUMMER'], occasions: ['FORMAL'] }), false);
});

test('類別不互補不搭；同為花紋不搭', () => {
  const t = { category: 'TOP', colorFamily: 'WHITE', seasons: [], occasions: [] };
  assert.equal(itemsCompatible(t, { ...t, category: 'TOP' }), false);
  assert.equal(itemsCompatible(t, { ...t, category: 'UNDERWEAR' }), false);
  assert.equal(itemsCompatible({ ...t, pattern: 'STRIPED' }, { ...t, category: 'BOTTOM', pattern: 'FLORAL' }), false);
  assert.equal(itemsCompatible({ ...t, pattern: 'STRIPED' }, { ...t, category: 'BOTTOM', pattern: 'SOLID' }), true);
});

test('summarize 只統計互補類別', () => {
  const w = [mk({ id: 'a', category: 'BOTTOM', colorFamily: 'BLACK' }), mk({ id: 'b', category: 'TOP', colorFamily: 'BLACK' })];
  const s = summarizeCompatibility({ category: 'TOP', colorFamily: 'WHITE', seasons: [], occasions: [] }, w);
  assert.equal(s.totalConsidered, 1);
  assert.equal(s.compatibleCount, 1);
});

test('缺口：空衣櫃全缺；有正式鞋就不缺', () => {
  const gaps = computeWardrobeGaps([]);
  assert.ok(gaps.some((g) => g.label === '正式場合的鞋' && g.severity === 'high'));
  assert.ok(gaps.some((g) => g.label === '冬季外套'));
  assert.ok(!gaps.some((g) => g.label === '夏季外套'));
  const g2 = computeWardrobeGaps([{ category: 'SHOES', seasons: [], occasions: ['FORMAL'] }]);
  assert.ok(!g2.some((g) => g.label === '正式場合的鞋'));
});

test('補缺口判斷', () => {
  const gaps = computeWardrobeGaps([]);
  const filled = gapsFilledBy(gaps, { category: 'OUTERWEAR', seasons: ['WINTER'], occasions: ['FORMAL'] });
  assert.ok(filled.some((g) => g.label === '冬季外套'));
  assert.ok(filled.some((g) => g.label === '正式場合的上衣') === false);
});

test('相似且少穿會扣分，分數在 0-100', () => {
  const base = [mk({ id: 'b1', category: 'BOTTOM', colorFamily: 'BLACK', seasons: ['SPRING'] })];
  const cand = { category: 'TOP', colorFamily: 'GREEN', seasons: [], occasions: [] };
  const clean = analyzeCandidate(cand, base);
  const dup = analyzeCandidate(cand, [
    ...base,
    mk({ id: 't1', category: 'TOP', colorFamily: 'GREEN', recentWearCount: 1, totalWearCount: 3 }),
    mk({ id: 't2', category: 'TOP', colorFamily: 'GREEN', recentWearCount: 1, totalWearCount: 2 }),
  ]);
  assert.ok(dup.score < clean.score);
  assert.equal(dup.similarItems.length, 2);
  assert.ok(dup.reasons.some((r) => r.includes('近 90 天各只穿 1 次')));
  for (const r of [clean, dup]) assert.ok(r.score >= 0 && r.score <= 100);
});
