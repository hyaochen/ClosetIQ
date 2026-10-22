/**
 * 圖片根目錄。必須在「使用時」才讀環境變數：模組頂層讀取會早於 server.ts 的 dotenv，
 * 本機用 .env 時就會落回 ./data/images（正式站由 compose 直接注入環境變數，行為不變）。
 */
export const storagePath = (): string => process.env.IMAGE_STORAGE_PATH || './data/images';
