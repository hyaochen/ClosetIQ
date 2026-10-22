import { Platform } from 'react-native';
import { GOOGLE_FONTS_URL } from './theme';

/**
 * Web 端載入字體：在 bundle 載入時就把 Google Fonts 的 <link> 插進 <head>。
 *
 * 為什麼不用 @expo-google-fonts + expo-font：
 *  - Noto Serif TC / Noto Sans TC 是完整 CJK 字體，單一字重 .ttf 就好幾 MB，
 *    打進 expo export 的 bundle 會讓首次載入暴增（正式站 nginx 只有 gzip）。
 *  - Google Fonts CSS 以 unicode-range 切片，瀏覽器只下載畫面上用到的字。
 *  - Expo SDK 52 在 web.output = "single" 沒有 +html / index.html 模板可依賴，
 *    執行期插 <link> 不依賴任何模板，也不用新增 npm 依賴（不動 package-lock，docker npm ci 不受影響）。
 * native 端不載入（回退系統字）。
 */
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const head = document.head;
  if (!document.getElementById('closet-fonts')) {
    for (const href of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
      const pre = document.createElement('link');
      pre.rel = 'preconnect';
      pre.href = href;
      if (href.includes('gstatic')) pre.crossOrigin = 'anonymous';
      head.appendChild(pre);
    }
    const link = document.createElement('link');
    link.id = 'closet-fonts';
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    head.appendChild(link);
  }
}

export {};
