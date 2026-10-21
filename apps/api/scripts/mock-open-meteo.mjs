// 假的 Open-Meteo（只供本機測試）：port 3016，回傳 /v1/forecast（current + daily 16 天）與 geocoding。
// 今天算第 0 天：第 2 天下雨（WMO 63、降雨機率 80）、第 3 天降溫（11-13 度）、第 4 天雲量代碼 2 且風大（觸發 WINDY）。
import http from 'node:http';
let calls = 0;
const ymd = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/__count') return res.end(JSON.stringify({ calls }));
  if (u.pathname === '/v1/forecast') {
    calls++;
    if (u.searchParams.get('mode') === 'error') { res.statusCode = 500; return res.end('{}'); }
    const n = Number(u.searchParams.get('forecast_days') || 7);
    const time = [], code = [], tmax = [], tmin = [], pop = [], wind = [];
    for (let i = 0; i < n; i++) {
      time.push(ymd(Date.now() + i * 86400e3));
      code.push(i === 2 ? 63 : i === 4 ? 2 : 3);
      tmax.push(i === 3 ? 13 : 27);
      tmin.push(i === 3 ? 11 : 21);
      pop.push(i === 2 ? 80 : 10);
      wind.push(i === 4 ? 48 : 12);
    }
    return res.end(JSON.stringify({
      current: { temperature_2m: 24.6, weather_code: 2, wind_speed_10m: 10 },
      daily: { time, weather_code: code, temperature_2m_max: tmax, temperature_2m_min: tmin, precipitation_probability_max: pop, wind_speed_10m_max: wind },
    }));
  }
  if (u.pathname === '/v1/search') {
    const name = u.searchParams.get('name') || '';
    if (/^nowhere/i.test(name)) return res.end('{"generationtime_ms":0.1}');
    return res.end(JSON.stringify({ results: [{ name: 'Tokyo', latitude: 35.68, longitude: 139.69, timezone: 'Asia/Tokyo' }] }));
  }
  res.statusCode = 404; res.end('{}');
});
const MOCK_PORT = Number(process.env.MOCK_PORT || 3016);
srv.listen(MOCK_PORT, '127.0.0.1', () => console.log('mock open-meteo :' + MOCK_PORT));
