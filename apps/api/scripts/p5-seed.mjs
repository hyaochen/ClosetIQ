// 建立測試帳號與中文命名的衣物，輸出 token。用法：node p5-seed.mjs （環境變數 BASE 預設 http://127.0.0.1:3015）
const BASE = process.env.BASE || 'http://127.0.0.1:3015';
export async function api(method, path, token, body) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 429) { // api 有每分鐘 100 次的 rate limit，等一下重試
      await new Promise((r) => setTimeout(r, 8000));
      continue;
    }
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  throw new Error('rate limited too long');
}
export async function account(name) {
  let r = await api('POST', '/api/auth/register', null, { email: name, password: 'abc12345', displayName: name });
  if (r.status !== 201) r = await api('POST', '/api/auth/login', null, { email: name, password: 'abc12345' });
  return r.json.accessToken;
}
export async function seedItems(token, defs) {
  const ids = {};
  for (const d of defs) {
    const r = await api('POST', '/api/items', token, {
      name: d.name, category: d.category, colors: ['#336699'], colorFamily: 'BLUE',
      seasons: d.seasons || ['SPRING', 'AUTUMN', 'SUMMER', 'WINTER'], occasions: ['CASUAL'], tags: d.tags || [], material: d.material,
    });
    if (r.status !== 201) throw new Error('seed fail ' + JSON.stringify(r));
    ids[d.name] = r.json.item.id;
  }
  return ids;
}
