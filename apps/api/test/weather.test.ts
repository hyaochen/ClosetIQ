import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wmoToCondition, WMO_CONDITION, summarizeDaily, summarizeCurrent, WINDY_KMH } from '../src/services/weather.service.js';

// WMO 4677 在 Open-Meteo 會出現的全部代碼
const ALL_CODES = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

test('對照表涵蓋所有 Open-Meteo 會回傳的 WMO 代碼，且值都在 WeatherCondition 內', () => {
  for (const c of ALL_CODES) assert.ok(c in WMO_CONDITION, `缺少代碼 ${c}`);
  for (const v of Object.values(WMO_CONDITION)) assert.ok(['SUNNY', 'CLOUDY', 'RAINY', 'SNOWY', 'WINDY'].includes(v));
});

test('逐項對照：晴 / 陰 / 雨 / 雪', () => {
  const expect: Record<string, number[]> = {
    SUNNY: [0, 1],
    CLOUDY: [2, 3, 45, 48],
    RAINY: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99],
    SNOWY: [71, 73, 75, 77, 85, 86],
  };
  for (const [cond, codes] of Object.entries(expect)) for (const c of codes) assert.equal(wmoToCondition(c), cond, `代碼 ${c}`);
});

test('雲量代碼 1-3 永遠不是大風（舊 OpenWeatherMap 版 801-804 誤判的回歸測試）', () => {
  for (const c of [1, 2, 3]) assert.notEqual(wmoToCondition(c), 'WINDY');
  for (const c of [1, 2, 3]) assert.notEqual(wmoToCondition(c, 10), 'WINDY');
});

test('風速只在非雨雪時才改判大風，雨雪優先', () => {
  assert.equal(wmoToCondition(2, WINDY_KMH), 'WINDY');
  assert.equal(wmoToCondition(0, 60), 'WINDY');
  assert.equal(wmoToCondition(63, 80), 'RAINY');
  assert.equal(wmoToCondition(73, 80), 'SNOWY');
  assert.equal(wmoToCondition(2, WINDY_KMH - 1), 'CLOUDY');
});

test('未知或缺少的代碼降級為 CLOUDY', () => {
  assert.equal(wmoToCondition(null), 'CLOUDY');
  assert.equal(wmoToCondition(undefined), 'CLOUDY');
  assert.equal(wmoToCondition(1234), 'CLOUDY');
});

test('summarizeDaily 轉換日期、四捨五入並略過缺溫度的日子', () => {
  const days = summarizeDaily({
    time: ['2026-10-21', '2026-10-22', '2026-10-23'],
    weather_code: [53, 3, 0],
    temperature_2m_max: [31.1, null, 26.5],
    temperature_2m_min: [22.8, 22.1, 22.4],
    precipitation_probability_max: [100, null, 4.6],
    wind_speed_10m_max: [17.7, 20, 62.1],
  });
  assert.deepEqual(days, [
    { date: '2026-10-21', min: 23, max: 31, condition: 'RAINY', rainChance: 100 },
    { date: '2026-10-23', min: 22, max: 27, condition: 'WINDY', rainChance: 5 },
  ]);
});

test('summarizeCurrent', () => {
  assert.deepEqual(summarizeCurrent({ temperature_2m: 22.9, weather_code: 53, wind_speed_10m: 11.2 }), { temp: 23, condition: 'RAINY', windKmh: 11 });
  assert.equal(summarizeCurrent(undefined), null);
  assert.equal(summarizeCurrent({}), null);
});
