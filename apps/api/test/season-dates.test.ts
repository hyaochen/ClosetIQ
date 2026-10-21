import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonsForDates, outOfAllSeasons } from '../src/services/season-dates.js';

const TODAY = '2026-10-21'; // 秋

test('沒給日期：用今天（依月份）', () => {
  assert.deepEqual(seasonsForDates(undefined, null, TODAY), ['AUTUMN']);
  assert.deepEqual(seasonsForDates([], null, TODAY), ['AUTUMN']);
});

test('今天吃使用者手動設定的季節，其他日期不吃', () => {
  assert.deepEqual(seasonsForDates([TODAY], 'WINTER', TODAY), ['WINTER']);
  // 12 月的旅行：現在 10 月、手動設成春天也不影響，依 12 月 = 冬
  assert.deepEqual(seasonsForDates(['2026-12-20', '2026-12-21'], 'SPRING', TODAY), ['WINTER']);
});

test('跨季旅行取聯集', () => {
  const s = seasonsForDates(['2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02'], null, TODAY);
  assert.deepEqual(s.sort(), ['AUTUMN', 'WINTER']);
});

test('現在 10 月、12 月的旅行會保留冬季衣物，排除夏季衣物', () => {
  const target = seasonsForDates(['2026-12-20', '2026-12-24'], null, TODAY);
  assert.equal(outOfAllSeasons(['WINTER'], target), false); // 冬季外套：保留
  assert.equal(outOfAllSeasons(['AUTUMN', 'WINTER'], target), false);
  assert.equal(outOfAllSeasons(['SUMMER'], target), true); // 夏季短袖：排除
  assert.equal(outOfAllSeasons([], target), false); // 沒標季節 = 四季
  // 對照：若仍用「目前季節（秋）」，冬季外套會被誤排除
  assert.equal(outOfAllSeasons(['WINTER'], ['AUTUMN']), true);
});
