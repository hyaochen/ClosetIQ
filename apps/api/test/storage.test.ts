import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storagePath } from '../src/lib/storage.js';

// T-CL-018：IMAGE_STORAGE_PATH 要在「使用時」才讀，晚於 import 才設的環境變數（dotenv）也要生效
test('storagePath 讀的是呼叫當下的環境變數', () => {
  const saved = process.env.IMAGE_STORAGE_PATH;
  try {
    delete process.env.IMAGE_STORAGE_PATH;
    assert.equal(storagePath(), './data/images');
    process.env.IMAGE_STORAGE_PATH = '/data/測試圖庫';
    assert.equal(storagePath(), '/data/測試圖庫');
    process.env.IMAGE_STORAGE_PATH = '';
    assert.equal(storagePath(), './data/images');
  } finally {
    if (saved === undefined) delete process.env.IMAGE_STORAGE_PATH;
    else process.env.IMAGE_STORAGE_PATH = saved;
  }
});

test('各路由與服務不再於 import 時讀 IMAGE_STORAGE_PATH', async () => {
  const fs = await import('node:fs/promises');
  const files = ['routes/images.ts', 'routes/wishlist.ts', 'services/canvas.service.ts', 'services/image.service.ts', 'services/cutout.service.ts'];
  for (const f of files) {
    const src = await fs.readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.ok(!/process\.env\.IMAGE_STORAGE_PATH/.test(src), `${f} 不應直接讀環境變數`);
    assert.ok(/storagePath\(\)/.test(src), `${f} 應使用 storagePath()`);
  }
});
