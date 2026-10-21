// 假的 OpenWeatherMap（只供本機測試）：port 3016，回傳文件格式的 5 天/3 小時預報。第 3 天（今天算第 1 天）下雨、第 4 天降溫。
import http from 'node:http';
let calls = 0;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (u.pathname === '/__count') return res.end(JSON.stringify({ calls }));
  if (u.pathname === '/data/2.5/forecast') {
    calls++;
    if (u.searchParams.get('appid') !== 'mock-key') { res.statusCode = 401; return res.end('{"cod":401}'); }
    const list = [];
    const todayStart = Math.floor((Date.now() / 1000 + 28800) / 86400) * 86400;
    const first = Math.ceil(Date.now() / 10800000) * 10800;
    for (let i = 0; i < 40; i++) {
      const dt = first + i * 10800;
      const day = Math.floor((dt + 28800 - todayStart) / 86400); // 台北日界
      const hour = new Date(dt * 1000).getUTCHours();
      const warm = hour >= 3 && hour <= 9; // 台北 11:00-17:00 較熱
      const base = day === 3 ? 12 : 22;
      const t = base + (warm ? 5 : 0);
      const rainy = day === 2;
      list.push({ dt, main: { temp: t, temp_min: t - 1, temp_max: t + 1 }, weather: [{ id: rainy ? 500 : 802 }], pop: rainy ? 0.8 : 0.1 });
    }
    return res.end(JSON.stringify({ cod: '200', list }));
  }
  if (u.pathname === '/geo/1.0/direct') return res.end(JSON.stringify([{ name: 'Tokyo', lat: 35.68, lon: 139.69 }]));
  res.statusCode = 404; res.end('{}');
});
srv.listen(3016, '127.0.0.1', () => console.log('mock owm :3016'));
