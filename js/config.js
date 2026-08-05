/* CVHT Hub — Config (no backend)
 * Chế độ dữ liệu:
 *  - local  : dùng SEED + localStorage (demo / offline)
 *  - sheets : đọc/ghi qua Google Apps Script Web App
 *
 * Cách gắn Google Sheet:
 *  1. Tạo Spreadsheet với các sheet đúng schema (xem js/sheets.js → SHEET_SCHEMA)
 *  2. Extensions → Apps Script → dán code trong sheets/Code.gs
 *  3. Deploy → Web app → Anyone → copy URL vào sheetsWebAppUrl bên dưới
 *  4. Đổi mode thành 'sheets'
 */
const APP_CONFIG = {
  appName: 'CVHT Hub',
  orgName: 'Rikkei Education',
  semesterDefault: '2025-HK2',
  timezone: 'Asia/Ho_Chi_Minh',
  reportDeadline: { day: 5, hour: 23, minute: 0 }, // Friday 23:00
  mode: 'local', // 'local' | 'sheets'
  sheetsWebAppUrl: '', // dán URL Web App ở đây
  sheetsApiKey: '', // optional token nếu bạn bật trong Apps Script
  version: '4.1.0',
};
